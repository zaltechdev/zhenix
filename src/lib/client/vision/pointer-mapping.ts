import type { DirectionalCalibrationRange } from "./calibration";

/**
 * Velocity-based pointer mapping engine. Head pose deflection controls pointer
 * VELOCITY, not absolute screen position. Pure math, refresh-rate independent.
 */

export interface MappingConfig {
  /** Pointer sensitivity (0 to 100) */
  sensitivity: number;
  /** Dead zone threshold (0 to 100) */
  deadZone: number;
  /** Smoothing factor (0 to 100) */
  smoothing: number;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Viewport height in pixels */
  viewportHeight: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface PoseDelta {
  yaw: number;
  pitch: number;
}

export interface StabilizedPoseInput extends PoseDelta {
  spikeRejected: boolean;
  motionDegrees: number;
  motionResponse: number;
}

export const MAX_YAW_DELTA_DEGREES = 24;
export const MAX_PITCH_DELTA_DEGREES = 18;

/**
 * MediaPipe transformation matrices use camera-space yaw. In that coordinate
 * system a physical right turn is negative, while Aksa screen x increases
 * rightward. Keep this conversion at the camera-pose to pointer boundary.
 */
export const CAMERA_YAW_TO_SCREEN_DIRECTION = -1;

const MAX_YAW_FRAME_CHANGE_DEGREES = 8;
const MAX_PITCH_FRAME_CHANGE_DEGREES = 6;
const SPIKE_CONFIRM_TOLERANCE_DEGREES = 4;
const POINTER_EDGE_INSET_PX = 16;

/** Minimum calibrated dead zone per axis in degrees. */
export const MIN_DEAD_ZONE_DEGREES = 0.3;
/** Maximum calibrated dead zone per axis in degrees. */
export const MAX_DEAD_ZONE_DEGREES = 3.0;
/** Default dead zone when no calibration exists. */
export const DEFAULT_DEAD_ZONE_DEGREES = 0.8;

/** Minimum maximum speed (sensitivity = 0). */
const MIN_MAX_SPEED_PX_PER_SEC = 300;
/** Maximum maximum speed (sensitivity = 100). */
const MAX_MAX_SPEED_PX_PER_SEC = 2400;
/** Default comfortable range when uncalibrated. */
const DEFAULT_COMFORTABLE_RANGE_DEGREES = 10;
/** Gentle acceleration curve exponent near dead-zone boundary. */
const ACCELERATION_EXPONENT = 1.8;

function normalizeSetting(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function clampAxis(value: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-maximum, Math.min(maximum, value));
}

/**
 * Bound source pose deltas to a comfortable range before they can affect the pointer.
 */
export function clampPoseDelta(input: PoseDelta): PoseDelta {
  return {
    yaw: clampAxis(input.yaw, MAX_YAW_DELTA_DEGREES),
    pitch: clampAxis(input.pitch, MAX_PITCH_DELTA_DEGREES)
  };
}

/** Per-axis calibrated dead zone thresholds in degrees. */
export interface CalibratedDeadZone {
  yawEnter: number;
  yawExit: number;
  pitchEnter: number;
  pitchExit: number;
}

/** Build a default dead zone when no calibration data exists. */
export function defaultDeadZone(): CalibratedDeadZone {
  return {
    yawEnter: DEFAULT_DEAD_ZONE_DEGREES,
    yawExit: DEFAULT_DEAD_ZONE_DEGREES * 0.6,
    pitchEnter: DEFAULT_DEAD_ZONE_DEGREES,
    pitchExit: DEFAULT_DEAD_ZONE_DEGREES * 0.6
  };
}

/**
 * Scale a calibrated dead zone by a user preference slider (0-100).
 * 50 = use calibrated zone as-is. 0 = no dead zone. 100 = 2x calibrated zone.
 */
export function scaleDeadZone(
  calibrated: CalibratedDeadZone,
  deadZoneSetting: number
): CalibratedDeadZone {
  const normalized = normalizeSetting(deadZoneSetting);
  const multiplier = normalized / 50; // 0 -> 0x, 50 -> 1x, 100 -> 2x
  return {
    yawEnter: calibrated.yawEnter * multiplier,
    yawExit: calibrated.yawExit * multiplier,
    pitchEnter: calibrated.pitchEnter * multiplier,
    pitchExit: calibrated.pitchExit * multiplier
  };
}

class AxisDeadZoneHysteresis {
  private isEngaged = false;

  public apply(value: number, enterThreshold: number, exitThreshold: number): number {
    if (enterThreshold <= 0) {
      this.isEngaged = false;
      return value;
    }

    const magnitude = Math.abs(value);

    if (!this.isEngaged) {
      if (magnitude <= enterThreshold) {
        return 0;
      }
      this.isEngaged = true;
    } else if (magnitude < exitThreshold) {
      this.isEngaged = false;
      return 0;
    }

    // Smooth ramp from dead-zone boundary: subtract exit threshold, normalize
    const effective = magnitude - exitThreshold;
    return Math.sign(value) * effective;
  }

  public reset(): void {
    this.isEngaged = false;
  }
}

/**
 * Keeps short-lived pose outliers out of the pointer path without delaying continued movement.
 */
export class PoseInputStabilizer {
  private lastAccepted: PoseDelta | null = null;
  private pendingSpike: PoseDelta | null = null;
  private filteredPose: PoseDelta | null = null;

  public process(
    input: PoseDelta,
    smoothingSetting = 0,
    deltaTimeMs = 16.6
  ): StabilizedPoseInput {
    const bounded = clampPoseDelta(input);
    const accepted = this.acceptOrHold(bounded);
    const filtered = this.filterPose(
      accepted.pose,
      accepted.motionDegrees,
      smoothingSetting,
      deltaTimeMs
    );

    return {
      yaw: filtered.pose.yaw,
      pitch: filtered.pose.pitch,
      spikeRejected: accepted.spikeRejected,
      motionDegrees: accepted.motionDegrees,
      motionResponse: filtered.motionResponse
    };
  }

  public reset(): void {
    this.lastAccepted = null;
    this.pendingSpike = null;
    this.filteredPose = null;
  }

  private acceptOrHold(next: PoseDelta): {
    pose: PoseDelta;
    spikeRejected: boolean;
    motionDegrees: number;
  } {
    if (!this.lastAccepted) {
      this.lastAccepted = next;
      return { pose: next, spikeRejected: false, motionDegrees: 0 };
    }

    const previous = this.lastAccepted;
    if (this.isPlausibleStep(previous, next)) {
      this.lastAccepted = next;
      this.pendingSpike = null;
      return {
        pose: next,
        spikeRejected: false,
        motionDegrees: Math.hypot(next.yaw - previous.yaw, next.pitch - previous.pitch)
      };
    }

    if (
      this.pendingSpike &&
      (this.isNear(this.pendingSpike, next) ||
        this.isContinuedMotion(this.lastAccepted, this.pendingSpike, next))
    ) {
      this.lastAccepted = next;
      this.pendingSpike = null;
      return {
        pose: next,
        spikeRejected: false,
        motionDegrees: Math.hypot(next.yaw - previous.yaw, next.pitch - previous.pitch)
      };
    }

    this.pendingSpike = next;
    return { pose: previous, spikeRejected: true, motionDegrees: 0 };
  }

  private filterPose(
    target: PoseDelta,
    motionDegrees: number,
    smoothingSetting: number,
    deltaTimeMs: number
  ): { pose: PoseDelta; motionResponse: number } {
    const smoothing = normalizeSetting(smoothingSetting);
    const speedDegreesPerMs = motionDegrees / Math.max(deltaTimeMs, 1);
    const motionResponse = speedDegreesPerMs / (speedDegreesPerMs + 0.12);

    if (smoothing === 0) {
      this.filteredPose = target;
      return { pose: target, motionResponse };
    }

    if (!this.filteredPose) {
      this.filteredPose = target;
      return { pose: target, motionResponse: 0 };
    }

    const stationaryAlpha = 0.1 + (1 - smoothing / 100) * 0.18;
    const adaptiveAlpha = stationaryAlpha + (0.82 - stationaryAlpha) * motionResponse;
    const timeFactor = Math.min(deltaTimeMs / 16.6, 3);
    const alpha = 1 - Math.pow(1 - adaptiveAlpha, timeFactor);

    this.filteredPose = {
      yaw: this.filteredPose.yaw + alpha * (target.yaw - this.filteredPose.yaw),
      pitch: this.filteredPose.pitch + alpha * (target.pitch - this.filteredPose.pitch)
    };

    return { pose: this.filteredPose, motionResponse };
  }

  private isPlausibleStep(previous: PoseDelta, next: PoseDelta): boolean {
    return (
      Math.abs(next.yaw - previous.yaw) <= MAX_YAW_FRAME_CHANGE_DEGREES &&
      Math.abs(next.pitch - previous.pitch) <= MAX_PITCH_FRAME_CHANGE_DEGREES
    );
  }

  private isNear(previous: PoseDelta, next: PoseDelta): boolean {
    return (
      Math.abs(next.yaw - previous.yaw) <= SPIKE_CONFIRM_TOLERANCE_DEGREES &&
      Math.abs(next.pitch - previous.pitch) <= SPIKE_CONFIRM_TOLERANCE_DEGREES
    );
  }

  private isContinuedMotion(previous: PoseDelta, candidate: PoseDelta, next: PoseDelta): boolean {
    const yawFirstStep = candidate.yaw - previous.yaw;
    const yawSecondStep = next.yaw - candidate.yaw;
    const pitchFirstStep = candidate.pitch - previous.pitch;
    const pitchSecondStep = next.pitch - candidate.pitch;

    const continuesYaw =
      Math.abs(yawFirstStep) > 0.5 &&
      Math.abs(yawSecondStep) > 0.5 &&
      Math.sign(yawFirstStep) === Math.sign(yawSecondStep);
    const continuesPitch =
      Math.abs(pitchFirstStep) > 0.5 &&
      Math.abs(pitchSecondStep) > 0.5 &&
      Math.sign(pitchFirstStep) === Math.sign(pitchSecondStep);

    return continuesYaw || continuesPitch;
  }
}

/**
 * Velocity-based head control engine. Head pose deflection beyond a calibrated
 * dead zone produces pointer VELOCITY proportional to deflection magnitude.
 * Velocity is integrated using real frame delta time for refresh-rate independence.
 *
 * Conceptual pipeline:
 *   pose delta (from neutral)
 *   -> camera yaw inversion
 *   -> per-axis dead zone with hysteresis
 *   -> normalize within calibrated comfortable range
 *   -> bounded monotonic velocity curve
 *   -> integrate velocity * dt
 *   -> pointer position delta
 */
export class VelocityController {
  private readonly yawDeadZone = new AxisDeadZoneHysteresis();
  private readonly pitchDeadZone = new AxisDeadZoneHysteresis();

  /**
   * Process a stabilized pose delta into a pointer position delta.
   *
   * @param poseDelta - Stabilized yaw/pitch delta from neutral (camera-space)
   * @param deadZone - Per-axis calibrated dead zone (already scaled by user preference)
   * @param range - Calibrated comfortable directional ranges (null = use defaults)
   * @param sensitivitySetting - 0-100 user preference controlling max speed
   * @param deltaTimeSec - Frame delta time in seconds
   * @returns Position delta to add to current pointer position
   */
  public process(
    poseDelta: PoseDelta,
    deadZone: CalibratedDeadZone,
    range: DirectionalCalibrationRange | null,
    sensitivitySetting: number,
    deltaTimeSec: number
  ): Vector2D {
    // Invert camera yaw for screen direction
    const screenYaw = poseDelta.yaw * CAMERA_YAW_TO_SCREEN_DIRECTION;
    const screenPitch = poseDelta.pitch;

    // Per-axis dead zone with hysteresis
    const activeYaw = this.yawDeadZone.apply(screenYaw, deadZone.yawEnter, deadZone.yawExit);
    const activePitch = this.pitchDeadZone.apply(screenPitch, deadZone.pitchEnter, deadZone.pitchExit);

    if (activeYaw === 0 && activePitch === 0) {
      return { x: 0, y: 0 };
    }

    // Directional comfortable ranges (degrees beyond dead zone boundary)
    const rangeLeft = Math.max(
      (range?.left ?? DEFAULT_COMFORTABLE_RANGE_DEGREES) - deadZone.yawExit,
      1
    );
    const rangeRight = Math.max(
      (range?.right ?? DEFAULT_COMFORTABLE_RANGE_DEGREES) - deadZone.yawExit,
      1
    );
    const rangeUp = Math.max(
      (range?.up ?? DEFAULT_COMFORTABLE_RANGE_DEGREES) - deadZone.pitchExit,
      1
    );
    const rangeDown = Math.max(
      (range?.down ?? DEFAULT_COMFORTABLE_RANGE_DEGREES) - deadZone.pitchExit,
      1
    );

    // Normalize to 0..1 within comfortable range, clamp at 1
    const normalizedYaw = activeYaw >= 0
      ? Math.min(activeYaw / rangeRight, 1)
      : -Math.min(Math.abs(activeYaw) / rangeLeft, 1);
    const normalizedPitch = activePitch >= 0
      ? Math.min(activePitch / rangeDown, 1)
      : -Math.min(Math.abs(activePitch) / rangeUp, 1);

    // Bounded monotonic velocity curve with gentle acceleration near boundary
    const velocityYaw = Math.sign(normalizedYaw)
      * Math.pow(Math.abs(normalizedYaw), ACCELERATION_EXPONENT);
    const velocityPitch = Math.sign(normalizedPitch)
      * Math.pow(Math.abs(normalizedPitch), ACCELERATION_EXPONENT);

    // Max speed from sensitivity setting
    const maxSpeed = MIN_MAX_SPEED_PX_PER_SEC
      + (normalizeSetting(sensitivitySetting) / 100)
        * (MAX_MAX_SPEED_PX_PER_SEC - MIN_MAX_SPEED_PX_PER_SEC);

    // Integrate velocity over time
    return {
      x: velocityYaw * maxSpeed * deltaTimeSec,
      y: velocityPitch * maxSpeed * deltaTimeSec
    };
  }

  public reset(): void {
    this.yawDeadZone.reset();
    this.pitchDeadZone.reset();
  }
}

/**
 * Temporal exponential low-pass filter smoothing for pointer coordinates.
 * Time-aware smoothing prevents lag on high refresh rates and jitter on variable frame rates.
 */
export function smoothCoordinates(
  current: Vector2D,
  target: Vector2D,
  smoothingSetting: number,
  deltaTimeMs: number,
  motionResponse?: number
): Vector2D {
  if (deltaTimeMs <= 0) {
    return current;
  }

  // Adaptive EMA: use target velocity rather than pointer error whenever available.
  // That keeps a stationary head stable while the pointer finishes settling.
  const stationaryAlpha = 0.08 + (1 - normalizeSetting(smoothingSetting) / 100) * 0.26;
  const fallbackSpeed = Math.hypot(target.x - current.x, target.y - current.y) / deltaTimeMs;
  const fallbackResponse = fallbackSpeed / (fallbackSpeed + 1.2);
  const adaptiveResponse = Math.max(0, Math.min(1, motionResponse ?? fallbackResponse));
  const adaptiveAlpha = stationaryAlpha + (0.88 - stationaryAlpha) * adaptiveResponse;

  // Adjust alpha for delta time (normalized to 60fps = 16.6ms)
  const timeFactor = Math.min(deltaTimeMs / 16.6, 3.0);
  const alpha = Math.min(Math.max(1 - Math.pow(1 - adaptiveAlpha, timeFactor), 0.05), 1.0);

  return {
    x: current.x + alpha * (target.x - current.x),
    y: current.y + alpha * (target.y - current.y)
  };
}

/**
 * Clamp screen coordinates strictly inside viewport boundaries.
 */
export function clampCoordinates(
  pos: Vector2D,
  viewportWidth: number,
  viewportHeight: number
): Vector2D {
  return {
    x: Math.max(POINTER_EDGE_INSET_PX, Math.min(viewportWidth - POINTER_EDGE_INSET_PX, pos.x)),
    y: Math.max(POINTER_EDGE_INSET_PX, Math.min(viewportHeight - POINTER_EDGE_INSET_PX, pos.y))
  };
}
