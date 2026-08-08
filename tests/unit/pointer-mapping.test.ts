import { describe, expect, it } from "vitest";
import {
  applyDeadZone,
  mapPoseToScreenDelta,
  smoothCoordinates,
  clampCoordinates,
  clampPoseDelta,
  mapCameraPoseToScreenDelta,
  MAX_PITCH_DELTA_DEGREES,
  MAX_YAW_DELTA_DEGREES,
  PoseInputStabilizer
} from "@/lib/client/vision/pointer-mapping";

describe("Pointer Mapping Math", () => {
  it("rejects small movement within dead zone", () => {
    // 20% dead zone threshold (~0.8 degrees)
    const smallYaw = 0.4;
    const adjusted = applyDeadZone(smallYaw, 20);
    expect(adjusted).toBe(0);
  });

  it("passes movements beyond dead zone", () => {
    const largeYaw = 5.0;
    const adjusted = applyDeadZone(largeYaw, 20);
    expect(adjusted).toBeGreaterThan(0);
  });

  it("increases reach when sensitivity is high", () => {
    const lowSensDelta = mapPoseToScreenDelta(10, 5, 10, 0);
    const highSensDelta = mapPoseToScreenDelta(10, 5, 90, 0);

    expect(Math.abs(highSensDelta.x)).toBeGreaterThan(Math.abs(lowSensDelta.x));
    expect(Math.abs(highSensDelta.y)).toBeGreaterThan(Math.abs(lowSensDelta.y));
  });

  it("maps MediaPipe camera yaw to physical screen direction at the pointer boundary", () => {
    // MediaPipe camera-space yaw is negative for a physical right turn.
    const physicalRight = mapCameraPoseToScreenDelta(-8, 0, 50, 0, 1280, 720);
    const physicalLeft = mapCameraPoseToScreenDelta(8, 0, 50, 0, 1280, 720);

    expect(physicalRight.x).toBeGreaterThan(0);
    expect(physicalLeft.x).toBeLessThan(0);
  });

  it("reaches every screen region without hard-clamping into an edge", () => {
    const width = 1280;
    const height = 720;
    const topRight = mapPoseToScreenDelta(20, -10, 75, 0, width, height);
    const topLeft = mapPoseToScreenDelta(-20, -10, 75, 0, width, height);
    const bottomRight = mapPoseToScreenDelta(20, 10, 75, 0, width, height);
    const bottomLeft = mapPoseToScreenDelta(-20, 10, 75, 0, width, height);

    expect(topRight).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(topRight.x).toBeGreaterThan(width / 4);
    expect(topRight.y).toBeLessThan(-height / 4);
    expect(topLeft.x).toBeLessThan(-width / 4);
    expect(topLeft.y).toBeLessThan(-height / 4);
    expect(bottomRight.x).toBeGreaterThan(width / 4);
    expect(bottomRight.y).toBeGreaterThan(height / 4);
    expect(bottomLeft.x).toBeLessThan(-width / 4);
    expect(bottomLeft.y).toBeGreaterThan(height / 4);
    for (const point of [topRight, topLeft, bottomRight, bottomLeft]) {
      expect(Math.abs(point.x)).toBeLessThan(width / 2);
      expect(Math.abs(point.y)).toBeLessThan(height / 2);
    }
  });

  it("clamps implausible pose input before it can reach the pointer mapper", () => {
    expect(clampPoseDelta({ yaw: 90, pitch: -90 })).toEqual({
      yaw: MAX_YAW_DELTA_DEGREES,
      pitch: -MAX_PITCH_DELTA_DEGREES
    });

    expect(mapPoseToScreenDelta(90, 90, 90, 0, 1280, 720)).toEqual(
      mapPoseToScreenDelta(MAX_YAW_DELTA_DEGREES, MAX_PITCH_DELTA_DEGREES, 90, 0, 1280, 720)
    );
  });

  it("rejects a single-frame pose spike and resumes from the accepted pose", () => {
    const stabilizer = new PoseInputStabilizer();
    stabilizer.process({ yaw: 0, pitch: 0 }, 0);

    const rejected = stabilizer.process({ yaw: 80, pitch: -80 }, 0);
    const recovered = stabilizer.process({ yaw: 0, pitch: 0 }, 0);

    expect(rejected).toMatchObject({ yaw: 0, pitch: 0, spikeRejected: true });
    expect(recovered).toMatchObject({ yaw: 0, pitch: 0, spikeRejected: false });
  });

  it("holds a dead zone through stationary jitter until the lower release threshold", () => {
    const stabilizer = new PoseInputStabilizer();
    const deadZone = 50;

    expect(stabilizer.process({ yaw: 0.8, pitch: -0.8 }, deadZone).yaw).toBe(0);
    expect(stabilizer.process({ yaw: 2.2, pitch: 0 }, deadZone).yaw).toBeGreaterThan(0);
    expect(stabilizer.process({ yaw: 1.7, pitch: 0 }, deadZone).yaw).toBeGreaterThan(0);
    expect(stabilizer.process({ yaw: 1.4, pitch: 0 }, deadZone).yaw).toBe(0);
  });

  it("smooths coordinates without latency divergence", () => {
    const current = { x: 100, y: 100 };
    const target = { x: 200, y: 200 };

    const smoothed1 = smoothCoordinates(current, target, 40, 16.6);
    expect(smoothed1.x).toBeGreaterThan(100);
    expect(smoothed1.x).toBeLessThan(200);

    // After multiple steps, it converges to target
    let pos = { ...current };
    for (let i = 0; i < 10; i++) {
      pos = smoothCoordinates(pos, target, 40, 16.6);
    }
    expect(pos.x).toBeGreaterThan(190);
  });

  it("raises smoothing responsiveness during fast deliberate movement", () => {
    const stationaryStep = smoothCoordinates({ x: 0, y: 0 }, { x: 2, y: 0 }, 80, 16.6, 0.05);
    const fastStep = smoothCoordinates({ x: 0, y: 0 }, { x: 200, y: 0 }, 80, 16.6, 0.95);

    expect(fastStep.x / 200).toBeGreaterThan(stationaryStep.x / 2);
  });

  it("suppresses stationary target jitter without slowing a deliberate movement", () => {
    let stationaryPosition = { x: 640, y: 360 };
    const jitterTargets = [642, 638, 643, 639, 641, 637, 642, 640];
    for (const x of jitterTargets) {
      stationaryPosition = smoothCoordinates(stationaryPosition, { x, y: 360 }, 40, 16.6, 0.08);
    }

    const deliberateStep = smoothCoordinates(
      stationaryPosition,
      { x: 900, y: 360 },
      40,
      16.6,
      0.95
    );

    expect(Math.abs(stationaryPosition.x - 640)).toBeLessThan(2);
    expect(deliberateStep.x - stationaryPosition.x).toBeGreaterThan(150);
  });

  it("clamps coordinates strictly inside viewport", () => {
    const overflowPos = { x: 2000, y: -500 };
    const clamped = clampCoordinates(overflowPos, 1920, 1080);

    expect(clamped).toEqual({ x: 1920, y: 0 });
  });
});
