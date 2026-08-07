/**
 * Head Control Calibration Engine.
 * Captures a comfortable neutral baseline pose for relative movement mapping.
 */

import { HeadPose, NeutralBaseline } from "./head-pose";

export interface CalibrationState {
  status: "idle" | "capturing" | "completed" | "failed";
  progressRatio: number; // 0.0 to 1.0
  samplesCount: number;
  baseline: NeutralBaseline | null;
  errorMessage: string | null;
}

export class CalibrationEngine {
  private samples: HeadPose[] = [];
  private requiredSamples: number;
  private status: "idle" | "capturing" | "completed" | "failed" = "idle";
  private baseline: NeutralBaseline | null = null;
  private errorMessage: string | null = null;

  constructor(requiredSamples = 20) {
    this.requiredSamples = requiredSamples;
  }

  public start(): void {
    this.samples = [];
    this.status = "capturing";
    this.baseline = null;
    this.errorMessage = null;
  }

  public cancel(): void {
    this.samples = [];
    this.status = "idle";
    this.errorMessage = null;
  }

  public addSample(pose: HeadPose): CalibrationState {
    if (this.status !== "capturing") {
      return this.getState();
    }

    // Sanity check sample for reasonable angle bounds
    if (Math.abs(pose.yaw) > 45 || Math.abs(pose.pitch) > 45) {
      this.status = "failed";
      this.errorMessage = "Extreme head angle during baseline capture. Please face the screen center comfortably.";
      return this.getState();
    }

    this.samples.push(pose);

    if (this.samples.length >= this.requiredSamples) {
      // Calculate mean neutral baseline
      let sumYaw = 0;
      let sumPitch = 0;
      let sumRoll = 0;

      for (const s of this.samples) {
        sumYaw += s.yaw;
        sumPitch += s.pitch;
        sumRoll += s.roll;
      }

      const count = this.samples.length;
      this.baseline = {
        yaw: sumYaw / count,
        pitch: sumPitch / count,
        roll: sumRoll / count
      };

      this.status = "completed";
    }

    return this.getState();
  }

  public getState(): CalibrationState {
    const ratio = Math.min(1.0, this.samples.length / this.requiredSamples);
    return {
      status: this.status,
      progressRatio: ratio,
      samplesCount: this.samples.length,
      baseline: this.baseline,
      errorMessage: this.errorMessage
    };
  }
}
