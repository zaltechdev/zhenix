/**
 * Accessibility-Grade Head Motion Kinematics Engine.
 *
 * Implements a 6-stage mathematical pipeline for jitter-free, scale-invariant,
 * and zero-drift head-tracking cursor control in standard web browsers.
 *
 * 1. Scale-Invariant Head Pose Estimation (Inter-Ocular Distance normalizer)
 * 2. High-Frequency Landmark Pre-Filter (Single-pole low-pass exponential smoothing)
 * 3. Dynamic Deadzone & Physiological Sway Suppression
 * 4. Non-Linear Quadratic Power-Law Velocity Curve (gamma = 1.85)
 * 5. Adaptive Neutral Baseline (Continuous Auto-Recalibration)
 * 6. Asymmetric EMA Velocity Smoothing with Instant Hard-Braking
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface HeadPose {
  /** Yaw angle normalized by inter-ocular distance (-left, +right) */
  yaw: number;
  /** Pitch angle normalized by inter-ocular distance (-up, +down / screen coordinates) */
  pitch: number;
  /** Roll angle in degrees */
  roll: number;
  /** Inter-ocular distance normalizer (D_eye) */
  scale: number;
}

export interface HeadMotion {
  /** Cursor X delta in pixels for current frame */
  dx: number;
  /** Cursor Y delta in pixels for current frame */
  dy: number;
  /** Filtered velocity along X axis (pixels / unit time) */
  vx: number;
  /** Filtered velocity along Y axis (pixels / unit time) */
  vy: number;
  /** Raw un-smoothed head pose */
  rawPose: HeadPose;
  /** Smoothed head pose (Stage 2) */
  smoothPose: HeadPose;
  /** Current adaptive neutral baseline (Stage 5) */
  baseline: HeadPose;
  /** Whether the user's head is resting inside the deadzone */
  isResting: boolean;
}

export interface HeadMotionOptions {
  /**
   * User sensitivity preference in range [10, 100].
   * Controls deadzone size and cursor velocity scaling.
   * Default: 50.
   */
  sensitivity?: number;

  /**
   * Velocity smoothing factor in range [0, 100].
   * Default: 50.
   */
  smoothing?: number;

  /**
   * Maximum cursor velocity at maximum head deflection (pixels per frame).
   * Default: 35.
   */
  maxVelocity?: number;

  /**
   * Invert horizontal axis (mirrors camera yaw to screen cursor dx).
   * Default: true (moving head right moves cursor right).
   */
  invertX?: boolean;

  /**
   * Invert vertical axis.
   * Default: false.
   */
  invertY?: boolean;
}

export const LANDMARK_INDICES = {
  NOSE_TIP: 1,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263
} as const;

/**
 * Stage 1: Scale-Invariant Head Pose Estimation.
 *
 * Extracts 3D facial landmarks from MediaPipe FaceLandmarker, computes the
 * inter-ocular distance D_eye as a scale invariant normalizer, and produces
 * normalized distance-invariant Yaw and Pitch.
 */
export function estimateHeadPose(
  landmarks: Array<{ x: number; y: number; z?: number }> | null | undefined
): HeadPose {
  if (!landmarks || landmarks.length <= LANDMARK_INDICES.RIGHT_EYE_OUTER) {
    return { yaw: 0, pitch: 0, roll: 0, scale: 0 };
  }

  const nose = landmarks[LANDMARK_INDICES.NOSE_TIP];
  const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER];
  const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER];

  if (!nose || !leftEye || !rightEye) {
    return { yaw: 0, pitch: 0, roll: 0, scale: 0 };
  }

  // Inter-Ocular Distance (scale normalizer):
  // D_eye = sqrt((x_right - x_left)^2 + (y_right - y_left)^2)
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const dEye = Math.hypot(dx, dy);

  if (dEye < 1e-6 || !Number.isFinite(dEye)) {
    return { yaw: 0, pitch: 0, roll: 0, scale: 0 };
  }

  // Midpoint between eyes:
  const midEyeX = (leftEye.x + rightEye.x) / 2;
  const midEyeY = (leftEye.y + rightEye.y) / 2;

  // Normalized distance-invariant angles:
  // Yaw = (x_nose - x_mid_eye) / D_eye
  // Pitch = (y_nose - y_mid_eye) / D_eye
  const yaw = (nose.x - midEyeX) / dEye;
  const pitch = (nose.y - midEyeY) / dEye;

  // Roll angle in degrees:
  const roll = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    yaw: Number.isFinite(yaw) ? yaw : 0,
    pitch: Number.isFinite(pitch) ? pitch : 0,
    roll: Number.isFinite(roll) ? roll : 0,
    scale: dEye
  };
}

/**
 * Stages 3 & 4: Dynamic Deadzone Calculation & Non-Linear Power-Law Velocity Curve.
 *
 * Computes axis velocity given displacement from baseline:
 * - Deadzone = 0.075 - (Sensitivity_norm * 0.035)
 * - If |Delta| <= Deadzone, velocity = 0
 * - Travel = clamp((|Delta| - Deadzone) / (0.22 - Deadzone), 0.0, 1.0)
 * - Velocity = sgn(Delta) * (Travel ^ 1.85) * V_max
 */
export function axisVelocity(
  displacement: number,
  deadzone: number,
  maxVelocity: number
): number {
  const absDelta = Math.abs(displacement);

  if (absDelta <= deadzone) {
    return 0;
  }

  const denominator = Math.max(1e-5, 0.22 - deadzone);
  const travel = Math.max(0, Math.min(1, (absDelta - deadzone) / denominator));
  const powerCurve = Math.pow(travel, 1.85);

  return Math.sign(displacement) * powerCurve * maxVelocity;
}

/**
 * HeadMotionFilter executes the complete 6-stage kinematics pipeline.
 */
export class HeadMotionFilter {
  private options: Required<HeadMotionOptions>;

  // Stage 2 state
  private smoothPose: HeadPose | null = null;

  // Stage 5 state
  private baseline: HeadPose = { yaw: 0, pitch: 0, roll: 0, scale: 0 };
  private baselineInitialized = false;
  private consecutiveRestingFrames = 0;

  // Stage 6 state
  private filteredVx = 0;
  private filteredVy = 0;

  private lastMotion: HeadMotion | null = null;

  constructor(options?: HeadMotionOptions) {
    this.options = {
      sensitivity: Math.max(10, Math.min(100, options?.sensitivity ?? 50)),
      smoothing: Math.max(0, Math.min(100, options?.smoothing ?? 50)),
      maxVelocity: Math.max(1, options?.maxVelocity ?? 35),
      invertX: options?.invertX ?? true,
      invertY: options?.invertY ?? false
    };
  }

  /**
   * Update configuration options dynamically at runtime.
   */
  public updateOptions(options: Partial<HeadMotionOptions>): void {
    if (options.sensitivity !== undefined) {
      this.options.sensitivity = Math.max(10, Math.min(100, options.sensitivity));
    }
    if (options.smoothing !== undefined) {
      this.options.smoothing = Math.max(0, Math.min(100, options.smoothing));
    }
    if (options.maxVelocity !== undefined) {
      this.options.maxVelocity = Math.max(1, options.maxVelocity);
    }
    if (options.invertX !== undefined) {
      this.options.invertX = options.invertX;
    }
    if (options.invertY !== undefined) {
      this.options.invertY = options.invertY;
    }
  }

  /**
   * Process a new video frame's facial landmarks or raw head pose.
   *
   * @param input Array of MediaPipe landmarks or pre-calculated HeadPose.
   * @param dt Optional frame delta-time factor (defaults to 1.0 frame step).
   * @returns Calculated HeadMotion containing (dx, dy) and velocity diagnostics.
   */
  public process(
    input: Array<{ x: number; y: number; z?: number }> | HeadPose,
    dt = 1.0
  ): HeadMotion {
    // Stage 1: Scale-Invariant Head Pose Estimation
    const rawPose: HeadPose = Array.isArray(input)
      ? estimateHeadPose(input)
      : { ...input };

    // Stage 2: High-Frequency Landmark Pre-Filter (alpha = 0.65)
    if (!this.smoothPose) {
      this.smoothPose = { ...rawPose };
    } else {
      const alphaPose = 0.65;
      this.smoothPose = {
        yaw: this.smoothPose.yaw + alphaPose * (rawPose.yaw - this.smoothPose.yaw),
        pitch: this.smoothPose.pitch + alphaPose * (rawPose.pitch - this.smoothPose.pitch),
        roll: this.smoothPose.roll + alphaPose * (rawPose.roll - this.smoothPose.roll),
        scale: this.smoothPose.scale + alphaPose * (rawPose.scale - this.smoothPose.scale)
      };
    }

    const isFirstFrame = !this.baselineInitialized;
    if (isFirstFrame) {
      this.baseline = { ...this.smoothPose };
      this.baselineInitialized = true;
      this.consecutiveRestingFrames = 0;
    }

    // Stage 3: Dynamic Deadzone Calculation
    // Sensitivity in [10, 100] -> Sensitivity_norm in [0, 1]
    const sensitivityNorm = (this.options.sensitivity - 10) / 90;
    const deadzone = 0.075 - sensitivityNorm * 0.035;

    // Displacements relative to baseline:
    const deltaYaw = this.smoothPose.yaw - this.baseline.yaw;
    const deltaPitch = this.smoothPose.pitch - this.baseline.pitch;

    const absDeltaYaw = Math.abs(deltaYaw);
    const absDeltaPitch = Math.abs(deltaPitch);

    // Stage 5: Adaptive Neutral Baseline (Continuous Auto-Recalibration)
    // Resting condition: when displacement is resting inside deadzone (|Delta| < 1.15 * Deadzone)
    const isRestingYaw = absDeltaYaw < 1.15 * deadzone;
    const isRestingPitch = absDeltaPitch < 1.15 * deadzone;
    const isResting = isRestingYaw && isRestingPitch;

    if (!isFirstFrame) {
      if (isResting) {
        this.consecutiveRestingFrames++;
        if (this.consecutiveRestingFrames > 6) {
          const recalAlpha = 0.02;
          this.baseline = {
            yaw: this.baseline.yaw + recalAlpha * (this.smoothPose.yaw - this.baseline.yaw),
            pitch: this.baseline.pitch + recalAlpha * (this.smoothPose.pitch - this.baseline.pitch),
            roll: this.baseline.roll,
            scale: this.baseline.scale
          };
        }
      } else {
        this.consecutiveRestingFrames = 0;
      }
    }

    // Recalculate deltas against current baseline
    const currentDeltaYaw = this.smoothPose.yaw - this.baseline.yaw;
    const currentDeltaPitch = this.smoothPose.pitch - this.baseline.pitch;
    const currentRawDeltaYaw = rawPose.yaw - this.baseline.yaw;
    const currentRawDeltaPitch = rawPose.pitch - this.baseline.pitch;

    // If raw pose is inside deadzone, force zero velocity for instant hard braking
    const isRawDeadzoneYaw = Math.abs(currentRawDeltaYaw) <= deadzone;
    const isRawDeadzonePitch = Math.abs(currentRawDeltaPitch) <= deadzone;

    // Stage 4: Non-Linear Quadratic Power-Law Velocity Curve (gamma = 1.85)
    const rawVx = isRawDeadzoneYaw ? 0 : axisVelocity(currentDeltaYaw, deadzone, this.options.maxVelocity);
    const rawVy = isRawDeadzonePitch ? 0 : axisVelocity(currentDeltaPitch, deadzone, this.options.maxVelocity);

    // Stage 6: Asymmetric EMA Velocity Smoothing with Instant Hard-Braking
    const smoothingNorm = this.options.smoothing / 100;
    const alphaV = 0.72 - smoothingNorm * 0.52;

    // X-axis velocity filter
    if (rawVx === 0) {
      this.filteredVx = 0; // Asymmetric zero-inertia hard stop
    } else {
      this.filteredVx = this.filteredVx + alphaV * (rawVx - this.filteredVx);
    }

    // Y-axis velocity filter
    if (rawVy === 0) {
      this.filteredVy = 0; // Asymmetric zero-inertia hard stop
    } else {
      this.filteredVy = this.filteredVy + alphaV * (rawVy - this.filteredVy);
    }

    // Apply directional inversion and frame scaling
    const invertXMult = this.options.invertX ? -1 : 1;
    const invertYMult = this.options.invertY ? -1 : 1;

    const dx = invertXMult * this.filteredVx * dt;
    const dy = invertYMult * this.filteredVy * dt;

    const motion: HeadMotion = {
      dx,
      dy,
      vx: this.filteredVx,
      vy: this.filteredVy,
      rawPose: { ...rawPose },
      smoothPose: { ...this.smoothPose },
      baseline: { ...this.baseline },
      isResting
    };

    this.lastMotion = motion;
    return motion;
  }

  /**
   * Reset filter state to initial un-smoothed state.
   */
  public reset(): void {
    this.smoothPose = null;
    this.baselineInitialized = false;
    this.baseline = { yaw: 0, pitch: 0, roll: 0, scale: 0 };
    this.consecutiveRestingFrames = 0;
    this.filteredVx = 0;
    this.filteredVy = 0;
    this.lastMotion = null;
  }

  /**
   * Explicitly set or recalibrate the neutral baseline position.
   */
  public recalibrate(customBaseline?: HeadPose): void {
    if (customBaseline) {
      this.baseline = { ...customBaseline };
      this.baselineInitialized = true;
    } else if (this.smoothPose) {
      this.baseline = { ...this.smoothPose };
      this.baselineInitialized = true;
    }
    this.consecutiveRestingFrames = 0;
    this.filteredVx = 0;
    this.filteredVy = 0;
  }

  public getBaseline(): Readonly<HeadPose> {
    return { ...this.baseline };
  }

  public getSmoothedPose(): Readonly<HeadPose | null> {
    return this.smoothPose ? { ...this.smoothPose } : null;
  }

  public getLastMotion(): Readonly<HeadMotion | null> {
    return this.lastMotion ? { ...this.lastMotion } : null;
  }
}

export type DwellTrackerState = "idle" | "dwelling" | "triggered" | "cooldown";

export interface DwellProgressInfo {
  state: DwellTrackerState;
  /** Dwell completion ratio from 0.0 to 1.0 */
  progress: number;
  /** Anchor coordinates where dwelling started */
  anchor: { x: number; y: number } | null;
  /** Active target element if provided */
  targetElement: HTMLElement | null;
}

export interface DwellClickOptions {
  /** Dwell duration required to trigger a click in milliseconds (default: 800ms) */
  dwellDurationMs?: number;
  /** Maximum pointer movement radius allowed during dwell in pixels (default: 25px) */
  stabilityRadiusPx?: number;
  /** Cooldown duration after click activation in milliseconds (default: 500ms) */
  cooldownMs?: number;
  /** Callback fired on progress updates */
  onProgress?: (progress: number, pos: { x: number; y: number }, target: HTMLElement | null) => void;
  /** Callback fired when dwell activates */
  onActivate?: (pos: { x: number; y: number }, target: HTMLElement | null) => void;
  /** Callback fired when dwell is cancelled */
  onCancel?: () => void;
}

/**
 * Accessibility-grade Dwell Click Tracker.
 * Manages spatial stability anchoring, continuous progress timing, single trigger activation, and post-activation cooldown.
 */
export class DwellClickTracker {
  private state: DwellTrackerState = "idle";
  private anchor: { x: number; y: number } | null = null;
  private currentTarget: HTMLElement | null = null;
  private stateStartTime = 0;
  private dwellDurationMs: number;
  private stabilityRadiusPx: number;
  private cooldownMs: number;

  private onProgress?: (progress: number, pos: { x: number; y: number }, target: HTMLElement | null) => void;
  private onActivate?: (pos: { x: number; y: number }, target: HTMLElement | null) => void;
  private onCancel?: () => void;

  constructor(options?: DwellClickOptions) {
    this.dwellDurationMs = Math.max(200, options?.dwellDurationMs ?? 800);
    this.stabilityRadiusPx = Math.max(5, options?.stabilityRadiusPx ?? 25);
    this.cooldownMs = Math.max(100, options?.cooldownMs ?? 500);
    this.onProgress = options?.onProgress;
    this.onActivate = options?.onActivate;
    this.onCancel = options?.onCancel;
  }

  /**
   * Update tracker configuration dynamically.
   */
  public updateConfig(options: Partial<DwellClickOptions>): void {
    if (options.dwellDurationMs !== undefined) {
      this.dwellDurationMs = Math.max(200, options.dwellDurationMs);
    }
    if (options.stabilityRadiusPx !== undefined) {
      this.stabilityRadiusPx = Math.max(5, options.stabilityRadiusPx);
    }
    if (options.cooldownMs !== undefined) {
      this.cooldownMs = Math.max(100, options.cooldownMs);
    }
  }

  /**
   * Process a single animation frame or pointer update.
   *
   * @param currentPos Current virtual pointer screen coordinates.
   * @param nowMs Current timestamp in milliseconds (e.g. performance.now()).
   * @param targetElement Optional DOM element currently hovered.
   * @param isEnabled Whether dwell tracking is currently enabled.
   */
  public process(
    currentPos: { x: number; y: number },
    nowMs: number,
    targetElement: HTMLElement | null = null,
    isEnabled = true
  ): DwellProgressInfo {
    if (!isEnabled) {
      if (this.state !== "idle") {
        this.cancel();
      }
      return { state: "idle", progress: 0, anchor: null, targetElement: null };
    }

    // Cooldown state handling
    if (this.state === "cooldown") {
      const elapsed = nowMs - this.stateStartTime;
      if (elapsed < this.cooldownMs) {
        return {
          state: "cooldown",
          progress: 0,
          anchor: this.anchor,
          targetElement: this.currentTarget
        };
      }
      // Cooldown finished -> reset to idle
      this.state = "idle";
      this.anchor = null;
      this.currentTarget = null;
    }

    // If currently idle, establish anchor and begin dwelling
    if (this.state === "idle") {
      this.state = "dwelling";
      this.anchor = { ...currentPos };
      this.currentTarget = targetElement;
      this.stateStartTime = nowMs;
      this.onProgress?.(0, currentPos, targetElement);
      return {
        state: "dwelling",
        progress: 0,
        anchor: this.anchor,
        targetElement: this.currentTarget
      };
    }

    // Check spatial stability against anchor
    if (this.anchor) {
      const dist = Math.hypot(currentPos.x - this.anchor.x, currentPos.y - this.anchor.y);
      if (dist > this.stabilityRadiusPx) {
        // Pointer moved beyond stability threshold -> reset anchor to current position
        this.anchor = { ...currentPos };
        this.currentTarget = targetElement;
        this.stateStartTime = nowMs;
        this.onCancel?.();
        this.onProgress?.(0, currentPos, targetElement);
        return {
          state: "dwelling",
          progress: 0,
          anchor: this.anchor,
          targetElement: this.currentTarget
        };
      }
    }

    // Target element switched
    if (targetElement !== this.currentTarget) {
      this.currentTarget = targetElement;
      this.anchor = { ...currentPos };
      this.stateStartTime = nowMs;
      this.onCancel?.();
      this.onProgress?.(0, currentPos, targetElement);
      return {
        state: "dwelling",
        progress: 0,
        anchor: this.anchor,
        targetElement: this.currentTarget
      };
    }

    // Dwell progress calculation
    const elapsed = nowMs - this.stateStartTime;
    const progress = Math.min(1.0, elapsed / this.dwellDurationMs);

    this.onProgress?.(progress, currentPos, targetElement);

    if (progress >= 1.0) {
      // Dwell triggered!
      this.state = "cooldown";
      this.stateStartTime = nowMs;

      try {
        if (this.onActivate) {
          this.onActivate(currentPos, targetElement);
        } else if (targetElement) {
          targetElement.click();
        }
      } catch {
        // Safe dispatch guard
      }

      return {
        state: "triggered",
        progress: 1.0,
        anchor: this.anchor,
        targetElement: this.currentTarget
      };
    }

    return {
      state: "dwelling",
      progress,
      anchor: this.anchor,
      targetElement: this.currentTarget
    };
  }

  public cancel(): void {
    const wasActive = this.state === "dwelling";
    this.state = "idle";
    this.anchor = null;
    this.currentTarget = null;
    this.stateStartTime = 0;
    if (wasActive) {
      this.onCancel?.();
    }
  }

  public reset(): void {
    this.cancel();
  }

  public getState(): DwellTrackerState {
    return this.state;
  }
}
