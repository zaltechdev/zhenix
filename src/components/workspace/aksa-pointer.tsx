"use client";

import { Vector2D } from "@/lib/client/vision/pointer-mapping";
import { DwellProgress } from "@/lib/client/vision/dwell-controller";
import { VisionLifecycleState } from "@/lib/client/vision/vision-engine";

export interface AksaPointerProps {
  position: Vector2D;
  lifecycleState: VisionLifecycleState;
  dwellProgress: DwellProgress;
  hasTarget: boolean;
  reducedMotion?: boolean;
}

export function AksaPointer({
  position,
  lifecycleState,
  dwellProgress,
  hasTarget,
  reducedMotion = false
}: AksaPointerProps) {
  // Initialization must not look operational. Tracking loss keeps the last safe position visible.
  if (lifecycleState !== "active" && lifecycleState !== "tracking_lost") {
    return null;
  }

  const isTrackingLost = lifecycleState === "tracking_lost";
  const isDwelling = dwellProgress.state === "dwelling";
  const progressRatio = dwellProgress.progressRatio;
  const strokeDashoffset = 100 - progressRatio * 100;

  return (
    <div
      aria-hidden="true"
      className={`aksa-pointer-overlay ${isTrackingLost ? "aksa-pointer-overlay--lost" : ""} ${
        hasTarget ? "aksa-pointer-overlay--target" : ""
      }`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`
      }}
    >
      {/* Outer target ring */}
      <div className="aksa-pointer-overlay__outer" />

      {/* Center dot */}
      <div className="aksa-pointer-overlay__dot" />

      {/* Dwell Progress Ring */}
      {isDwelling && progressRatio > 0 ? (
        reducedMotion ? (
          <div className="aksa-pointer-overlay__reduced-progress">
            {Math.round(progressRatio * 100)}%
          </div>
        ) : (
          <svg className="aksa-pointer-overlay__progress-ring" viewBox="0 0 36 36">
            <circle
              className="aksa-pointer-overlay__progress-bg"
              cx="18"
              cy="18"
              r="14"
            />
            <circle
              className="aksa-pointer-overlay__progress-bar"
              cx="18"
              cy="18"
              r="14"
              style={{
                strokeDasharray: "100",
                strokeDashoffset: `${strokeDashoffset}`
              }}
            />
          </svg>
        )
      ) : null}
    </div>
  );
}
