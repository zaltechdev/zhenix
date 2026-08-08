import type { Vector2D } from "./pointer-mapping";

export interface RestLockConfig {
  stabilityEnvelopePx: number;
  acquisitionDelayMs: number;
  releaseDistancePx: number;
  releaseVelocityPxPerMs: number;
  sustainedEscapeFrames: number;
  minimumEscapeStepPx: number;
}

/**
 * Internal stability defaults for a stationary head. They are intentionally
 * centralized rather than exposed as additional accessibility preferences.
 */
export const REST_LOCK_DEFAULTS: RestLockConfig = {
  stabilityEnvelopePx: 3,
  acquisitionDelayMs: 150,
  releaseDistancePx: 12,
  releaseVelocityPxPerMs: 0.45,
  sustainedEscapeFrames: 2,
  minimumEscapeStepPx: 2
};

export interface RestLockResult {
  position: Vector2D;
  isLocked: boolean;
  released: boolean;
}

function distanceBetween(left: Vector2D, right: Vector2D): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function directionFrom(origin: Vector2D, point: Vector2D): Vector2D {
  return { x: point.x - origin.x, y: point.y - origin.y };
}

function directionsContinue(previous: Vector2D, next: Vector2D): boolean {
  return previous.x * next.x + previous.y * next.y > 0;
}

/**
 * Freezes a settled rendered pointer while retaining a short, deliberate
 * escape path. Pose spikes must not release the lock by themselves.
 */
export class RestLockController {
  private readonly config: RestLockConfig;
  private pendingAnchor: Vector2D | null = null;
  private pendingSinceMs = 0;
  private lockedPosition: Vector2D | null = null;
  private lastInput: Vector2D | null = null;
  private lastTimestampMs = 0;
  private escapeDirection: Vector2D | null = null;
  private escapeFrames = 0;

  constructor(config: Partial<RestLockConfig> = {}) {
    this.config = {
      ...REST_LOCK_DEFAULTS,
      ...config,
      releaseDistancePx: Math.max(
        config.stabilityEnvelopePx ?? REST_LOCK_DEFAULTS.stabilityEnvelopePx,
        config.releaseDistancePx ?? REST_LOCK_DEFAULTS.releaseDistancePx
      ),
      sustainedEscapeFrames: Math.max(2, config.sustainedEscapeFrames ?? REST_LOCK_DEFAULTS.sustainedEscapeFrames)
    };
  }

  public get isLocked(): boolean {
    return this.lockedPosition !== null;
  }

  public reset(): void {
    this.pendingAnchor = null;
    this.pendingSinceMs = 0;
    this.lockedPosition = null;
    this.lastInput = null;
    this.lastTimestampMs = 0;
    this.escapeDirection = null;
    this.escapeFrames = 0;
  }

  public process(input: Vector2D, nowMs: number): RestLockResult {
    const { velocity, previousInput } = this.updateInput(input, nowMs);

    if (this.lockedPosition) {
      return this.processLocked(input, velocity, previousInput, nowMs);
    }

    return this.processUnlocked(input, nowMs);
  }

  private processUnlocked(input: Vector2D, nowMs: number): RestLockResult {
    if (!this.pendingAnchor) {
      this.pendingAnchor = { ...input };
      this.pendingSinceMs = nowMs;
      return this.result(input, false, false);
    }

    if (distanceBetween(input, this.pendingAnchor) > this.config.stabilityEnvelopePx) {
      this.pendingAnchor = { ...input };
      this.pendingSinceMs = nowMs;
      return this.result(input, false, false);
    }

    if (nowMs - this.pendingSinceMs >= this.config.acquisitionDelayMs) {
      this.lockedPosition = { ...this.pendingAnchor };
      this.pendingAnchor = null;
      return this.result(this.lockedPosition, true, false);
    }

    return this.result(input, false, false);
  }

  private processLocked(
    input: Vector2D,
    velocity: number,
    previousInput: Vector2D | null,
    nowMs: number
  ): RestLockResult {
    const lockedPosition = this.lockedPosition;
    if (!lockedPosition) {
      return this.processUnlocked(input, nowMs);
    }

    const displacement = distanceBetween(input, lockedPosition);
    const escapeThresholdReached =
      displacement >= this.config.releaseDistancePx ||
      (displacement > this.config.stabilityEnvelopePx &&
        velocity >= this.config.releaseVelocityPxPerMs);

    if (!escapeThresholdReached) {
      this.clearEscape();
      return this.result(lockedPosition, true, false);
    }

    const direction = directionFrom(lockedPosition, input);
    const continued =
      this.escapeDirection !== null &&
      directionsContinue(this.escapeDirection, direction) &&
      distanceBetween(input, previousInput ?? input) >= this.config.minimumEscapeStepPx;

    this.escapeDirection = direction;
    this.escapeFrames = continued ? this.escapeFrames + 1 : 1;

    if (this.escapeFrames >= this.config.sustainedEscapeFrames) {
      this.lockedPosition = null;
      this.pendingAnchor = { ...input };
      this.pendingSinceMs = nowMs;
      this.clearEscape();
      return this.result(input, false, true);
    }

    return this.result(lockedPosition, true, false);
  }

  private updateInput(input: Vector2D, nowMs: number): {
    velocity: number;
    previousInput: Vector2D | null;
  } {
    const previousInput = this.lastInput;
    const elapsedMs = nowMs - this.lastTimestampMs;
    const velocity =
      previousInput && elapsedMs > 0
        ? distanceBetween(input, previousInput) / elapsedMs
        : 0;
    this.lastInput = { ...input };
    this.lastTimestampMs = nowMs;
    return { velocity, previousInput };
  }

  private clearEscape(): void {
    this.escapeDirection = null;
    this.escapeFrames = 0;
  }

  private result(position: Vector2D, isLocked: boolean, released: boolean): RestLockResult {
    return { position, isLocked, released };
  }
}
