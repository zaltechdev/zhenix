import { describe, expect, it } from "vitest";
import { CalibrationEngine } from "@/lib/client/vision/calibration";

describe("CalibrationEngine (Instant One-Click & Auto Calibration)", () => {
  it("executes instant single-frame calibration from current head pose", () => {
    const engine = new CalibrationEngine();
    const attemptId = engine.start();

    const pose = { yaw: 2.5, pitch: -1.0, roll: 0.5 };
    const state = engine.calibrate(pose, attemptId);

    expect(state.status).toBe("completed");
    expect(state.progressRatio).toBe(1.0);
    expect(state.baseline).toEqual({ yaw: 2.5, pitch: -1.0, roll: 0.5 });
    expect(state.range).toEqual({ left: 10, right: 10, up: 10, down: 10 });
    expect(state.deadZone).toMatchObject({
      yawEnter: 1.25,
      yawExit: 0.65,
      pitchEnter: 1.25,
      pitchExit: 0.65
    });
  });

  it("calibrates immediately on addSample in 1 frame", () => {
    const engine = new CalibrationEngine();
    const attemptId = engine.start();

    const pose = { yaw: 0, pitch: 0, roll: 0 };
    const state = engine.addSample(pose, 100, attemptId);

    expect(state.status).toBe("completed");
    expect(state.baseline).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    expect(state.samplesCount).toBe(1);
  });

  it("rejects invalid or non-finite poses gracefully", () => {
    const engine = new CalibrationEngine();
    const attemptId = engine.start();

    const state = engine.calibrate({ yaw: Number.NaN, pitch: 0, roll: 0 }, attemptId);
    expect(state.status).toBe("failed");
    expect(state.errorMessage).toBe("invalid_calibration");
  });

  it("resets state on cancel", () => {
    const engine = new CalibrationEngine();
    engine.start();
    engine.cancel();

    expect(engine.getState()).toMatchObject({
      status: "idle",
      baseline: null,
      range: null,
      deadZone: null
    });
  });

  it("fails with specified reason on fail()", () => {
    const engine = new CalibrationEngine();
    const attemptId = engine.start();
    const state = engine.fail("tracking_lost", attemptId);

    expect(state.status).toBe("failed");
    expect(state.errorMessage).toBe("tracking_lost");
  });
});
