import { describe, expect, it } from "vitest";
import {
  applyDeadZone,
  mapPoseToScreenDelta,
  smoothCoordinates,
  clampCoordinates
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

    expect(highSensDelta.x).toBeGreaterThan(lowSensDelta.x);
    expect(highSensDelta.y).toBeGreaterThan(lowSensDelta.y);
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

  it("clamps coordinates strictly inside viewport", () => {
    const overflowPos = { x: 2000, y: -500 };
    const clamped = clampCoordinates(overflowPos, 1920, 1080);

    expect(clamped).toEqual({ x: 1920, y: 0 });
  });
});
