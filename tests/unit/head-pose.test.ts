import { describe, expect, it } from "vitest";
import {
  extractPoseFromMatrix,
  extractPoseFromLandmarks,
  computePoseDelta,
  LandmarkPoint
} from "@/lib/client/vision/head-pose";

describe("Head Pose Math Engine", () => {
  it("extracts pose from matrix correctly", () => {
    // Identity matrix: 0 yaw, 0 pitch, 0 roll
    const identity = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    const pose = extractPoseFromMatrix(identity);
    expect(pose.yaw).toBeCloseTo(0);
    expect(pose.pitch).toBeCloseTo(0);
    expect(pose.roll).toBeCloseTo(0);
  });

  it("handles short or invalid matrix data gracefully", () => {
    const invalid = new Float32Array([1, 0, 0]);
    const pose = extractPoseFromMatrix(invalid);
    expect(pose).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it("extracts pose from landmark vectors fallback", () => {
    // Mock landmarks array with 264 points
    const mockLandmarks: LandmarkPoint[] = Array.from({ length: 300 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

    // Nose tip: 1, Left eye: 33, Right eye: 263, Chin: 152, Forehead: 10
    mockLandmarks[1] = { x: 0.5, y: 0.5, z: 0 };
    mockLandmarks[33] = { x: 0.4, y: 0.4, z: 0 };
    mockLandmarks[263] = { x: 0.6, y: 0.4, z: 0 };
    mockLandmarks[152] = { x: 0.5, y: 0.7, z: 0 };
    mockLandmarks[10] = { x: 0.5, y: 0.2, z: 0 };

    const pose = extractPoseFromLandmarks(mockLandmarks);
    expect(typeof pose.yaw).toBe("number");
    expect(typeof pose.pitch).toBe("number");
    expect(typeof pose.roll).toBe("number");
    expect(isNaN(pose.yaw)).toBe(false);
  });

  it("computes delta relative to neutral baseline baseline correctly", () => {
    const current = { yaw: 10, pitch: -5, roll: 2 };
    const baseline = { yaw: 2, pitch: 5, roll: 0 };

    const delta = computePoseDelta(current, baseline);
    expect(delta).toEqual({ yaw: 8, pitch: -10, roll: 2 });
  });
});
