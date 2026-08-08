"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  Crosshair,
  RefreshCw
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";
import { useHeadControl } from "@/lib/client/vision/head-control-context";
import type { VisionFailureCategory } from "@/lib/client/vision/vision-engine";
import type { CalibrationDirection } from "@/lib/client/vision/calibration";

function directionLabel(direction: CalibrationDirection, locale: Locale): string {
  const options = { locale };
  if (direction === "left") return m.onboarding_calibration_direction_left({}, options);
  if (direction === "right") return m.onboarding_calibration_direction_right({}, options);
  if (direction === "up") return m.onboarding_calibration_direction_up({}, options);
  if (direction === "down") return m.onboarding_calibration_direction_down({}, options);
  if (direction === "return_center") {
    return m.onboarding_calibration_direction_return_center({}, options);
  }
  return m.onboarding_calibration_direction_center({}, options);
}

function directionCopy(direction: CalibrationDirection, locale: Locale): { title: string; helper: string } {
  const options = { locale };
  if (direction === "left") {
    return {
      title: m.onboarding_calibration_left_title({}, options),
      helper: m.onboarding_calibration_left_helper({}, options)
    };
  }
  if (direction === "right") {
    return {
      title: m.onboarding_calibration_right_title({}, options),
      helper: m.onboarding_calibration_right_helper({}, options)
    };
  }
  if (direction === "up") {
    return {
      title: m.onboarding_calibration_up_title({}, options),
      helper: m.onboarding_calibration_up_helper({}, options)
    };
  }
  if (direction === "down") {
    return {
      title: m.onboarding_calibration_down_title({}, options),
      helper: m.onboarding_calibration_down_helper({}, options)
    };
  }
  if (direction === "return_center") {
    return {
      title: m.onboarding_calibration_return_center_title({}, options),
      helper: m.onboarding_calibration_return_center_helper({}, options)
    };
  }
  return {
    title: m.onboarding_calibration_center_title({}, options),
    helper: m.onboarding_calibration_center_helper({}, options)
  };
}

function DirectionIcon({ direction }: { direction: CalibrationDirection }) {
  if (direction === "left") return <ArrowLeft aria-hidden="true" size={28} />;
  if (direction === "right") return <ArrowRight aria-hidden="true" size={28} />;
  if (direction === "up") return <ArrowUp aria-hidden="true" size={28} />;
  if (direction === "down") return <ArrowDown aria-hidden="true" size={28} />;
  return <Crosshair aria-hidden="true" size={26} />;
}

function failureCopy(category: VisionFailureCategory | null, locale: Locale): string {
  const options = { locale };
  if (category === "permission_denied") return m.onboarding_camera_denied({}, options);
  if (category === "no_device") return m.onboarding_camera_unavailable({}, options);
  if (category === "model_load_failed") return m.onboarding_camera_model_failed({}, options);
  if (category === "stream_ended") return m.onboarding_camera_stream_ended({}, options);
  if (category === "tracking_lost") return m.onboarding_calibration_tracking_interrupted({}, options);
  return m.onboarding_camera_busy({}, options);
}

export function WorkspaceCalibrationExperience({
  locale,
  onClose
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const headControl = useHeadControl();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const startupAttemptRef = useRef(false);
  const calibrationLaunchRef = useRef(false);
  const triggerRef = useRef<Element | null>(null);
  const options = { locale };
  const calibration = headControl.calibrationState;
  const progress = Math.round(calibration.progressRatio * 100);
  const direction = directionCopy(calibration.direction, locale);
  const directionText = directionLabel(calibration.direction, locale);
  const isCapturing = calibration.status === "capturing";
  const isCompleted = calibration.status === "completed";
  const isFailed = calibration.status === "failed";
  const isTrackingLost = headControl.lifecycleState === "tracking_lost";
  const canRetryStartup =
    headControl.lifecycleState === "error" || headControl.lifecycleState === "tracking_lost" || isFailed;

  const handleCancel = useCallback(() => {
    if (isCapturing || isFailed || isTrackingLost) headControl.cancelCalibration();
    if (
      headControl.activeStream === null &&
      ["initializing", "idle", "disabled", "error"].includes(headControl.lifecycleState)
    ) {
      headControl.disableControl();
    }
    onClose();
  }, [headControl, isCapturing, isFailed, isTrackingLost, onClose]);
  const handleCancelRef = useRef(handleCancel);
  useEffect(() => {
    handleCancelRef.current = handleCancel;
  }, [handleCancel]);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    bodyRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    const stream = headControl.activeStream;
    if (!preview || !stream) return;

    preview.srcObject = stream;
    try {
      const playback = preview.play();
      if (playback && typeof playback.catch === "function") {
        void playback.catch(() => {
          // Muted preview playback may be blocked without affecting tracking.
        });
      }
    } catch {
      // A browser without media playback support does not affect tracking.
    }

    return () => {
      if (preview.srcObject === stream) preview.srcObject = null;
    };
  }, [headControl.activeStream]);

  useEffect(() => {
    if (headControl.lifecycleState === "active") {
      startupAttemptRef.current = false;
      if (calibration.status === "capturing") {
        calibrationLaunchRef.current = true;
      } else if (
        !calibrationLaunchRef.current &&
        (calibration.status === "idle" || calibration.status === "completed")
      ) {
        calibrationLaunchRef.current = true;
        headControl.startCalibration();
      }
      return;
    }

    if (headControl.lifecycleState === "paused") {
      headControl.resumeControl();
      return;
    }

    if (
      startupAttemptRef.current ||
      !previewRef.current ||
      !["idle", "disabled", "error"].includes(headControl.lifecycleState)
    ) {
      return;
    }

    startupAttemptRef.current = true;
    void headControl.startHeadControl(previewRef.current);
  }, [calibration.status, headControl]);

  const handleRetry = () => {
    startupAttemptRef.current = false;
    calibrationLaunchRef.current = false;
    headControl.cancelCalibration();
    if (headControl.lifecycleState === "error") headControl.disableControl();
    if (headControl.lifecycleState === "tracking_lost") headControl.resumeControl();
  };

  const statusTone: StatusTone = isCompleted
    ? "ready"
    : isFailed || headControl.lifecycleState === "error" || isTrackingLost
      ? "attention"
      : isCapturing
        ? "pending"
        : "neutral";
  const statusValue = isCompleted
    ? m.onboarding_calibration_success_title({}, options)
    : isFailed
      ? m.onboarding_calibration_failed({}, options)
      : isTrackingLost
        ? m.onboarding_calibration_tracking_interrupted({}, options)
        : headControl.lifecycleState === "initializing"
          ? m.a11y_initializing_head_control({}, options)
          : headControl.lifecycleState === "error"
            ? failureCopy(headControl.errorCategory, locale)
            : isCapturing
              ? m.a11y_calibrating_head_control({ progress }, options)
              : m.onboarding_calibration_tracking_required({}, options);

  return (
    <div className="aksa-calibration-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="aksa-calibration-dialog"
        data-aksa-calibration-guard="true"
        ref={dialogRef}
        role="dialog"
      >
        <div className="aksa-calibration-dialog__body" ref={bodyRef} tabIndex={0}>
          <div className="aksa-calibration-dialog__header">
            <div>
              <h2 className="aksa-calibration-dialog__title" id={titleId}>
                {m.a11y_calibrate_head_control({}, options)}
              </h2>
              <p className="aksa-calibration-dialog__description" id={descriptionId}>
                {m.workspace_calibration_description({}, options)}
              </p>
            </div>
            <StatusChip tone={statusTone} value={statusValue} />
          </div>

          <div className="aksa-calibration-dialog__preview">
            <video
              aria-label={m.onboarding_camera_preview_label({}, options)}
              autoPlay
              className="aksa-camera-preview aksa-camera-preview--mirrored"
              muted
              playsInline
              ref={previewRef}
            />
            <div className="aksa-calibration-dialog__preview-status">
              <Camera aria-hidden="true" className="aksa-icon aksa-icon--sm" />
              <span>{m.onboarding_camera_preview_label({}, options)}</span>
            </div>
            <div className="aksa-calibration-dialog__guidance" aria-live="polite">
              <div className="aksa-calibration-dialog__guidance-copy">
                {isCapturing ? (
                  <p className="aksa-calibration-dialog__step">
                    {m.onboarding_calibration_step(
                      { step: String(calibration.step), direction: directionText },
                      options
                    )}
                  </p>
                ) : null}
                <p className="aksa-calibration-dialog__instruction">
                  {isCompleted ? m.onboarding_calibration_success_title({}, options) : direction.title}
                </p>
                <p className="aksa-calibration-dialog__helper">
                  {isCompleted ? m.onboarding_calibration_success_helper({}, options) : direction.helper}
                </p>
              </div>
              <div aria-label={directionText} className="aksa-calibration-dialog__target" role="img">
                {isCompleted ? <Check aria-hidden="true" size={28} /> : <DirectionIcon direction={calibration.direction} />}
              </div>
              {isCapturing ? (
                <div
                  aria-label={m.onboarding_calibration_progress_label({}, options)}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progress}
                  className="aksa-calibration-dialog__progress"
                  role="progressbar"
                >
                  <div className="aksa-calibration-dialog__progress-value" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>
          </div>

          {isFailed || headControl.lifecycleState === "error" ? (
            <p className="aksa-notice" role="alert">
              {isFailed ? m.onboarding_calibration_failed({}, options) : failureCopy(headControl.errorCategory, locale)}
            </p>
          ) : null}
        </div>

        <div className="aksa-calibration-dialog__actions">
          {canRetryStartup ? (
            <button className="aksa-button aksa-button--secondary" onClick={handleRetry} type="button">
              <RefreshCw aria-hidden="true" className="aksa-icon" />
              <span>{m.action_retry({}, options)}</span>
            </button>
          ) : null}
          <button className="aksa-button aksa-button--quiet" onClick={handleCancel} type="button">
            {isCompleted ? m.onboarding_calibration_done({}, options) : m.onboarding_calibration_cancel({}, options)}
          </button>
        </div>
      </div>
    </div>
  );
}
