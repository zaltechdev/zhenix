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

/**
 * Apply dead zone threshold to normalized input angle.
 * Converts input within dead zone to zero, smoothly scaling values beyond.
 */
export function applyDeadZone(value: number, deadZoneSetting: number): number {
  // Convert 0..100 dead zone setting to degrees (0.0° to 4.0°)
  const threshold = (deadZoneSetting / 100) * 4.0;
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
  deadZoneSetting: number
): Vector2D {
  // Apply dead zone independently
  const cleanYaw = applyDeadZone(yawDelta, deadZoneSetting);
  const cleanPitch = applyDeadZone(pitchDelta, deadZoneSetting);

  if (cleanYaw === 0 && cleanPitch === 0) {
    return { x: 0, y: 0 };
  }

  // Sensitivity scaling: Map 0..100 sensitivity to gain multiplier (0.5 to 4.0)
  // Higher sensitivity requires less rotation to cover the screen.
  const gain = 0.5 + (sensitivitySetting / 100) * 3.5;

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

  return { x: normX, y: normY };
}

/**
 * Temporal exponential low-pass filter smoothing for pointer coordinates.
 * Time-aware smoothing prevents lag on high refresh rates and jitter on variable frame rates.
 */
export function smoothCoordinates(
  current: Vector2D,
  target: Vector2D,
  smoothingSetting: number,
  deltaTimeMs: number
): Vector2D {
  if (deltaTimeMs <= 0) {
    return current;
  }

  // Convert 0..100 smoothing setting to responsiveness alpha:
  // smoothing = 0 -> alpha ~ 0.95 (instant response)
  // smoothing = 100 -> alpha ~ 0.15 (heavy filter)
  const baseAlpha = 0.95 - (smoothingSetting / 100) * 0.80;

  // Adjust alpha for delta time (normalized to 60fps = 16.6ms)
  const timeFactor = Math.min(deltaTimeMs / 16.6, 3.0);
  const alpha = Math.min(Math.max(1 - Math.pow(1 - baseAlpha, timeFactor), 0.05), 1.0);

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
