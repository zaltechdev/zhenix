"use client";

import Image from "next/image";
import { Vector2D } from "@/lib/client/vision/pointer-mapping";
import { DwellProgress } from "@/lib/client/vision/dwell-controller";
import { VisionLifecycleState } from "@/lib/client/vision/vision-engine";
import AksaPointerLogo from "../../../logo/aksa.svg";

export interface AksaPointerProps {
  position: Vector2D;
  lifecycleState: VisionLifecycleState;
  dwellProgress: DwellProgress;
  hasTarget: boolean;
  reducedMotion?: boolean;
  activationKey?: number;
}

export function AksaPointer({
  position,
  lifecycleState,
  dwellProgress,
  hasTarget,
  reducedMotion = false,
  activationKey = 0
}: AksaPointerProps) {
  // Initialization must not look operational. Tracking loss keeps the last safe position visible.
  if (lifecycleState !== "active" && lifecycleState !== "tracking_lost") {
    return null;
  }

  const isTrackingLost = lifecycleState === "tracking_lost";
  const isDwelling = dwellProgress.state === "dwelling" && hasTarget;
  const progressRatio = dwellProgress.progressRatio;
  const strokeDashoffset = 100 - progressRatio * 100;
  const className = `aksa-pointer-overlay ${isTrackingLost ? "aksa-pointer-overlay--lost" : ""} ${
    hasTarget ? "aksa-pointer-overlay--target" : ""
  } ${activationKey > 0 && !reducedMotion ? "aksa-pointer-overlay--activated" : ""} ${
    reducedMotion ? "aksa-pointer-overlay--reduced-motion" : ""
  }`;

  return (
    <div
      aria-hidden="true"
      className={className}
      data-aksa-pointer="true"
      key={`aksa-pointer-${activationKey}`}
      style={{
        pointerEvents: "none",
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`
      }}
    >
      <span aria-hidden="true" className="aksa-pointer-overlay__contrast" style={{ pointerEvents: "none" }}>
        <Image alt="" height={26} priority src={AksaPointerLogo} width={26} />
      </span>
      <Image
        alt=""
        className="aksa-pointer-overlay__logo"
        height={26}
        priority
        src={AksaPointerLogo}
        style={{ pointerEvents: "none" }}
        width={26}
      />

      {isDwelling ? (
        <>
          <svg className="aksa-pointer-overlay__progress-ring" viewBox="0 0 36 36">
            <circle
              className="aksa-pointer-overlay__progress-bg"
              cx="18"
              cy="18"
              pathLength="100"
              r="15"
            />
            <circle
              className="aksa-pointer-overlay__progress-bar"
              cx="18"
              cy="18"
              pathLength="100"
              r="15"
              style={{
                strokeDasharray: "100",
                strokeDashoffset: `${strokeDashoffset}`
              }}
            />
          </svg>
          {reducedMotion ? (
            <div className="aksa-pointer-overlay__reduced-progress">
              {Math.round(progressRatio * 100)}%
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
