import { describe, expect, it } from "vitest";
import { CalibrationEngine } from "@/lib/client/vision/calibration";

describe("CalibrationEngine", () => {
  it("accepts only fresh finite frames from the current attempt", () => {
    const engine = new CalibrationEngine(3);
    const firstAttempt = engine.start();

    engine.addSample({ yaw: 1, pitch: 2, roll: 0 }, 100, firstAttempt);
    engine.addSample({ yaw: 2, pitch: 3, roll: 0 }, 100, firstAttempt);
    engine.addSample({ yaw: Number.NaN, pitch: 3, roll: 0 }, 110, firstAttempt);
    expect(engine.getState().samplesCount).toBe(1);

    const retryAttempt = engine.start();
    engine.addSample({ yaw: 4, pitch: 4, roll: 0 }, 120, firstAttempt);
    expect(engine.getState().samplesCount).toBe(0);

    engine.addSample({ yaw: 4, pitch: 4, roll: 0 }, 120, retryAttempt);
    engine.addSample({ yaw: 5, pitch: 5, roll: 0 }, 130, retryAttempt);
    engine.addSample({ yaw: 6, pitch: 6, roll: 0 }, 140, retryAttempt);

    expect(engine.getState()).toMatchObject({
      status: "completed",
      samplesCount: 0,
      baseline: { yaw: 5, pitch: 5, roll: 0 }
    });
  });

  it("keeps a completed baseline when a later attempt fails", () => {
    const engine = new CalibrationEngine(1);
    const successfulAttempt = engine.start();
    engine.addSample({ yaw: -2, pitch: 1, roll: 0 }, 1, successfulAttempt);

    const failedAttempt = engine.start();
    engine.addSample({ yaw: 60, pitch: 0, roll: 0 }, 2, failedAttempt);

    expect(engine.getState()).toMatchObject({
      status: "failed",
      baseline: { yaw: -2, pitch: 1, roll: 0 },
      errorMessage: "pose_out_of_bounds"
    });
  });
});
