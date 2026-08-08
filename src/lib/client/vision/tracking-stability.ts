import type { HeadPose, NeutralBaseline } from "./head-pose";

const DEFAULT_FRAME_INTERVAL_MS = 16.6;
const MAX_FRAME_INTERVAL_MS = 100;

export type FreshFrameResult =
  | { accepted: false; deltaTimeMs: 0 }
  | { accepted: true; deltaTimeMs: number };

/** Rejects duplicate, stale, and invalid camera timestamps before they reach pointer state. */
export class FreshFrameClock {
  private lastTimestampMs = -Infinity;

  public reset(): void {
    this.lastTimestampMs = -Infinity;
  }

  public process(timestampMs: number): FreshFrameResult {
    if (!Number.isFinite(timestampMs) || timestampMs <= this.lastTimestampMs) {
      return { accepted: false, deltaTimeMs: 0 };
    }

    const deltaTimeMs = Number.isFinite(this.lastTimestampMs)
      ? Math.min(MAX_FRAME_INTERVAL_MS, Math.max(1, timestampMs - this.lastTimestampMs))
      : DEFAULT_FRAME_INTERVAL_MS;
    this.lastTimestampMs = timestampMs;
    return { accepted: true, deltaTimeMs };
  }
}

export type ReacquisitionResult = {
  baseline: NeutralBaseline | null;
  samplesCount: number;
};

/**
 * Establishes a fresh neutral baseline from a short stable window after startup
 * or tracking loss. The window resets around real movement instead of averaging
 * a transition into a pointer jump.
 */
export class TrackingReacquisitionController {
  private samples: HeadPose[] = [];

  constructor(
    private readonly requiredSamples = 5,
    private readonly stableWindowDegrees = 1.75
  ) {}

  public reset(): void {
    this.samples = [];
  }

  public process(pose: HeadPose): ReacquisitionResult {
    if (![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite)) {
      return { baseline: null, samplesCount: this.samples.length };
    }

    const next = { ...pose };
    const anchor = this.samples[0];
    if (anchor && !this.isStableWith(anchor, next)) {
      this.samples = [next];
      return { baseline: null, samplesCount: 1 };
    }

    this.samples.push(next);
    if (this.samples.length < this.requiredSamples) {
      return { baseline: null, samplesCount: this.samples.length };
    }

    const baseline = this.average(this.samples);
    this.samples = [];
    return { baseline, samplesCount: this.requiredSamples };
  }

  private isStableWith(anchor: HeadPose, next: HeadPose): boolean {
    return (
      Math.abs(next.yaw - anchor.yaw) <= this.stableWindowDegrees &&
      Math.abs(next.pitch - anchor.pitch) <= this.stableWindowDegrees &&
      Math.abs(next.roll - anchor.roll) <= this.stableWindowDegrees
    );
  }

  private average(samples: HeadPose[]): NeutralBaseline {
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
}
