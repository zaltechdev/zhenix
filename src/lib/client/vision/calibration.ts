/**
 * Captures a comfortable neutral baseline from fresh, finite face-pose frames.
 * The provider owns the wall-clock timeout; this class owns per-attempt data.
 */

import { HeadPose, NeutralBaseline } from "./head-pose";

export const CALIBRATION_CONFIG = {
  requiredSamples: 20,
  timeoutMs: 6000,
  maxAngleDegrees: 45
} as const;

export interface CalibrationState {
  status: "idle" | "capturing" | "completed" | "failed";
  progressRatio: number;
  samplesCount: number;
  baseline: NeutralBaseline | null;
  errorMessage: string | null;
  attemptId: number;
}

export class CalibrationEngine {
  private samples: HeadPose[] = [];
  private requiredSamples: number;
  private status: CalibrationState["status"] = "idle";
  private baseline: NeutralBaseline | null = null;
  private errorMessage: string | null = null;
  private attemptId = 0;
  private lastTimestampMs = -Infinity;

  constructor(requiredSamples: number = CALIBRATION_CONFIG.requiredSamples) {
    this.requiredSamples = requiredSamples;
  }

  public start(): number {
    this.attemptId += 1;
    this.samples = [];
    this.status = "capturing";
    this.errorMessage = null;
    this.lastTimestampMs = -Infinity;
    return this.attemptId;
  }

  public cancel(): void {
    this.attemptId += 1;
    this.samples = [];
    this.status = "idle";
    this.errorMessage = null;
    this.lastTimestampMs = -Infinity;
  }

  public fail(reason: string, attemptId = this.attemptId): CalibrationState {
    if (attemptId !== this.attemptId || this.status !== "capturing") {
      return this.getState();
    }

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
    if (this.status !== "capturing" || attemptId !== this.attemptId) {
      return this.getState();
    }

    if (
      !Number.isFinite(timestampMs) ||
      timestampMs <= this.lastTimestampMs ||
      !Number.isFinite(pose.yaw) ||
      !Number.isFinite(pose.pitch) ||
      !Number.isFinite(pose.roll)
    ) {
      return this.getState();
    }

    if (
      Math.abs(pose.yaw) > CALIBRATION_CONFIG.maxAngleDegrees ||
      Math.abs(pose.pitch) > CALIBRATION_CONFIG.maxAngleDegrees
    ) {
      return this.fail("pose_out_of_bounds", attemptId);
    }

    this.lastTimestampMs = timestampMs;
    this.samples.push({ ...pose });

    if (this.samples.length >= this.requiredSamples) {
      let sumYaw = 0;
      let sumPitch = 0;
      let sumRoll = 0;

      for (const sample of this.samples) {
        sumYaw += sample.yaw;
        sumPitch += sample.pitch;
        sumRoll += sample.roll;
      }

      this.baseline = {
        yaw: sumYaw / this.samples.length,
        pitch: sumPitch / this.samples.length,
        roll: sumRoll / this.samples.length
      };
      this.status = "completed";
      this.samples = [];
    }

    return this.getState();
  }

  public getState(): CalibrationState {
    return {
      status: this.status,
      progressRatio: Math.min(1, this.samples.length / this.requiredSamples),
      samplesCount: this.samples.length,
      baseline: this.baseline,
      errorMessage: this.errorMessage,
      attemptId: this.attemptId
    };
  }
}
