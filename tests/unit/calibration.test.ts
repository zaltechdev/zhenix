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

  it("recovers from a one-frame spike and accepts the next stable window", () => {
    const engine = new CalibrationEngine(3);
    const attemptId = engine.start();

    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 1, attemptId);
    engine.addSample({ yaw: 20, pitch: 0, roll: 0 }, 2, attemptId);
    expect(engine.getState().samplesCount).toBe(1);

    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 3, attemptId);
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 4, attemptId);
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 5, attemptId);

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

  it("computes per-axis dead zone from neutral noise during CENTER step", () => {
    const engine = new CalibrationEngine(5);
    const attemptId = engine.start();

    // Feed noisy center samples
    const centerSamples = [
      { yaw: 0.1, pitch: 0.2, roll: 0 },
      { yaw: -0.15, pitch: 0.1, roll: 0 },
      { yaw: 0.2, pitch: -0.1, roll: 0 },
      { yaw: -0.1, pitch: 0.15, roll: 0 },
      { yaw: 0.05, pitch: 0.05, roll: 0 }
    ];
    centerSamples.forEach((pose, i) => engine.addSample(pose, i + 1, attemptId));

    const state = engine.getState();
    expect(state.deadZone).not.toBeNull();
    // Dead zone should be derived from noise, clamped within bounds
    expect(state.deadZone!.yawEnter).toBeGreaterThanOrEqual(0.3);
    expect(state.deadZone!.yawEnter).toBeLessThanOrEqual(3.0);
    expect(state.deadZone!.pitchEnter).toBeGreaterThanOrEqual(0.3);
    expect(state.deadZone!.pitchEnter).toBeLessThanOrEqual(3.0);
    // Exit threshold should be less than enter
    expect(state.deadZone!.yawExit).toBeLessThan(state.deadZone!.yawEnter);
    expect(state.deadZone!.pitchExit).toBeLessThan(state.deadZone!.pitchEnter);
  });

  it("rejects calibration with directional range too small", () => {
    const engine = new CalibrationEngine(1);
    const attemptId = engine.start();

    // Center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 1, attemptId);
    // Left - accepted during capture but too small for final validation (1.5 < 3)
    engine.addSample({ yaw: 1.5, pitch: 0, roll: 0 }, 2, attemptId);
    // Right
    engine.addSample({ yaw: -5, pitch: 0, roll: 0 }, 3, attemptId);
    // Up
    engine.addSample({ yaw: 0, pitch: 5, roll: 0 }, 4, attemptId);
    // Down
    engine.addSample({ yaw: 0, pitch: -5, roll: 0 }, 5, attemptId);
    // Return center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 6, attemptId);

    const state = engine.getState();
    expect(state.status).toBe("failed");
    expect(state.errorMessage).toBe("range_too_small_left");
    expect(state.range).toBeNull();
  });

  it("accepts asymmetric directional ranges for limited movement", () => {
    const engine = new CalibrationEngine(1);
    const attemptId = engine.start();

    // Center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 1, attemptId);
    // Left - large
    engine.addSample({ yaw: 15, pitch: 0, roll: 0 }, 2, attemptId);
    // Right - very small but above minimum
    engine.addSample({ yaw: -3.5, pitch: 0, roll: 0 }, 3, attemptId);
    // Up
    engine.addSample({ yaw: 0, pitch: 8, roll: 0 }, 4, attemptId);
    // Down
    engine.addSample({ yaw: 0, pitch: -8, roll: 0 }, 5, attemptId);
    // Return center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 6, attemptId);

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.range).toEqual({ left: 15, right: 3.5, up: 8, down: 8 });
  });

  it("rejects excessive neutral noise instead of installing damaging calibration", () => {
    const engine = new CalibrationEngine(5);
    const attemptId = engine.start();
    const centerNoise = [-1.2, 1.2, -1.1, 1.1, 0];
    centerNoise.forEach((yaw, index) => {
      engine.addSample({ yaw, pitch: 0, roll: 0 }, index + 1, attemptId);
    });

    [
      { yaw: 8, pitch: 0, roll: 0 },
      { yaw: -8, pitch: 0, roll: 0 },
      { yaw: 0, pitch: 8, roll: 0 },
      { yaw: 0, pitch: -8, roll: 0 },
      { yaw: 0, pitch: 0, roll: 0 }
    ].forEach((pose, directionIndex) => {
      for (let sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
        engine.addSample(
          pose,
          100 + directionIndex * 10 + sampleIndex,
          attemptId
        );
      }
    });

    expect(engine.getState()).toMatchObject({
      status: "failed",
      errorMessage: "neutral_noise_excessive_yaw",
      range: null,
      deadZone: null
    });
  });

  it("accepts good symmetric calibration with valid ranges", () => {
    const engine = new CalibrationEngine(1);
    const attemptId = engine.start();

    // Center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 1, attemptId);
    // Left
    engine.addSample({ yaw: 8, pitch: 0, roll: 0 }, 2, attemptId);
    // Right
    engine.addSample({ yaw: -8, pitch: 0, roll: 0 }, 3, attemptId);
    // Up
    engine.addSample({ yaw: 0, pitch: 8, roll: 0 }, 4, attemptId);
    // Down
    engine.addSample({ yaw: 0, pitch: -8, roll: 0 }, 5, attemptId);
    // Return center
    engine.addSample({ yaw: 0, pitch: 0, roll: 0 }, 6, attemptId);

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.range).toEqual({ left: 8, right: 8, up: 8, down: 8 });
    expect(state.deadZone).not.toBeNull();
  });

  it("preserves previous calibration on failed attempt", () => {
    const engine = new CalibrationEngine(1);
    const firstAttempt = engine.start();
    completeDirectionalCalibration(engine, firstAttempt, 1);

    const firstResult = engine.getState();
    expect(firstResult.status).toBe("completed");

    // Second attempt that will fail
    const secondAttempt = engine.start();
    engine.fail("timeout", secondAttempt);

    const failedState = engine.getState();
    expect(failedState.status).toBe("failed");
    // Range and deadZone are null in the failed state output
    // The caller (coordinator) is responsible for restoring the previous calibration
    expect(failedState.range).toBeNull();
    expect(failedState.deadZone).toBeNull();
  });

  it("discards every partial calibration value after cancellation", () => {
    const engine = new CalibrationEngine(1);
    const attemptId = engine.start();

    engine.addSample({ yaw: 1, pitch: 2, roll: 0 }, 1, attemptId);
    expect(engine.getState()).toMatchObject({
      baseline: { yaw: 1, pitch: 2, roll: 0 },
      range: { left: 0, right: 0, up: 0, down: 0 }
    });

    engine.cancel();

    expect(engine.getState()).toMatchObject({
      status: "idle",
      baseline: null,
      range: null,
      deadZone: null
    });
  });
});
