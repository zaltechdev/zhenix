/**
 * Facial Gesture Selection Detector.
 * Maps MediaPipe blendshapes to configured gesture types with rising-edge single activation and cooldown.
 */

export type GestureType = "mouth_open" | "brow_raise" | "eye_blink_long" | "smile";

export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export interface GestureDetectorOptions {
  gestureType: GestureType | null;
  /** Gesture threshold (0 to 100 integer) */
  threshold: number;
  /** Cooldown duration in milliseconds */
  cooldownMs: number;
  onActivate?: (target: HTMLElement) => void;
}

export interface GestureStatus {
  gestureType: GestureType | null;
  currentScore: number;
  thresholdNormalized: number;
  isDetected: boolean;
  isTriggered: boolean;
  inCooldown: boolean;
}

export class GestureDetector {
  private gestureType: GestureType | null = null;
  private thresholdNormalized = 0.5; // 0.0 to 1.0
  private cooldownMs = 600;
  private minHoldDurationMs = 0; // 350ms for eye_blink_long, 0ms for instant gestures
  private aboveThresholdStartTime = 0;
  private triggeredThisHoldCycle = false;
  private lastTriggerTime = 0;
  private onActivate?: (target: HTMLElement) => void;

  constructor(options: GestureDetectorOptions) {
    this.updateConfig(options);
  }

  public updateConfig(options: Partial<GestureDetectorOptions>): void {
    if (options.gestureType !== undefined) {
      this.gestureType = options.gestureType;
      this.minHoldDurationMs = options.gestureType === "eye_blink_long" ? 350 : 0;
    }
    if (options.threshold !== undefined) {
      // Map 0..100 integer to 0.15..0.85 normalized score
      this.thresholdNormalized = 0.15 + (Math.max(0, Math.min(100, options.threshold)) / 100) * 0.70;
    }
    if (options.cooldownMs !== undefined) {
      this.cooldownMs = Math.max(100, options.cooldownMs);
    }
    if (options.onActivate !== undefined) {
      this.onActivate = options.onActivate;
    }
  }

  public reset(): void {
    this.aboveThresholdStartTime = 0;
    this.triggeredThisHoldCycle = false;
    this.lastTriggerTime = 0;
  }

  /**
   * Extract numeric score (0.0 to 1.0) for the active gesture from MediaPipe blendshapes.
   */
  public extractGestureScore(blendshapes: BlendshapeCategory[]): number {
    if (!this.gestureType || !blendshapes || blendshapes.length === 0) {
      return 0;
    }

    const scores = new Map<string, number>();
    for (const b of blendshapes) {
      scores.set(b.categoryName, b.score);
    }

    switch (this.gestureType) {
      case "mouth_open":
        return scores.get("jawOpen") ?? 0;

      case "brow_raise": {
        const left = scores.get("browOuterUpLeft") ?? 0;
        const right = scores.get("browOuterUpRight") ?? 0;
        const inner = scores.get("browInnerUp") ?? 0;
        return Math.max((left + right) / 2, inner);
      }

      case "eye_blink_long": {
        const leftBlink = scores.get("eyeBlinkLeft") ?? 0;
        const rightBlink = scores.get("eyeBlinkRight") ?? 0;
        return (leftBlink + rightBlink) / 2;
      }

      case "smile": {
        const leftSmile = scores.get("mouthSmileLeft") ?? 0;
        const rightSmile = scores.get("mouthSmileRight") ?? 0;
        return (leftSmile + rightSmile) / 2;
      }

      default:
        return 0;
    }
  }

  /**
   * Process a frame's blendshapes against pointer target and cooldown.
   */
  public processFrame(
    blendshapes: BlendshapeCategory[],
    target: HTMLElement | null,
    nowMs: number,
    isControlActive: boolean
  ): GestureStatus {
    if (!isControlActive || !this.gestureType) {
      this.reset();
      return {
        gestureType: this.gestureType,
        currentScore: 0,
        thresholdNormalized: this.thresholdNormalized,
        isDetected: false,
        isTriggered: false,
        inCooldown: false
      };
    }

    const currentScore = this.extractGestureScore(blendshapes);
    const isAboveThreshold = currentScore >= this.thresholdNormalized;
    const timeSinceTrigger = nowMs - this.lastTriggerTime;
    const inCooldown = timeSinceTrigger < this.cooldownMs;

    let isTriggered = false;

    if (isAboveThreshold) {
      if (this.aboveThresholdStartTime === 0) {
        this.aboveThresholdStartTime = nowMs;
      }

      const holdDuration = nowMs - this.aboveThresholdStartTime;

      // Activation requirement:
      // 1. Held above threshold for at least minHoldDurationMs
      // 2. Has NOT already triggered in this hold cycle
      // 3. Cooldown has elapsed
      if (
        holdDuration >= this.minHoldDurationMs &&
        !this.triggeredThisHoldCycle &&
        !inCooldown
      ) {
        if (
          target &&
          !target.hasAttribute("disabled") &&
          target.getAttribute("aria-disabled") !== "true"
        ) {
          isTriggered = true;
          this.triggeredThisHoldCycle = true;
          this.lastTriggerTime = nowMs;

          try {
            if (this.onActivate) {
              this.onActivate(target);
            } else {
              target.click();
            }
          } catch {
            // Ignore DOM dispatch errors
          }
        }
      }
    } else {
      // Released below threshold -> reset hold cycle state
      this.aboveThresholdStartTime = 0;
      this.triggeredThisHoldCycle = false;
    }

    return {
      gestureType: this.gestureType,
      currentScore,
      thresholdNormalized: this.thresholdNormalized,
      isDetected: isAboveThreshold,
      isTriggered,
      inCooldown
    };
  }
}
