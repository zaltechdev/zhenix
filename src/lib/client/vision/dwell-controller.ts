/**
 * Dwell Selection Controller.
 * Manages stability checking, progress timing, single activation, cancel-on-leave, and cooldown.
 */

import { Vector2D } from "./pointer-mapping";

export type DwellState = "idle" | "stabilizing" | "dwelling" | "cooldown";

export interface DwellProgress {
  state: DwellState;
  progressRatio: number; // 0.0 to 1.0
  targetElement: HTMLElement | null;
  activeTargetBounds: DOMRect | null;
}

export interface DwellOptions {
  /** Configured dwell duration in milliseconds */
  dwellDurationMs: number;
  /** Cooldown duration after activation in milliseconds */
  cooldownMs?: number;
  /** Maximum pointer movement radius allowed during dwell in pixels */
  stabilityRadiusPx?: number;
  /** Minimum stability duration before dwell timer begins in milliseconds */
  stabilityWindowMs?: number;
  /** Callback fired when dwell completes and activates target */
  onActivate?: (target: HTMLElement) => void;
}

export class DwellController {
  private state: DwellState = "idle";
  private currentTarget: HTMLElement | null = null;
  private targetBounds: DOMRect | null = null;
  private anchorPoint: Vector2D | null = null;
  private stateStartTime = 0;
  private dwellDurationMs: number;
  private cooldownMs: number;
  private stabilityRadiusPx: number;
  private stabilityWindowMs: number;
  private onActivate?: (target: HTMLElement) => void;
  private confirmationGuardActive = false;

  constructor(options: DwellOptions) {
    this.dwellDurationMs = Math.max(300, options.dwellDurationMs);
    this.cooldownMs = options.cooldownMs ?? 500;
    this.stabilityRadiusPx = options.stabilityRadiusPx ?? 35;
    this.stabilityWindowMs = options.stabilityWindowMs ?? 100;
    this.onActivate = options.onActivate;
  }

  public updateConfig(dwellDurationMs: number, cooldownMs?: number): void {
    this.dwellDurationMs = Math.max(300, dwellDurationMs);
    if (cooldownMs !== undefined) {
      this.cooldownMs = cooldownMs;
    }
  }

  public setConfirmationGuard(active: boolean): void {
    this.confirmationGuardActive = active;
    if (active) {
      this.cancel();
    }
  }

  public cancel(): void {
    this.state = "idle";
    this.currentTarget = null;
    this.targetBounds = null;
    this.anchorPoint = null;
    this.stateStartTime = 0;
  }

  public processFrame(
    pointerPos: Vector2D,
    target: HTMLElement | null,
    targetBounds: DOMRect | null,
    nowMs: number,
    isControlActive: boolean
  ): DwellProgress {
    // If control is paused/disabled, tracking lost, or confirmation guard active
    if (!isControlActive || this.confirmationGuardActive) {
      if (this.state !== "idle") {
        this.cancel();
      }
      return { state: "idle", progressRatio: 0, targetElement: null, activeTargetBounds: null };
    }

    // Cooldown check
    if (this.state === "cooldown") {
      const elapsed = nowMs - this.stateStartTime;
      if (elapsed < this.cooldownMs) {
        return {
          state: "cooldown",
          progressRatio: 0,
          targetElement: this.currentTarget,
          activeTargetBounds: this.targetBounds
        };
      }
      // Cooldown finished -> transition to idle
      this.state = "idle";
      this.currentTarget = null;
      this.targetBounds = null;
      this.anchorPoint = null;
    }

    // Target check: if no eligible target or target changed or target disabled
    if (
      !target ||
      target.hasAttribute("disabled") ||
      target.getAttribute("aria-disabled") === "true"
    ) {
      if (this.state !== "idle") {
        this.cancel();
      }
      return { state: "idle", progressRatio: 0, targetElement: null, activeTargetBounds: null };
    }

    // Target switched
    if (this.currentTarget !== target) {
      this.state = "stabilizing";
      this.currentTarget = target;
      this.targetBounds = targetBounds;
      this.anchorPoint = { ...pointerPos };
      this.stateStartTime = nowMs;
      return {
        state: "stabilizing",
        progressRatio: 0,
        targetElement: target,
        activeTargetBounds: targetBounds
      };
    }

    // Stability radius check relative to anchor point
    if (this.anchorPoint) {
      const dist = Math.hypot(pointerPos.x - this.anchorPoint.x, pointerPos.y - this.anchorPoint.y);
      if (dist > this.stabilityRadiusPx) {
        // Pointer moved beyond stability threshold -> reset anchor and timing
        this.anchorPoint = { ...pointerPos };
        this.stateStartTime = nowMs;
        this.state = "stabilizing";
        return {
          state: "stabilizing",
          progressRatio: 0,
          targetElement: target,
          activeTargetBounds: targetBounds
        };
      }
    }

    const elapsed = nowMs - this.stateStartTime;

    // Stabilizing phase
    if (this.state === "stabilizing") {
      if (elapsed >= this.stabilityWindowMs) {
        this.state = "dwelling";
        this.stateStartTime = nowMs; // Reset timer for dwell phase
      } else {
        return {
          state: "stabilizing",
          progressRatio: 0,
          targetElement: target,
          activeTargetBounds: targetBounds
        };
      }
    }

    // Dwelling phase
    if (this.state === "dwelling") {
      const dwellElapsed = nowMs - this.stateStartTime;
      const ratio = Math.min(1.0, dwellElapsed / this.dwellDurationMs);

      if (ratio >= 1.0) {
        // Dwell complete -> Single activation!
        this.state = "cooldown";
        this.stateStartTime = nowMs;

        // Perform click activation
        try {
          if (this.onActivate) {
            this.onActivate(target);
          } else {
            target.click();
          }
        } catch {
          // Ignore DOM dispatch errors
        }

        return {
          state: "cooldown",
          progressRatio: 1.0,
          targetElement: target,
          activeTargetBounds: targetBounds
        };
      }

      return {
        state: "dwelling",
        progressRatio: ratio,
        targetElement: target,
        activeTargetBounds: targetBounds
      };
    }

    return { state: "idle", progressRatio: 0, targetElement: null, activeTargetBounds: null };
  }
}
