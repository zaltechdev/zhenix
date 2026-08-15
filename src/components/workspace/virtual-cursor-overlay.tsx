"use client";

import React, { useEffect, useState, useId } from "react";
import type {
  HeadControlController,
  VirtualCursorState
} from "@/lib/client/vision/head-control-controller";

export interface VirtualCursorOverlayProps {
  /** Controller instance to subscribe to automatically, or supply cursorState directly */
  controller?: HeadControlController | null;
  /** Explicit cursor state if managed externally */
  cursorState?: VirtualCursorState | null;
  /** Custom cursor size in pixels (default: 36) */
  size?: number;
  /** Custom cursor accent color (default: Aksa brand cyan/teal #06b6d4) */
  accentColor?: string;
  /** Enable click ripple visual burst (default: true) */
  enableClickRipple?: boolean;
  /** High contrast outline mode for enhanced visibility (default: false) */
  highContrast?: boolean;
}

export function VirtualCursorOverlay({
  controller,
  cursorState: externalState,
  size = 36,
  accentColor = "#06b6d4",
  enableClickRipple = true,
  highContrast = false
}: VirtualCursorOverlayProps) {
  const [internalState, setInternalState] = useState<VirtualCursorState | null>(null);
  const filterId = useId();

  // Subscribe to controller updates if provided
  useEffect(() => {
    if (!controller) return;

    controller.setOnCursorUpdate((s: VirtualCursorState) => {
      setInternalState(s);
    });

    return () => {
      controller.setOnCursorUpdate(undefined);
    };
  }, [controller]);

  const state = externalState ?? internalState;
  const [prevClickTimestamp, setPrevClickTimestamp] = useState<number | null>(() => state?.lastClickTimestamp ?? null);
  const [isClicking, setIsClicking] = useState(() => Boolean(state?.lastClickTimestamp && enableClickRipple));

  if (state?.lastClickTimestamp && state.lastClickTimestamp !== prevClickTimestamp && enableClickRipple) {
    setPrevClickTimestamp(state.lastClickTimestamp);
    setIsClicking(true);
  }

  // Auto-reset click ripple after animation duration
  useEffect(() => {
    if (!isClicking) return;
    const endTimer = setTimeout(() => setIsClicking(false), 350);
    return () => clearTimeout(endTimer);
  }, [isClicking]);

  if (!state || !state.isVisible) {
    return null;
  }

  const { x, y, dwellProgress, dwellState, status } = state;
  const isDwelling = dwellState === "dwelling" || dwellProgress > 0;
  const isTrackingLost = status === "tracking_lost";

  // SVG ring radius calculation
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - dwellProgress * circumference;

  const halfSize = size / 2;

  return (
    <div
      aria-hidden="true"
      data-testid="virtual-cursor-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999,
        transform: `translate3d(${x - halfSize}px, ${y - halfSize}px, 0)`,
        willChange: "transform",
        width: `${size}px`,
        height: `${size}px`,
        transition: "transform 0.04s cubic-bezier(0, 0, 0.2, 1)"
      }}
    >
      {/* Click ripple animation effect */}
      {isClicking && (
        <div
          data-testid="cursor-click-ripple"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `2px solid ${accentColor}`,
            animation: "aksa-cursor-ripple 0.35s ease-out forwards"
          }}
        />
      )}

      {/* Outer SVG Container for Dwell Progress Ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "rotate(-90deg)",
          overflow: "visible"
        }}
      >
        <defs>
          <filter id={`cursor-shadow-${filterId}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Background track circle */}
        <circle
          cx={halfSize}
          cy={halfSize}
          r={radius}
          fill="none"
          stroke={highContrast ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.25)"}
          strokeWidth={strokeWidth}
          filter={`url(#cursor-shadow-${filterId})`}
        />

        {/* Dwell Progress animated arc */}
        {isDwelling && (
          <circle
            data-testid="cursor-progress-bar"
            cx={halfSize}
            cy={halfSize}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeWidth + 0.5}
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: "stroke-dashoffset 0.05s linear"
            }}
          />
        )}
      </svg>

      {/* Center Reticle / Core Point */}
      <div
        data-testid="cursor-center-core"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isDwelling ? "10px" : "8px",
          height: isDwelling ? "10px" : "8px",
          borderRadius: "50%",
          backgroundColor: isTrackingLost ? "#ef4444" : accentColor,
          border: highContrast ? "2px solid #000000" : "1.5px solid #ffffff",
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.4)",
          transition: "width 0.15s ease, height 0.15s ease, background-color 0.2s ease"
        }}
      />

      <style>{`
        @keyframes aksa-cursor-ripple {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
