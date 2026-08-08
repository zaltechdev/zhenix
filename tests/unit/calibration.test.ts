import { describe, expect, it } from "vitest";
import { CalibrationEngine } from "@/lib/client/vision/calibration";

function completeDirectionalCalibration(engine: CalibrationEngine, attemptId: number, start = 100) {
  [
    { yaw: 1, pitch: 2, roll: 0 },
    { yaw: 5, pitch: 2, roll: 0 },
    { yaw: -4, pitch: 2, roll: 0 },
    { yaw: 1, pitch: 7, roll: 0 },
    { yaw: 1, pitch: -3, roll: 0 },
    { yaw: 1, pitch: 2, roll: 0 }
  ].forEach((pose, index) => engine.addSample(pose, start + index * 10, attemptId));
}

describe("CalibrationEngine", () => {
  it("accepts only fresh finite frames from the current attempt", () => {
    const engine = new CalibrationEngine(1);
    const firstAttempt = engine.start();

    engine.addSample({ yaw: 1, pitch: 2, roll: 0 }, 100, firstAttempt);
    engine.addSample({ yaw: 2, pitch: 3, roll: 0 }, 100, firstAttempt);
    engine.addSample({ yaw: Number.NaN, pitch: 3, roll: 0 }, 110, firstAttempt);
    expect(engine.getState()).toMatchObject({ direction: "left", step: 2, samplesCount: 0 });

    const retryAttempt = engine.start();
    engine.addSample({ yaw: 4, pitch: 4, roll: 0 }, 120, firstAttempt);
    expect(engine.getState().samplesCount).toBe(0);

    completeDirectionalCalibration(engine, retryAttempt, 120);
    expect(engine.getState()).toMatchObject({
      status: "completed",
      samplesCount: 0,
      baseline: { yaw: 1, pitch: 2, roll: 0 },
      range: { left: 4, right: 5, up: 5, down: 5 }
    });
  });

  it("requires the requested direction and discards rejected raw samples", () => {
    const engine = new CalibrationEngine(2);
    const attemptId = engine.start();

    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 1, attemptId);
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 2, attemptId);
    expect(engine.getState()).toMatchObject({ direction: "left", step: 2, samplesCount: 0 });

    engine.addSample({ yaw: -4, pitch: 0, roll: 0 }, 3, attemptId);
    engine.addSample({ yaw: -4, pitch: 0, roll: 0 }, 4, attemptId);
    expect(engine.getState()).toMatchObject({ direction: "left", step: 2, samplesCount: 0 });
  });

  it("keeps no raw samples after completion or a later failed attempt", () => {
    const engine = new CalibrationEngine(1);
    const successfulAttempt = engine.start();
    completeDirectionalCalibration(engine, successfulAttempt, 1);

    const failedAttempt = engine.start();
    engine.addSample({ yaw: 60, pitch: 0, roll: 0 }, 100, failedAttempt);

    expect(engine.getState()).toMatchObject({
      status: "capturing",
      samplesCount: 0,
      baseline: null,
      range: null
    });
  });
});
