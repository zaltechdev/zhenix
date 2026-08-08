/**
 * Pointer mapping engine converting head pose deltas into smooth, bounded screen coordinates.
 * Pure math functions designed for high precision, zero neck strain, and temporal stability.
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

function normalizeSetting(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function clampAxis(value: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-maximum, Math.min(maximum, value));
}

function deadZoneThreshold(deadZoneSetting: number): number {
  return (normalizeSetting(deadZoneSetting) / 100) * 4.0;
}

function softLimit(value: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }

  return Math.tanh(value / limit) * limit;
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

class DeadZoneHysteresis {
  private isEngaged = false;

  public apply(value: number, deadZoneSetting: number): number {
    const enterThreshold = deadZoneThreshold(deadZoneSetting);
    if (enterThreshold === 0) {
      this.isEngaged = false;
      return value;
    }

    const releaseThreshold = enterThreshold * 0.75;
    const magnitude = Math.abs(value);

    if (!this.isEngaged) {
      if (magnitude <= enterThreshold) {
        return 0;
      }
      this.isEngaged = true;
    } else if (magnitude < releaseThreshold) {
      this.isEngaged = false;
      return 0;
    }

    return Math.sign(value) * ((magnitude - releaseThreshold) / (1 + releaseThreshold));
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
  private readonly yawDeadZone = new DeadZoneHysteresis();
  private readonly pitchDeadZone = new DeadZoneHysteresis();

  public process(
    input: PoseDelta,
    deadZoneSetting: number,
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
      yaw: this.yawDeadZone.apply(filtered.pose.yaw, deadZoneSetting),
      pitch: this.pitchDeadZone.apply(filtered.pose.pitch, deadZoneSetting),
      spikeRejected: accepted.spikeRejected,
      motionResponse: filtered.motionResponse
    };
  }

  public reset(): void {
    this.lastAccepted = null;
    this.pendingSpike = null;
    this.filteredPose = null;
    this.yawDeadZone.reset();
    this.pitchDeadZone.reset();
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
 * Apply dead zone threshold to normalized input angle.
 * Converts input within dead zone to zero, smoothly scaling values beyond.
 */
export function applyDeadZone(value: number, deadZoneSetting: number): number {
  // Convert 0..100 dead zone setting to degrees (0.0° to 4.0°)
  const threshold = deadZoneThreshold(deadZoneSetting);
  if (Math.abs(value) <= threshold) {
    return 0;
  }
  const sign = Math.sign(value);
  const adjusted = (Math.abs(value) - threshold) / (1 + threshold);
  return sign * adjusted;
}

/**
 * Map head rotation angles (yaw & pitch in degrees) to normalized screen velocity / offset delta.
 * Uses sensitivity scaling and controlled gain curve.
 */
export function mapPoseToScreenDelta(
  yawDelta: number,
  pitchDelta: number,
  sensitivitySetting: number,
  deadZoneSetting: number,
  viewportWidth = 1920,
  viewportHeight = 1080
): Vector2D {
  const boundedInput = clampPoseDelta({ yaw: yawDelta, pitch: pitchDelta });

  const cleanYaw = applyDeadZone(boundedInput.yaw, deadZoneSetting);
  const cleanPitch = applyDeadZone(boundedInput.pitch, deadZoneSetting);

  if (cleanYaw === 0 && cleanPitch === 0) {
    return { x: 0, y: 0 };
  }

  // Sensitivity scaling: Map 0..100 sensitivity to gain multiplier (0.5 to 4.0)
  // Higher sensitivity requires less rotation to cover the screen.
  const gain = 0.5 + (normalizeSetting(sensitivitySetting) / 100) * 3.5;

  // Controlled non-linear gain curve (power 1.3) to enable precise micro-adjustments
  // near center while making screen corners easily reachable.
  const yawSign = Math.sign(cleanYaw);
  const pitchSign = Math.sign(cleanPitch);

  const curvedYaw = yawSign * Math.pow(Math.abs(cleanYaw), 1.3);
  const curvedPitch = pitchSign * Math.pow(Math.abs(cleanPitch), 1.3);

  // Degrees to viewport ratio mapping factor
  // Base: ~15 degrees yaw / pitch covers screen half-width / half-height at default gain 2.0
  const normX = curvedYaw * gain * 35;
  const normY = curvedPitch * gain * 35;

  // Saturation retains comfortable high-sensitivity reach without allowing a bad frame to slam an edge.
  const horizontalLimit = Math.max(0, viewportWidth / 2 - POINTER_EDGE_INSET_PX);
  const verticalLimit = Math.max(0, viewportHeight / 2 - POINTER_EDGE_INSET_PX);

  return {
    x: softLimit(normX, horizontalLimit),
    y: softLimit(normY, verticalLimit)
  };
}

/**
 * Convert MediaPipe camera-space pose into Aksa pointer motion.
 * Preview mirroring never affects these control coordinates.
 */
export function mapCameraPoseToScreenDelta(
  cameraYawDelta: number,
  cameraPitchDelta: number,
  sensitivitySetting: number,
  deadZoneSetting: number,
  viewportWidth = 1920,
  viewportHeight = 1080
): Vector2D {
  return mapPoseToScreenDelta(
    cameraYawDelta * CAMERA_YAW_TO_SCREEN_DIRECTION,
    cameraPitchDelta,
    sensitivitySetting,
    deadZoneSetting,
    viewportWidth,
    viewportHeight
  );
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
    x: Math.max(0, Math.min(viewportWidth, pos.x)),
    y: Math.max(0, Math.min(viewportHeight, pos.y))
  };
}
