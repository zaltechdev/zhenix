import { HeadPose, NeutralBaseline } from "./head-pose";
import {
  MIN_DEAD_ZONE_DEGREES,
  MAX_DEAD_ZONE_DEGREES,
  type CalibratedDeadZone
} from "./pointer-mapping";

export const CALIBRATION_CONFIG = {
  requiredSamples: 12,
  timeoutMs: 6000,
  maxAngleDegrees: 45,
  minimumDirectionalMovementDegrees: 1.5,
  stableWindowDegrees: 2.5,
  /** Minimum usable directional range in degrees. */
  minimumUsableRangeDegrees: 2,
  /** MAD multiplier for dead zone enter threshold. */
  madEnterMultiplier: 2.5,
  /** MAD multiplier for dead zone exit threshold. */
  madExitMultiplier: 1.5
} as const;

export const CALIBRATION_DIRECTIONS = [
  "center",
  "left",
  "right",
  "up",
  "down",
  "return_center"
] as const;

export type CalibrationDirection = (typeof CALIBRATION_DIRECTIONS)[number];

/** Session-only comfortable movement extents. Raw samples are discarded after each step. */
export interface DirectionalCalibrationRange {
  left: number;
  right: number;
  up: number;
  down: number;
}

export interface CalibrationState {
  status: "idle" | "capturing" | "completed" | "failed";
  progressRatio: number;
  samplesCount: number;
  baseline: NeutralBaseline | null;
  range: DirectionalCalibrationRange | null;
  deadZone: CalibratedDeadZone | null;
  direction: CalibrationDirection;
  step: number;
  errorMessage: string | null;
  attemptId: number;
}

function medianSorted(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Median Absolute Deviation - robust noise estimator. */
function computeMAD(values: number[]): number {
  if (values.length === 0) return 0;
  const med = medianSorted(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return medianSorted(deviations);
}

function clampDeadZoneDegrees(value: number): number {
  return Math.max(MIN_DEAD_ZONE_DEGREES, Math.min(MAX_DEAD_ZONE_DEGREES, value));
}

function averagePose(samples: HeadPose[]): NeutralBaseline {
  const total = samples.reduce(
    (sum, sample) => ({
      yaw: sum.yaw + sample.yaw,
      pitch: sum.pitch + sample.pitch,
      roll: sum.roll + sample.roll
    }),
    { yaw: 0, pitch: 0, roll: 0 }
  );
  return {
    yaw: total.yaw / samples.length,
    pitch: total.pitch / samples.length,
    roll: total.roll / samples.length
  };
}

/** Owns only fresh, real pose samples for one directional calibration attempt. */
export class CalibrationEngine {
  private samples: HeadPose[] = [];
  private centerSamples: HeadPose[] = [];
  private status: CalibrationState["status"] = "idle";
  private baseline: NeutralBaseline | null = null;
  private range: DirectionalCalibrationRange | null = null;
  private deadZone: CalibratedDeadZone | null = null;
  private errorMessage: string | null = null;
  private attemptId = 0;
  private step = 0;
  private lastTimestampMs = -Infinity;

  constructor(private readonly requiredSamples: number = CALIBRATION_CONFIG.requiredSamples) {}

  public start(): number {
    this.attemptId += 1;
    this.samples = [];
    this.centerSamples = [];
    this.status = "capturing";
    this.baseline = null;
    this.range = null;
    this.deadZone = null;
    this.errorMessage = null;
    this.step = 0;
    this.lastTimestampMs = -Infinity;
    return this.attemptId;
  }

  public cancel(): void {
    this.attemptId += 1;
    this.samples = [];
    this.centerSamples = [];
    this.status = "idle";
    this.baseline = null;
    this.range = null;
    this.deadZone = null;
    this.errorMessage = null;
    this.step = 0;
    this.lastTimestampMs = -Infinity;
  }

  public fail(reason: string, attemptId = this.attemptId): CalibrationState {
    if (attemptId !== this.attemptId || this.status !== "capturing") return this.getState();
    this.samples = [];
    this.centerSamples = [];
    this.status = "failed";
    this.baseline = null;
    this.range = null;
    this.deadZone = null;
    this.errorMessage = reason;
    return this.getState();
  }

  public addSample(
    pose: HeadPose,
    timestampMs = this.lastTimestampMs === -Infinity ? 0 : this.lastTimestampMs + 1,
    attemptId = this.attemptId
  ): CalibrationState {
    if (this.status !== "capturing" || attemptId !== this.attemptId) return this.getState();
    if (!this.isValidFreshPose(pose, timestampMs)) return this.getState();

    this.lastTimestampMs = timestampMs;
    this.samples.push({ ...pose });
    if (!this.isStable()) {
      // A one-frame spike must not poison the fresh stable window or keep the
      // attempt waiting on an impossible average until the timeout fires.
      this.samples = [this.samples[this.samples.length - 1]];
      return this.getState();
    }
    if (this.samples.length < this.requiredSamples) return this.getState();

    const average = averagePose(this.samples);
    if (!this.acceptCurrentDirection(average)) {
      this.samples = [];
      return this.getState();
    }

    this.samples = [];
    this.lastTimestampMs = -Infinity;
    if (this.step === CALIBRATION_DIRECTIONS.length - 1) {
      // Validate before completing
      const validationError = this.validateCalibration();
      if (validationError) {
        this.status = "failed";
        this.errorMessage = validationError;
        this.baseline = null;
        this.range = null;
        this.deadZone = null;
        return this.getState();
      }
      this.status = "completed";
      return this.getState();
    }
    this.step += 1;
    return this.getState();
  }

  public getState(): CalibrationState {
    return {
      status: this.status,
      progressRatio:
        this.status === "completed"
          ? 1
          : Math.min(1, (this.step + this.samples.length / this.requiredSamples) / CALIBRATION_DIRECTIONS.length),
      samplesCount: this.samples.length,
      baseline: this.baseline,
      range: this.range,
      deadZone: this.deadZone,
      direction: CALIBRATION_DIRECTIONS[this.step] ?? "return_center",
      step: this.status === "completed" ? CALIBRATION_DIRECTIONS.length : this.step + 1,
      errorMessage: this.errorMessage,
      attemptId: this.attemptId
    };
  }

  private isValidFreshPose(pose: HeadPose, timestampMs: number): boolean {
    if (!Number.isFinite(timestampMs) || timestampMs <= this.lastTimestampMs) return false;
    if (![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite)) return false;
    return (
      Math.abs(pose.yaw) <= CALIBRATION_CONFIG.maxAngleDegrees &&
      Math.abs(pose.pitch) <= CALIBRATION_CONFIG.maxAngleDegrees &&
      Math.abs(pose.roll) <= CALIBRATION_CONFIG.maxAngleDegrees
    );
  }

  private isStable(): boolean {
    const first = this.samples[0];
    return this.samples.every(
      (sample) =>
        Math.abs(sample.yaw - first.yaw) <= CALIBRATION_CONFIG.stableWindowDegrees &&
        Math.abs(sample.pitch - first.pitch) <= CALIBRATION_CONFIG.stableWindowDegrees &&
        Math.abs(sample.roll - first.roll) <= CALIBRATION_CONFIG.stableWindowDegrees
    );
  }

  private acceptCurrentDirection(average: NeutralBaseline): boolean {
    if (this.step === 0) {
      this.baseline = average;
      this.range = { left: 0, right: 0, up: 0, down: 0 };
      // Store center samples for noise measurement
      this.centerSamples = [...this.samples];
      // Compute per-axis dead zone from neutral noise
      this.deadZone = this.computeDeadZoneFromNoise(this.centerSamples);
      return true;
    }
    if (!this.baseline || !this.range) return false;

    const yawDelta = average.yaw - this.baseline.yaw;
    const pitchDelta = average.pitch - this.baseline.pitch;
    const minimum = CALIBRATION_CONFIG.minimumDirectionalMovementDegrees;
    const direction = CALIBRATION_DIRECTIONS[this.step];

    if (direction === "left" && yawDelta >= minimum) {
      this.range.left = yawDelta;
      return true;
    }
    if (direction === "right" && yawDelta <= -minimum) {
      this.range.right = Math.abs(yawDelta);
      return true;
    }
    if (direction === "up" && pitchDelta >= minimum) {
      this.range.up = pitchDelta;
      return true;
    }
    if (direction === "down" && pitchDelta <= -minimum) {
      this.range.down = Math.abs(pitchDelta);
      return true;
    }
    if (direction === "return_center") {
      return Math.abs(yawDelta) <= CALIBRATION_CONFIG.stableWindowDegrees &&
        Math.abs(pitchDelta) <= CALIBRATION_CONFIG.stableWindowDegrees;
    }
    return false;
  }

  private computeDeadZoneFromNoise(samples: HeadPose[]): CalibratedDeadZone {
    if (samples.length < 3) {
      const enter = clampDeadZoneDegrees(MIN_DEAD_ZONE_DEGREES * CALIBRATION_CONFIG.madEnterMultiplier);
      return {
        yawEnter: enter,
        yawExit: enter * 0.6,
        pitchEnter: enter,
        pitchExit: enter * 0.6
      };
    }

    const yawValues = samples.map((s) => s.yaw);
    const pitchValues = samples.map((s) => s.pitch);

    const yawMAD = computeMAD(yawValues);
    const pitchMAD = computeMAD(pitchValues);

    const yawEnter = clampDeadZoneDegrees(yawMAD * CALIBRATION_CONFIG.madEnterMultiplier);
    const pitchEnter = clampDeadZoneDegrees(pitchMAD * CALIBRATION_CONFIG.madEnterMultiplier);
    // Exit must be strictly less than enter; use 60% of enter as floor
    const yawExit = Math.min(
      clampDeadZoneDegrees(yawMAD * CALIBRATION_CONFIG.madExitMultiplier),
      yawEnter * 0.8
    );
    const pitchExit = Math.min(
      clampDeadZoneDegrees(pitchMAD * CALIBRATION_CONFIG.madExitMultiplier),
      pitchEnter * 0.8
    );

    return { yawEnter, yawExit, pitchEnter, pitchExit };
  }

  private validateCalibration(): string | null {
    if (!this.range) return "missing_range";

    const { minimumUsableRangeDegrees } = CALIBRATION_CONFIG;

    // Check each direction meets minimum
    if (this.range.left < minimumUsableRangeDegrees) return "range_too_small_left";
    if (this.range.right < minimumUsableRangeDegrees) return "range_too_small_right";
    if (this.range.up < minimumUsableRangeDegrees) return "range_too_small_up";
    if (this.range.down < minimumUsableRangeDegrees) return "range_too_small_down";

    return null;
  }
}
