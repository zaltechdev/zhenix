import { HeadPose, NeutralBaseline } from "./head-pose";

export const CALIBRATION_CONFIG = {
  requiredSamples: 12,
  timeoutMs: 6000,
  maxAngleDegrees: 45,
  minimumDirectionalMovementDegrees: 1.5,
  stableWindowDegrees: 2.5
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
  direction: CalibrationDirection;
  step: number;
  errorMessage: string | null;
  attemptId: number;
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
  private status: CalibrationState["status"] = "idle";
  private baseline: NeutralBaseline | null = null;
  private range: DirectionalCalibrationRange | null = null;
  private errorMessage: string | null = null;
  private attemptId = 0;
  private step = 0;
  private lastTimestampMs = -Infinity;

  constructor(private readonly requiredSamples: number = CALIBRATION_CONFIG.requiredSamples) {}

  public start(): number {
    this.attemptId += 1;
    this.samples = [];
    this.status = "capturing";
    this.baseline = null;
    this.range = null;
    this.errorMessage = null;
    this.step = 0;
    this.lastTimestampMs = -Infinity;
    return this.attemptId;
  }

  public cancel(): void {
    this.attemptId += 1;
    this.samples = [];
    this.status = "idle";
    this.errorMessage = null;
    this.step = 0;
    this.lastTimestampMs = -Infinity;
  }

  public fail(reason: string, attemptId = this.attemptId): CalibrationState {
    if (attemptId !== this.attemptId || this.status !== "capturing") return this.getState();
    this.samples = [];
    this.status = "failed";
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
    if (this.samples.length < this.requiredSamples || !this.isStable()) return this.getState();

    const average = averagePose(this.samples);
    if (!this.acceptCurrentDirection(average)) {
      this.samples = [];
      return this.getState();
    }

    this.samples = [];
    this.lastTimestampMs = -Infinity;
    if (this.step === CALIBRATION_DIRECTIONS.length - 1) {
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
      Math.abs(pose.pitch) <= CALIBRATION_CONFIG.maxAngleDegrees
    );
  }

  private isStable(): boolean {
    const first = this.samples[0];
    return this.samples.every(
      (sample) =>
        Math.abs(sample.yaw - first.yaw) <= CALIBRATION_CONFIG.stableWindowDegrees &&
        Math.abs(sample.pitch - first.pitch) <= CALIBRATION_CONFIG.stableWindowDegrees
    );
  }

  private acceptCurrentDirection(average: NeutralBaseline): boolean {
    if (this.step === 0) {
      this.baseline = average;
      this.range = { left: 0, right: 0, up: 0, down: 0 };
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
}
