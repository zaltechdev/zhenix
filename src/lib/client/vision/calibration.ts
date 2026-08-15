/**
 * Instant One-Click & Auto Calibration Engine.
 *
 * Replaces the legacy 6-step multi-stage direction wizard with an instant,
 * single-frame neutral origin calibration and self-healing continuous auto-recalibration.
 */

import { HeadPose, NeutralBaseline } from "./head-pose";
import type { CalibratedDeadZone } from "./pointer-mapping";

export const CALIBRATION_CONFIG = {
  timeoutMs: 3000,
  maxAngleDegrees: 45,
  defaultComfortableRangeDegrees: 10,
  defaultDeadZoneEnterDegrees: 1.25,
  defaultDeadZoneExitDegrees: 0.65
} as const;

export type CalibrationDirection =
  | "center"
  | "left"
  | "right"
  | "up"
  | "down"
  | "return_center";

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

export class CalibrationEngine {
  private status: CalibrationState["status"] = "idle";
  private baseline: NeutralBaseline | null = null;
  private range: DirectionalCalibrationRange | null = null;
  private deadZone: CalibratedDeadZone | null = null;
  private errorMessage: string | null = null;
  private attemptId = 0;
  private samplesCount = 0;

  constructor(private readonly requiredSamples: number = 1) {}

  /**
   * Start a new calibration attempt.
   */
  public start(): number {
    this.attemptId += 1;
    this.status = "capturing";
    this.samplesCount = 0;
    this.errorMessage = null;
    return this.attemptId;
  }

  /**
   * Cancel the active calibration attempt.
   */
  public cancel(): void {
    this.attemptId += 1;
    this.status = "idle";
    this.samplesCount = 0;
    this.errorMessage = null;
  }

  /**
   * Fail the active calibration attempt with a specific reason.
   */
  public fail(reason: string, attemptId = this.attemptId): CalibrationState {
    if (attemptId !== this.attemptId || this.status !== "capturing") return this.getState();
    this.status = "failed";
    this.errorMessage = reason;
    return this.getState();
  }

  /**
   * Execute single-frame instant calibration from current head pose.
   */
  public calibrate(pose: HeadPose, attemptId = this.attemptId): CalibrationState {
    if (attemptId !== this.attemptId) return this.getState();
    if (!this.isValidPose(pose)) {
      return this.fail("invalid_calibration", attemptId);
    }

    this.baseline = {
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll
    };

    // Establish comfortable default kinematic range
    const r = CALIBRATION_CONFIG.defaultComfortableRangeDegrees;
    this.range = {
      left: r,
      right: r,
      up: r,
      down: r
    };

    this.deadZone = {
      yawEnter: CALIBRATION_CONFIG.defaultDeadZoneEnterDegrees,
      yawExit: CALIBRATION_CONFIG.defaultDeadZoneExitDegrees,
      pitchEnter: CALIBRATION_CONFIG.defaultDeadZoneEnterDegrees,
      pitchExit: CALIBRATION_CONFIG.defaultDeadZoneExitDegrees
    };

    this.status = "completed";
    this.samplesCount = 1;
    this.errorMessage = null;

    return this.getState();
  }

  /**
   * Add a pose sample to the calibration attempt. In one-click calibration,
   * a single valid pose completes calibration immediately in 1 frame.
   */
  public addSample(
    pose: HeadPose,
    _timestampMs?: number,
    attemptId = this.attemptId
  ): CalibrationState {
    if (this.status !== "capturing" || attemptId !== this.attemptId) return this.getState();
    return this.calibrate(pose, attemptId);
  }

  public getState(): CalibrationState {
    return {
      status: this.status,
      progressRatio: this.status === "completed" ? 1.0 : this.status === "capturing" ? 0.5 : 0,
      samplesCount: this.samplesCount,
      baseline: this.baseline ? { ...this.baseline } : null,
      range: this.range ? { ...this.range } : null,
      deadZone: this.deadZone ? { ...this.deadZone } : null,
      direction: "center",
      step: 1,
      errorMessage: this.errorMessage,
      attemptId: this.attemptId
    };
  }

  private isValidPose(pose: HeadPose): boolean {
    if (!pose || ![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite)) return false;
    return (
      Math.abs(pose.yaw) <= CALIBRATION_CONFIG.maxAngleDegrees &&
      Math.abs(pose.pitch) <= CALIBRATION_CONFIG.maxAngleDegrees &&
      Math.abs(pose.roll) <= CALIBRATION_CONFIG.maxAngleDegrees
    );
  }
}
