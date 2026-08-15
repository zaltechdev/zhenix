import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  estimateHeadPose,
  axisVelocity,
  HeadMotionFilter,
  DwellClickTracker,
  LANDMARK_INDICES,
  type HeadPose
} from "@/lib/client/vision/head-motion";

function createMockLandmarks(
  noseOffset = { x: 0, y: 0 },
  eyeDistance = 100,
  center = { x: 300, y: 200 }
) {
  const landmarks = new Array(300).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

  const halfEye = eyeDistance / 2;
  // Left eye outer: index 33
  landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER] = {
    x: center.x - halfEye,
    y: center.y,
    z: 0
  };
  // Right eye outer: index 263
  landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER] = {
    x: center.x + halfEye,
    y: center.y,
    z: 0
  };
  // Nose tip: index 1
  landmarks[LANDMARK_INDICES.NOSE_TIP] = {
    x: center.x + noseOffset.x,
    y: center.y + noseOffset.y,
    z: 0
  };

  return landmarks;
}

describe("Head Motion Kinematics Engine", () => {
  describe("Stage 1: Scale-Invariant Head Pose Estimation (estimateHeadPose)", () => {
    it("computes normalized distance-invariant yaw and pitch correctly", () => {
      // 100px inter-ocular distance, nose centered
      const centeredLandmarks = createMockLandmarks({ x: 0, y: 0 }, 100);
      const poseCenter = estimateHeadPose(centeredLandmarks);

      expect(poseCenter.yaw).toBeCloseTo(0, 4);
      expect(poseCenter.pitch).toBeCloseTo(0, 4);
      expect(poseCenter.scale).toBeCloseTo(100, 4);
      expect(poseCenter.roll).toBeCloseTo(0, 4);

      // Nose shifted right by 15px with 100px eye distance -> yaw = 15 / 100 = 0.15
      const rightYawLandmarks = createMockLandmarks({ x: 15, y: -10 }, 100);
      const poseRight = estimateHeadPose(rightYawLandmarks);

      expect(poseRight.yaw).toBeCloseTo(0.15, 4);
      expect(poseRight.pitch).toBeCloseTo(-0.10, 4);
      expect(poseRight.scale).toBeCloseTo(100, 4);
    });

    it("maintains scale-invariance across varying user distances from webcam", () => {
      // User close to camera (200px eye distance), nose turned by 30px -> yaw = 30 / 200 = 0.15
      const closeLandmarks = createMockLandmarks({ x: 30, y: 20 }, 200);
      const poseClose = estimateHeadPose(closeLandmarks);

      // User far from camera (50px eye distance), nose turned by 7.5px -> yaw = 7.5 / 50 = 0.15
      const farLandmarks = createMockLandmarks({ x: 7.5, y: 5 }, 50);
      const poseFar = estimateHeadPose(farLandmarks);

      expect(poseClose.yaw).toBeCloseTo(0.15, 4);
      expect(poseFar.yaw).toBeCloseTo(0.15, 4);
      expect(poseClose.pitch).toBeCloseTo(0.10, 4);
      expect(poseFar.pitch).toBeCloseTo(0.10, 4);
    });

    it("safely handles empty, invalid, or degenerate landmark sets", () => {
      expect(estimateHeadPose(null)).toEqual({ yaw: 0, pitch: 0, roll: 0, scale: 0 });
      expect(estimateHeadPose([])).toEqual({ yaw: 0, pitch: 0, roll: 0, scale: 0 });

      // Zero eye distance
      const degenerateLandmarks = createMockLandmarks({ x: 0, y: 0 }, 0);
      expect(estimateHeadPose(degenerateLandmarks)).toEqual({ yaw: 0, pitch: 0, roll: 0, scale: 0 });
    });
  });

  describe("Stage 2: High-Frequency Landmark Pre-Filter (Single-pole low-pass)", () => {
    it("smooths raw pose stream using alpha = 0.65 exponential smoothing", () => {
      const filter = new HeadMotionFilter();

      const initialPose: HeadPose = { yaw: 0, pitch: 0, roll: 0, scale: 100 };
      const m1 = filter.process(initialPose);
      expect(m1.smoothPose.yaw).toBe(0);

      // Sudden sensor noise jump on frame 2 to yaw = 0.10
      const noisyPose: HeadPose = { yaw: 0.10, pitch: 0, roll: 0, scale: 100 };
      const m2 = filter.process(noisyPose);

      // Expected smoothed yaw = 0 + 0.65 * (0.10 - 0) = 0.065
      expect(m2.smoothPose.yaw).toBeCloseTo(0.065, 4);
      expect(m2.rawPose.yaw).toBe(0.10);
    });
  });

  describe("Stage 3 & 4: Dynamic Deadzone & Non-Linear Velocity Curve", () => {
    it("computes dynamic deadzone based on normalized sensitivity", () => {
      // Sensitivity 10 (min): Sensitivity_norm = 0 -> Deadzone = 0.075
      const vMinSens = axisVelocity(0.070, 0.075, 35);
      expect(vMinSens).toBe(0);

      // Sensitivity 100 (max): Sensitivity_norm = 1 -> Deadzone = 0.040
      const vMaxSens = axisVelocity(0.070, 0.040, 35);
      expect(vMaxSens).toBeGreaterThan(0);
    });

    it("suppresses small physiological sway inside the deadzone strictly to 0", () => {
      const deadzone = 0.0575; // mid sensitivity
      const maxVel = 35;

      expect(axisVelocity(0.02, deadzone, maxVel)).toBe(0);
      expect(axisVelocity(-0.04, deadzone, maxVel)).toBe(0);
      expect(axisVelocity(deadzone, deadzone, maxVel)).toBe(0);
      expect(axisVelocity(-deadzone, deadzone, maxVel)).toBe(0);
    });

    it("applies non-linear power-law curve (gamma = 1.85) when outside deadzone", () => {
      const deadzone = 0.0575;
      const maxVel = 35;

      // Small deflection outside deadzone (e.g. 0.09)
      const vSmall = axisVelocity(0.09, deadzone, maxVel);
      // Large deflection (e.g. 0.22 - full travel)
      const vMax = axisVelocity(0.22, deadzone, maxVel);

      expect(vSmall).toBeGreaterThan(0);
      expect(vMax).toBeCloseTo(maxVel, 3);
      // Verify sub-linear/quadratic precision ramp near boundary
      expect(vSmall / maxVel).toBeLessThan(0.25);
    });
  });

  describe("Stage 5: Continuous Adaptive Neutral Baseline Auto-Recalibration", () => {
    it("recalibrates baseline after > 6 consecutive resting frames", () => {
      const filter = new HeadMotionFilter({ sensitivity: 50, smoothing: 50 });

      // Frame 1: establishes initial baseline at yaw 0
      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });
      expect(filter.getBaseline().yaw).toBe(0);

      // Settle at a slight posture slouch (yaw = 0.03, resting inside deadzone ~0.0575)
      const slouchedPose: HeadPose = { yaw: 0.03, pitch: 0, roll: 0, scale: 100 };

      // Frames 2 to 7 (6 frames resting): Baseline should remain unchanged
      for (let i = 0; i < 6; i++) {
        filter.process(slouchedPose);
      }
      expect(filter.getBaseline().yaw).toBe(0);

      // Frame 8 (>6 consecutive resting frames): Baseline adapts smoothly with alpha = 0.02
      const motion = filter.process(slouchedPose);
      expect(motion.baseline.yaw).toBeGreaterThan(0);
      expect(motion.baseline.yaw).toBeLessThan(0.03);
    });

    it("resets resting counter when deliberate head movement occurs", () => {
      const filter = new HeadMotionFilter({ sensitivity: 50 });

      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });

      // 4 frames resting
      for (let i = 0; i < 4; i++) {
        filter.process({ yaw: 0.02, pitch: 0, roll: 0, scale: 100 });
      }

      // Large deliberate deflection breaks resting state
      filter.process({ yaw: 0.18, pitch: 0, roll: 0, scale: 100 });

      // Resting again for 4 frames (total 8 frames, but streak was interrupted)
      for (let i = 0; i < 4; i++) {
        filter.process({ yaw: 0.02, pitch: 0, roll: 0, scale: 100 });
      }

      // Baseline should still be 0 because streak did not exceed 6 consecutive frames
      expect(filter.getBaseline().yaw).toBe(0);
    });
  });

  describe("Stage 6: Asymmetric EMA Velocity Smoothing & Instant Hard-Braking", () => {
    it("smooths velocity during active motion", () => {
      const filter = new HeadMotionFilter({ sensitivity: 50, smoothing: 50, invertX: false });

      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });

      // Frame with large deflection
      const m1 = filter.process({ yaw: 0.15, pitch: 0, roll: 0, scale: 100 });
      const v1 = m1.vx;

      // Continued deflection
      const m2 = filter.process({ yaw: 0.15, pitch: 0, roll: 0, scale: 100 });
      const v2 = m2.vx;

      expect(v1).toBeGreaterThan(0);
      expect(v2).toBeGreaterThan(v1); // EMA smoothly ramps up towards target velocity
    });

    it("executes asymmetric instant hard-braking when entering deadzone", () => {
      const filter = new HeadMotionFilter({ sensitivity: 50, smoothing: 80, invertX: false });

      // Establish baseline
      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });

      // Move rapidly
      for (let i = 0; i < 5; i++) {
        filter.process({ yaw: 0.20, pitch: 0, roll: 0, scale: 100 });
      }
      expect(filter.getLastMotion()?.vx).toBeGreaterThan(10);

      // Instantly return to neutral deadzone (yaw = 0)
      const neutralMotion = filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });

      // Must be STRICTLY 0 with zero momentum / zero lag
      expect(neutralMotion.vx).toBe(0);
      expect(neutralMotion.dx).toBe(0);
    });
  });

  describe("DwellClickTracker", () => {
    let tracker: DwellClickTracker;
    const mockActivate = vi.fn();
    const mockProgress = vi.fn();
    const mockCancel = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      tracker = new DwellClickTracker({
        dwellDurationMs: 800,
        stabilityRadiusPx: 25,
        cooldownMs: 400,
        onActivate: mockActivate,
        onProgress: mockProgress,
        onCancel: mockCancel
      });
    });

    it("tracks progress smoothly and fires activation upon dwell completion", () => {
      const button = document.createElement("button");

      // Start dwell at t = 1000ms
      const r1 = tracker.process({ x: 100, y: 100 }, 1000, button);
      expect(r1.state).toBe("dwelling");
      expect(r1.progress).toBe(0);

      // Mid-dwell at t = 1400ms (400ms elapsed out of 800ms -> 50% progress)
      const r2 = tracker.process({ x: 105, y: 102 }, 1400, button);
      expect(r2.state).toBe("dwelling");
      expect(r2.progress).toBeCloseTo(0.5, 2);
      expect(mockProgress).toHaveBeenCalled();

      // Dwell complete at t = 1800ms
      const r3 = tracker.process({ x: 102, y: 101 }, 1800, button);
      expect(r3.state).toBe("triggered");
      expect(r3.progress).toBe(1.0);
      expect(mockActivate).toHaveBeenCalledTimes(1);

      // Enter cooldown at t = 1900ms (100ms into 400ms cooldown)
      const r4 = tracker.process({ x: 102, y: 101 }, 1900, button);
      expect(r4.state).toBe("cooldown");
      expect(mockActivate).toHaveBeenCalledTimes(1);

      // Post cooldown at t = 2300ms (cooldown finished -> starts new dwell cycle)
      const r5 = tracker.process({ x: 102, y: 101 }, 2300, button);
      expect(r5.state).toBe("dwelling");
      expect(r5.progress).toBe(0);
    });

    it("resets dwell anchor and progress if pointer moves beyond stability radius", () => {
      const button = document.createElement("button");

      tracker.process({ x: 100, y: 100 }, 1000, button);
      tracker.process({ x: 105, y: 105 }, 1400, button);

      // Pointer jumps 40px away (> 25px stability radius)
      const rJump = tracker.process({ x: 145, y: 100 }, 1500, button);
      expect(rJump.state).toBe("dwelling");
      expect(rJump.progress).toBe(0);
      expect(mockCancel).toHaveBeenCalled();
    });

    it("cancels immediately when disabled", () => {
      tracker.process({ x: 100, y: 100 }, 1000, null, true);
      const rDisabled = tracker.process({ x: 100, y: 100 }, 1200, null, false);

      expect(rDisabled.state).toBe("idle");
      expect(tracker.getState()).toBe("idle");
    });

    it("handles target element switching gracefully", () => {
      const btn1 = document.createElement("button");
      const btn2 = document.createElement("button");

      // Dwell on btn1
      tracker.process({ x: 100, y: 100 }, 1000, btn1);
      tracker.process({ x: 100, y: 100 }, 1400, btn1);

      // Switch to btn2 before completion
      const rSwitch = tracker.process({ x: 100, y: 100 }, 1500, btn2);
      expect(rSwitch.state).toBe("dwelling");
      expect(rSwitch.progress).toBe(0);
      expect(rSwitch.targetElement).toBe(btn2);
    });

    it("updates dwell configuration dynamically", () => {
      tracker.updateConfig({ dwellDurationMs: 400, stabilityRadiusPx: 50, cooldownMs: 200 });

      tracker.process({ x: 100, y: 100 }, 1000, null);
      // At t = 1400ms, elapsed is 400ms = new dwell duration -> should trigger
      const r = tracker.process({ x: 100, y: 100 }, 1400, null);
      expect(r.state).toBe("triggered");
    });
  });

  describe("HeadMotionFilter Configuration & Options", () => {
    it("supports runtime options updates and directional inversion", () => {
      const filter = new HeadMotionFilter({ invertX: false, invertY: true, maxVelocity: 50 });

      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });
      const m1 = filter.process({ yaw: 0.15, pitch: 0.15, roll: 0, scale: 100 });

      // With invertX = false, positive yaw gives positive dx
      expect(m1.dx).toBeGreaterThan(0);
      // With invertY = true, positive pitch gives negative dy
      expect(m1.dy).toBeLessThan(0);

      // Update options
      filter.updateOptions({ invertX: true, invertY: false });
      const m2 = filter.process({ yaw: 0.15, pitch: 0.15, roll: 0, scale: 100 });
      expect(m2.dx).toBeLessThan(0);
      expect(m2.dy).toBeGreaterThan(0);
    });

    it("supports manual recalibration with custom or current baseline", () => {
      const filter = new HeadMotionFilter();

      filter.process({ yaw: 0, pitch: 0, roll: 0, scale: 100 });
      expect(filter.getBaseline().yaw).toBe(0);

      filter.recalibrate({ yaw: 0.10, pitch: -0.05, roll: 0, scale: 100 });
      expect(filter.getBaseline().yaw).toBe(0.10);
      expect(filter.getBaseline().pitch).toBe(-0.05);

      // Reset filter
      filter.reset();
      expect(filter.getSmoothedPose()).toBeNull();
      expect(filter.getLastMotion()).toBeNull();
    });
  });
});
