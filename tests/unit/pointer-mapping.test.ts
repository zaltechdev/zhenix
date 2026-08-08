import { describe, expect, it } from "vitest";
import {
  smoothCoordinates,
  clampCoordinates,
  clampPoseDelta,
  MAX_PITCH_DELTA_DEGREES,
  MAX_YAW_DELTA_DEGREES,
  PoseInputStabilizer,
  VelocityController,
  defaultDeadZone,
  scaleDeadZone,
  type CalibratedDeadZone
} from "@/lib/client/vision/pointer-mapping";
import type { DirectionalCalibrationRange } from "@/lib/client/vision/calibration";

const DEFAULT_DZ = defaultDeadZone();

function processSeconds(
  controller: VelocityController,
  yaw: number,
  pitch: number,
  deadZone: CalibratedDeadZone,
  range: DirectionalCalibrationRange | null,
  sensitivity: number,
  durationSec: number,
  fps = 60
): { x: number; y: number } {
  const frames = Math.round(durationSec * fps);
  const dt = durationSec / frames;
  let totalX = 0;
  let totalY = 0;
  for (let i = 0; i < frames; i++) {
    const delta = controller.process({ yaw, pitch }, deadZone, range, sensitivity, dt);
    totalX += delta.x;
    totalY += delta.y;
  }
  return { x: totalX, y: totalY };
}

describe("Velocity Controller", () => {
  it("produces zero displacement for stationary noise within dead zone", () => {
    const controller = new VelocityController();
    const noiseValues = [0.1, -0.15, 0.2, -0.1, 0.05, -0.2, 0.15, -0.05, 0.1, -0.1];
    let totalX = 0;
    let totalY = 0;
    for (const noise of noiseValues) {
      const delta = controller.process(
        { yaw: noise, pitch: -noise * 0.8 },
        DEFAULT_DZ,
        null,
        50,
        1 / 60
      );
      totalX += delta.x;
      totalY += delta.y;
    }
    expect(Math.abs(totalX)).toBeLessThan(0.01);
    expect(Math.abs(totalY)).toBeLessThan(0.01);
  });

  it("produces slow monotonic movement for slight intentional deflection", () => {
    const controller = new VelocityController();
    // Camera yaw -2 = physical right (inverted at boundary)
    const result = processSeconds(controller, -2, 0, DEFAULT_DZ, null, 50, 1);
    expect(result.x).toBeGreaterThan(10);
    expect(result.x).toBeLessThan(800);
  });

  it("produces faster movement for larger deflection", () => {
    const controllerSlow = new VelocityController();
    const controllerFast = new VelocityController();
    const slow = processSeconds(controllerSlow, -2, 0, DEFAULT_DZ, null, 50, 1);
    const fast = processSeconds(controllerFast, -8, 0, DEFAULT_DZ, null, 50, 1);
    expect(fast.x).toBeGreaterThan(slow.x * 2);
  });

  it("caps speed at configured maximum", () => {
    const controller = new VelocityController();
    // Extreme deflection at max sensitivity
    const delta = controller.process({ yaw: -20, pitch: 0 }, DEFAULT_DZ, null, 100, 1 / 60);
    // Max speed at sensitivity 100 = 2400 px/sec, per frame at 60fps = 40px max
    expect(Math.abs(delta.x)).toBeLessThanOrEqual(41);
  });

  it("returns velocity to zero when pose returns to neutral", () => {
    const controller = new VelocityController();
    // Move right
    controller.process({ yaw: -5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    controller.process({ yaw: -5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    // Return to neutral
    const atRest = controller.process({ yaw: 0, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(atRest.x).toBe(0);
    expect(atRest.y).toBe(0);
  });

  it("maintains dead-zone hysteresis without start/stop chatter", () => {
    const controller = new VelocityController();
    // Start below enter threshold
    const d1 = controller.process({ yaw: -0.5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(d1.x).toBe(0);

    // Cross enter threshold
    const d2 = controller.process({ yaw: -1.5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(d2.x).toBeGreaterThan(0); // moving right

    // Drop below enter but above exit threshold
    const d3 = controller.process({ yaw: -0.7, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(d3.x).toBeGreaterThan(0); // still engaged due to hysteresis

    // Drop below exit threshold
    const d4 = controller.process({ yaw: -0.3, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(d4.x).toBe(0); // disengaged
  });

  it("handles asymmetric calibration ranges", () => {
    const controller = new VelocityController();
    const asymmetricRange: DirectionalCalibrationRange = {
      left: 15, right: 5, up: 10, down: 10
    };
    // Same deflection magnitude in both directions
    const left = processSeconds(controller, 5, 0, DEFAULT_DZ, asymmetricRange, 50, 1);
    controller.reset();
    const right = processSeconds(controller, -5, 0, DEFAULT_DZ, asymmetricRange, 50, 1);
    // Both directions produce meaningful movement
    expect(Math.abs(left.x)).toBeGreaterThan(10);
    expect(Math.abs(right.x)).toBeGreaterThan(10);
  });

  it("produces same displacement at different frame rates for the same wall time", () => {
    const controller30 = new VelocityController();
    const controller60 = new VelocityController();
    const result30 = processSeconds(controller30, -5, 0, DEFAULT_DZ, null, 50, 2, 30);
    const result60 = processSeconds(controller60, -5, 0, DEFAULT_DZ, null, 50, 2, 60);
    // Should be within 5% of each other
    expect(Math.abs(result30.x - result60.x) / Math.max(result60.x, 1)).toBeLessThan(0.05);
  });

  it("inverts camera yaw correctly for screen direction", () => {
    const controller = new VelocityController();
    // Camera yaw negative = physical right turn = positive screen X
    const right = controller.process({ yaw: -5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    controller.reset();
    const left = controller.process({ yaw: 5, pitch: 0 }, DEFAULT_DZ, null, 50, 1 / 60);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
  });

  it("higher sensitivity produces more displacement", () => {
    const controllerLow = new VelocityController();
    const controllerHigh = new VelocityController();
    const low = processSeconds(controllerLow, -5, 0, DEFAULT_DZ, null, 20, 1);
    const high = processSeconds(controllerHigh, -5, 0, DEFAULT_DZ, null, 80, 1);
    expect(high.x).toBeGreaterThan(low.x * 1.5);
  });
});

describe("Dead Zone Scaling", () => {
  it("multiplies calibrated zone by user preference", () => {
    const base: CalibratedDeadZone = {
      yawEnter: 1.0, yawExit: 0.6, pitchEnter: 0.8, pitchExit: 0.5
    };
    const scaled = scaleDeadZone(base, 100); // 2x
    expect(scaled.yawEnter).toBeCloseTo(2.0);
    expect(scaled.yawExit).toBeCloseTo(1.2);
  });

  it("eliminates dead zone at setting 0", () => {
    const base = defaultDeadZone();
    const scaled = scaleDeadZone(base, 0);
    expect(scaled.yawEnter).toBe(0);
    expect(scaled.pitchEnter).toBe(0);
  });

  it("preserves calibrated zone at setting 50", () => {
    const base: CalibratedDeadZone = {
      yawEnter: 1.0, yawExit: 0.6, pitchEnter: 0.8, pitchExit: 0.5
    };
    const scaled = scaleDeadZone(base, 50);
    expect(scaled.yawEnter).toBeCloseTo(1.0);
  });
});

describe("Pose Input Stabilizer", () => {
  it("rejects a single-frame pose spike and resumes from the accepted pose", () => {
    const stabilizer = new PoseInputStabilizer();
    stabilizer.process({ yaw: 0, pitch: 0 });

    const rejected = stabilizer.process({ yaw: 80, pitch: -80 });
    const recovered = stabilizer.process({ yaw: 0, pitch: 0 });

    expect(rejected).toMatchObject({ yaw: 0, pitch: 0, spikeRejected: true });
    expect(recovered).toMatchObject({ yaw: 0, pitch: 0, spikeRejected: false });
  });

  it("clamps implausible pose input before it can reach the mapper", () => {
    expect(clampPoseDelta({ yaw: 90, pitch: -90 })).toEqual({
      yaw: MAX_YAW_DELTA_DEGREES,
      pitch: -MAX_PITCH_DELTA_DEGREES
    });
  });
});

describe("Smoothing and Clamping", () => {
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

  it("clamps coordinates strictly inside viewport with edge inset", () => {
    const overflowPos = { x: 2000, y: -500 };
    const clamped = clampCoordinates(overflowPos, 1920, 1080);

    expect(clamped).toEqual({ x: 1904, y: 16 });
  });
});
