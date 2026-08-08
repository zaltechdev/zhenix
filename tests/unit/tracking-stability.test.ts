import { describe, expect, it } from "vitest";
import {
  FreshFrameClock,
  TrackingReacquisitionController
} from "@/lib/client/vision/tracking-stability";

describe("tracking stability boundaries", () => {
  it("rejects duplicate, stale, and invalid frame timestamps", () => {
    const clock = new FreshFrameClock();

    expect(clock.process(1_000)).toEqual({ accepted: true, deltaTimeMs: 16.6 });
    expect(clock.process(1_000)).toEqual({ accepted: false, deltaTimeMs: 0 });
    expect(clock.process(999)).toEqual({ accepted: false, deltaTimeMs: 0 });
    expect(clock.process(Number.NaN)).toEqual({ accepted: false, deltaTimeMs: 0 });
    expect(clock.process(2_000)).toEqual({ accepted: true, deltaTimeMs: 100 });
  });

  it("establishes neutral only after a stable startup window", () => {
    const reacquisition = new TrackingReacquisitionController(3, 1);

    expect(reacquisition.process({ yaw: 8, pitch: -2, roll: 0 }).baseline).toBeNull();
    expect(reacquisition.process({ yaw: 8.4, pitch: -1.8, roll: 0.1 }).baseline).toBeNull();
    expect(reacquisition.process({ yaw: 7.9, pitch: -2.2, roll: -0.1 }).baseline).toEqual({
      yaw: 8.1,
      pitch: -2,
      roll: 0
    });
  });

  it("restarts acquisition after one pose spike instead of averaging a jump", () => {
    const reacquisition = new TrackingReacquisitionController(3, 1);

    reacquisition.process({ yaw: 0, pitch: 0, roll: 0 });
    reacquisition.process({ yaw: 0.2, pitch: 0.2, roll: 0 });
    expect(reacquisition.process({ yaw: 7, pitch: 0, roll: 0 })).toEqual({
      baseline: null,
      samplesCount: 1
    });
    reacquisition.process({ yaw: 7.1, pitch: 0.1, roll: 0 });
    expect(reacquisition.process({ yaw: 6.9, pitch: -0.1, roll: 0 }).baseline).toEqual({
      yaw: 7,
      pitch: 0,
      roll: 0
    });
  });
});
