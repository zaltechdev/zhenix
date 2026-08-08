import type { Vector2D } from "./pointer-mapping";
import {
  distanceToRectangle,
  type TargetCandidate,
  type TargetRectangle
} from "./target-resolver";

export interface TargetAssistConfig {
  assistRadiusPx: number;
  releaseRadiusPx: number;
  acquisitionDelayMs: number;
  ambiguityDistancePx: number;
  lockedJitterRadiusPx: number;
  escapeDisplacementPx: number;
  escapeVelocityPxPerMs: number;
  releaseFrames: number;
  magneticStrength: number;
}

/**
 * Internal accessibility defaults. These are deliberately not exposed as
 * ordinary settings because they describe control semantics, not preferences.
 */
export const TARGET_ASSIST_DEFAULTS: TargetAssistConfig = {
  assistRadiusPx: 42,
  releaseRadiusPx: 70,
  acquisitionDelayMs: 125,
  ambiguityDistancePx: 8,
  lockedJitterRadiusPx: 5,
  escapeDisplacementPx: 36,
  escapeVelocityPxPerMs: 0.68,
  releaseFrames: 2,
  magneticStrength: 0.42
};

export interface TargetAssistResult {
  position: Vector2D;
  activeTarget: HTMLElement | null;
  activeTargetBounds: DOMRect | null;
  candidateTarget: HTMLElement | null;
  isLocked: boolean;
  released: boolean;
  selectionSuppressed: boolean;
}

function distanceBetween(left: Vector2D, right: Vector2D): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function closestPointInRectangle(point: Vector2D, bounds: TargetRectangle): Vector2D {
  return {
    x: Math.max(bounds.left, Math.min(point.x, bounds.right)),
    y: Math.max(bounds.top, Math.min(point.y, bounds.bottom))
  };
}

function sortCandidates(pointer: Vector2D, candidates: TargetCandidate[]): TargetCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, distancePx: distanceToRectangle(pointer, candidate.bounds) }))
    .sort((left, right) =>
      left.distancePx === right.distancePx ? left.order - right.order : left.distancePx - right.distancePx
    );
}

/**
 * Resolves only a clearly nearest candidate. Exact and near ties wait for the
 * pointer to express intent instead of oscillating between adjacent controls.
 */
export function selectTargetAssistCandidate(
  pointer: Vector2D,
  candidates: TargetCandidate[],
  config: Pick<TargetAssistConfig, "assistRadiusPx" | "ambiguityDistancePx"> = TARGET_ASSIST_DEFAULTS
): TargetCandidate | null {
  const nearby = sortCandidates(pointer, candidates).filter(
    (candidate) => candidate.distancePx <= config.assistRadiusPx
  );
  const first = nearby[0];
  if (!first) {
    return null;
  }

  const second = nearby[1];
  if (second && second.distancePx - first.distancePx <= config.ambiguityDistancePx) {
    return null;
  }

  return first;
}

/**
 * Stateful semantic assistance around eligible DOM controls. It never changes
 * MediaPipe input and does not teleport a cursor to a target centre.
 */
export class TargetAssistController {
  private readonly config: TargetAssistConfig;
  private pendingTarget: TargetCandidate | null = null;
  private pendingSinceMs = 0;
  private lockedTarget: TargetCandidate | null = null;
  private lockAnchor: Vector2D | null = null;
  private lastRawPointer: Vector2D | null = null;
  private lastRawTimestampMs = 0;
  private lastAssistedPointer: Vector2D | null = null;
  private escapeDirection: Vector2D | null = null;
  private escapeFrames = 0;

  constructor(config: Partial<TargetAssistConfig> = {}) {
    this.config = {
      ...TARGET_ASSIST_DEFAULTS,
      ...config,
      releaseRadiusPx: Math.max(
        config.assistRadiusPx ?? TARGET_ASSIST_DEFAULTS.assistRadiusPx,
        config.releaseRadiusPx ?? TARGET_ASSIST_DEFAULTS.releaseRadiusPx
      ),
      releaseFrames: Math.max(2, config.releaseFrames ?? TARGET_ASSIST_DEFAULTS.releaseFrames)
    };
  }

  public get isLocked(): boolean {
    return this.lockedTarget !== null;
  }

  public clear(): void {
    this.pendingTarget = null;
    this.pendingSinceMs = 0;
    this.lockedTarget = null;
    this.lockAnchor = null;
    this.lastRawPointer = null;
    this.lastRawTimestampMs = 0;
    this.lastAssistedPointer = null;
    this.clearEscapeCandidate();
  }

  public process(
    rawPointer: Vector2D,
    candidates: TargetCandidate[],
    nowMs: number
  ): TargetAssistResult {
    const { previousRawPointer, velocity } = this.rawMotion(rawPointer, nowMs);
    const locked = this.findCandidateForLockedTarget(rawPointer, candidates);

    if (this.lockedTarget && !locked) {
      this.release();
      this.lastAssistedPointer = rawPointer;
      return this.result(rawPointer, null, null, false, true);
    }

    if (this.lockedTarget && locked) {
      if (this.shouldEscape(rawPointer, locked, velocity)) {
        if (this.confirmEscape(rawPointer, previousRawPointer)) {
          this.release();
          this.lastAssistedPointer = rawPointer;
          return this.result(rawPointer, null, null, false, true);
        }

        const held = this.stabilizeLockedPointer(rawPointer, locked.bounds);
        this.lastAssistedPointer = held;
        return this.result(held, locked, locked, true, false, true);
      }

      this.clearEscapeCandidate();
      this.lockedTarget = locked;
      const stabilized = this.stabilizeLockedPointer(rawPointer, locked.bounds);
      this.lastAssistedPointer = stabilized;
      return this.result(stabilized, locked, locked, true, false);
    }

    const candidate = selectTargetAssistCandidate(rawPointer, candidates, this.config);
    if (!candidate) {
      this.pendingTarget = null;
      this.pendingSinceMs = 0;
      this.lastAssistedPointer = rawPointer;
      return this.result(rawPointer, null, null, false, false);
    }

    const assisted = this.applyMagneticApproach(rawPointer, candidate.bounds, candidate.distancePx);
    this.lastAssistedPointer = assisted;

    if (this.pendingTarget?.element !== candidate.element) {
      this.pendingTarget = candidate;
      this.pendingSinceMs = nowMs;
      return this.result(assisted, null, candidate, false, false);
    }

    this.pendingTarget = candidate;
    if (nowMs - this.pendingSinceMs >= this.config.acquisitionDelayMs) {
      this.lockedTarget = candidate;
      this.lockAnchor = { ...rawPointer };
      this.pendingTarget = null;
      this.pendingSinceMs = 0;
      return this.result(assisted, candidate, candidate, true, false);
    }

    return this.result(assisted, null, candidate, false, false);
  }

  private rawMotion(rawPointer: Vector2D, nowMs: number): {
    previousRawPointer: Vector2D | null;
    velocity: number;
  } {
    const previousRawPointer = this.lastRawPointer;
    const elapsed = nowMs - this.lastRawTimestampMs;
    const velocity =
      previousRawPointer && elapsed > 0 ? distanceBetween(rawPointer, previousRawPointer) / elapsed : 0;
    this.lastRawPointer = { ...rawPointer };
    this.lastRawTimestampMs = nowMs;
    return { previousRawPointer, velocity };
  }

  private findCandidateForLockedTarget(
    rawPointer: Vector2D,
    candidates: TargetCandidate[]
  ): TargetCandidate | null {
    if (!this.lockedTarget) {
      return null;
    }

    const current = candidates.find((candidate) => candidate.element === this.lockedTarget?.element);
    if (!current) {
      return null;
    }

    return {
      ...current,
      distancePx: distanceToRectangle(rawPointer, current.bounds)
    };
  }

  private shouldEscape(
    rawPointer: Vector2D,
    locked: TargetCandidate,
    velocity: number
  ): boolean {
    if (
      this.lockAnchor &&
      distanceBetween(rawPointer, this.lockAnchor) <= this.config.lockedJitterRadiusPx
    ) {
      return false;
    }
    const leftReleaseZone = locked.distancePx > this.config.releaseRadiusPx;
    const displaced = this.lockAnchor
      ? distanceBetween(rawPointer, this.lockAnchor) >= this.config.escapeDisplacementPx
      : false;
    return leftReleaseZone || displaced || velocity >= this.config.escapeVelocityPxPerMs;
  }

  private confirmEscape(rawPointer: Vector2D, previousRawPointer: Vector2D | null): boolean {
    const origin = this.lockAnchor ?? this.lastAssistedPointer ?? rawPointer;
    const direction = {
      x: rawPointer.x - origin.x,
      y: rawPointer.y - origin.y
    };
    const continued =
      this.escapeDirection !== null &&
      this.escapeDirection.x * direction.x + this.escapeDirection.y * direction.y > 0 &&
      distanceBetween(rawPointer, previousRawPointer ?? rawPointer) >= 1;

    this.escapeDirection = direction;
    this.escapeFrames = continued ? this.escapeFrames + 1 : 1;
    return this.escapeFrames >= this.config.releaseFrames;
  }

  private stabilizeLockedPointer(rawPointer: Vector2D, bounds: TargetRectangle): Vector2D {
    if (
      this.lastAssistedPointer &&
      distanceBetween(rawPointer, this.lastAssistedPointer) <= this.config.lockedJitterRadiusPx
    ) {
      return this.lastAssistedPointer;
    }

    return this.applyMagneticApproach(
      rawPointer,
      bounds,
      distanceToRectangle(rawPointer, bounds)
    );
  }

  private applyMagneticApproach(
    rawPointer: Vector2D,
    bounds: TargetRectangle,
    distancePx: number
  ): Vector2D {
    if (distancePx <= 0 || distancePx > this.config.assistRadiusPx) {
      return rawPointer;
    }

    const nearest = closestPointInRectangle(rawPointer, bounds);
    const proximity = 1 - distancePx / this.config.assistRadiusPx;
    const strength = proximity * proximity * this.config.magneticStrength;
    return {
      x: rawPointer.x + (nearest.x - rawPointer.x) * strength,
      y: rawPointer.y + (nearest.y - rawPointer.y) * strength
    };
  }

  private release(): void {
    this.pendingTarget = null;
    this.pendingSinceMs = 0;
    this.lockedTarget = null;
    this.lockAnchor = null;
    this.clearEscapeCandidate();
  }

  private clearEscapeCandidate(): void {
    this.escapeDirection = null;
    this.escapeFrames = 0;
  }

  private result(
    position: Vector2D,
    active: TargetCandidate | null,
    candidate: TargetCandidate | null,
    isLocked: boolean,
    released: boolean,
    selectionSuppressed = false
  ): TargetAssistResult {
    return {
      position,
      activeTarget: active?.element ?? null,
      activeTargetBounds: active?.bounds ?? null,
      candidateTarget: candidate?.element ?? null,
      isLocked,
      released,
      selectionSuppressed
    };
  }
}
