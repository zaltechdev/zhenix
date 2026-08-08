import type { Vector2D } from "./pointer-mapping";

export interface RestLockConfig {
  stabilityEnvelopePx: number;
  acquisitionDelayMs: number;
  restEnterMotionDegrees: number;
  restExitMotionDegrees: number;
  releaseDistancePx: number;
  releaseVelocityPxPerMs: number;
  sustainedEscapeFrames: number;
  minimumEscapeStepPx: number;
}

export type RestState = "MOVING" | "REST_CANDIDATE" | "RESTING";

/**
 * Internal stability defaults for a stationary head. They are intentionally
 * centralized rather than exposed as additional accessibility preferences.
 */
export const REST_LOCK_DEFAULTS: RestLockConfig = {
  stabilityEnvelopePx: 6,
  acquisitionDelayMs: 150,
  restEnterMotionDegrees: 0.32,
  restExitMotionDegrees: 0.75,
  releaseDistancePx: 18,
  releaseVelocityPxPerMs: 0.45,
  sustainedEscapeFrames: 3,
  minimumEscapeStepPx: 1.5
};

export interface RestLockResult {
  position: Vector2D;
  state: RestState;
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
  private state: RestState = "MOVING";
  private pendingAnchor: Vector2D | null = null;
  private pendingSinceMs = 0;
  private pendingSamples = 0;
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
      restExitMotionDegrees: Math.max(
        config.restEnterMotionDegrees ?? REST_LOCK_DEFAULTS.restEnterMotionDegrees,
        config.restExitMotionDegrees ?? REST_LOCK_DEFAULTS.restExitMotionDegrees
      ),
      sustainedEscapeFrames: Math.max(2, config.sustainedEscapeFrames ?? REST_LOCK_DEFAULTS.sustainedEscapeFrames)
    };
  }

  public get isLocked(): boolean {
    return this.state === "RESTING" && this.lockedPosition !== null;
  }

  public reset(): void {
    this.state = "MOVING";
    this.pendingAnchor = null;
    this.pendingSinceMs = 0;
    this.pendingSamples = 0;
    this.lockedPosition = null;
    this.lastInput = null;
    this.lastTimestampMs = 0;
    this.escapeDirection = null;
    this.escapeFrames = 0;
  }

  public process(input: Vector2D, nowMs: number, motionDegrees?: number): RestLockResult {
    const { velocity, previousInput } = this.updateInput(input, nowMs);

    if (this.state === "RESTING" && this.lockedPosition) {
      return this.processResting(input, velocity, previousInput, nowMs, motionDegrees);
    }

    return this.processMoving(input, previousInput, nowMs, motionDegrees);
  }

  private processMoving(
    input: Vector2D,
    previousInput: Vector2D | null,
    nowMs: number,
    motionDegrees?: number
  ): RestLockResult {
    const stableMotion = Number.isFinite(motionDegrees)
      ? (motionDegrees as number) <= this.config.restEnterMotionDegrees
      : distanceBetween(input, previousInput ?? input) <= this.config.stabilityEnvelopePx;

    if (!stableMotion) {
      this.clearCandidate();
      this.state = "MOVING";
      return this.result(input, false);
    }

    if (this.state !== "REST_CANDIDATE" || !this.pendingAnchor) {
      this.state = "REST_CANDIDATE";
      this.pendingAnchor = { ...input };
      this.pendingSinceMs = nowMs;
      this.pendingSamples = 1;
      return this.result(input, false);
    }

    this.pendingSamples += 1;
    const weight = 1 / this.pendingSamples;
    this.pendingAnchor = {
      x: this.pendingAnchor.x + (input.x - this.pendingAnchor.x) * weight,
      y: this.pendingAnchor.y + (input.y - this.pendingAnchor.y) * weight
    };

    if (nowMs - this.pendingSinceMs >= this.config.acquisitionDelayMs) {
      this.lockedPosition = { ...this.pendingAnchor };
      this.clearCandidate();
      this.state = "RESTING";
      return this.result(this.lockedPosition, false);
    }

    return this.result(input, false);
  }

  private processResting(
    input: Vector2D,
    velocity: number,
    previousInput: Vector2D | null,
    nowMs: number,
    motionDegrees?: number
  ): RestLockResult {
    const lockedPosition = this.lockedPosition;
    if (!lockedPosition) {
      this.state = "MOVING";
      return this.processMoving(input, previousInput, nowMs, motionDegrees);
    }

    const displacement = distanceBetween(input, lockedPosition);
    const hasPhysicalMotion = Number.isFinite(motionDegrees);
    const physicalMotion = hasPhysicalMotion ? (motionDegrees as number) : 0;
    const escapeThresholdReached = hasPhysicalMotion
      ? physicalMotion >= this.config.restExitMotionDegrees ||
        (physicalMotion > this.config.restEnterMotionDegrees &&
          displacement >= this.config.releaseDistancePx)
      : displacement >= this.config.releaseDistancePx ||
        (displacement > this.config.stabilityEnvelopePx &&
          velocity >= this.config.releaseVelocityPxPerMs);

    if (!escapeThresholdReached) {
      this.clearEscape();
      return this.result(lockedPosition, false);
    }

    const direction = directionFrom(lockedPosition, input);
    const continued =
      this.escapeDirection !== null &&
      directionsContinue(this.escapeDirection, direction) &&
      (distanceBetween(input, previousInput ?? input) >= this.config.minimumEscapeStepPx ||
        displacement >= this.config.releaseDistancePx * 1.5);

    this.escapeDirection = direction;
    this.escapeFrames = continued ? this.escapeFrames + 1 : 1;

    if (this.escapeFrames >= this.config.sustainedEscapeFrames) {
      this.lockedPosition = null;
      this.state = "MOVING";
      this.clearCandidate();
      this.clearEscape();
      return this.result(input, true);
    }

    return this.result(lockedPosition, false);
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

  private clearCandidate(): void {
    this.pendingAnchor = null;
    this.pendingSinceMs = 0;
    this.pendingSamples = 0;
  }

  private result(position: Vector2D, released: boolean): RestLockResult {
    return { position, state: this.state, isLocked: this.isLocked, released };
  }
}
