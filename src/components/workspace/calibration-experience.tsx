"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crosshair,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";
import { useHeadControl } from "@/lib/client/vision/head-control-context";
import type { VisionFailureCategory } from "@/lib/client/vision/vision-engine";

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
  /** Test override for instant auto-trigger */
  autoTrigger?: boolean;
}) {
  const headControl = useHeadControl();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const startupAttemptRef = useRef(false);
  const triggerRef = useRef<Element | null>(null);
  const [justCalibrated, setJustCalibrated] = useState(false);
  const options = { locale };

  const calibration = headControl.calibrationState;
  const isCompleted = calibration.status === "completed" || justCalibrated;
  const isFailed = calibration.status === "failed";
  const isTrackingLost = headControl.lifecycleState === "tracking_lost";
  const isActive = headControl.lifecycleState === "active";
  const canRetryStartup =
    headControl.lifecycleState === "error" || headControl.lifecycleState === "tracking_lost" || isFailed;

  const handleCancel = useCallback(() => {
    if (isFailed || isTrackingLost) headControl.cancelCalibration();
    if (
      headControl.activeStream === null &&
      ["initializing", "idle", "disabled", "error"].includes(headControl.lifecycleState)
    ) {
      headControl.disableControl();
    }
    onClose();
  }, [headControl, isFailed, isTrackingLost, onClose]);

  const handleCancelRef = useRef(handleCancel);
  useEffect(() => {
    handleCancelRef.current = handleCancel;
  }, [handleCancel]);

  const handleInstantCalibrate = useCallback(() => {
    if (headControl.lifecycleState !== "active") return;
    headControl.startCalibration();
    setJustCalibrated(true);
  }, [headControl]);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    bodyRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelRef.current();
        return;
      }

      if (event.key === "Tab") {
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
      // Browser media playback handling
    }

    return () => {
      if (preview.srcObject === stream) preview.srcObject = null;
    };
  }, [headControl.activeStream]);

  useEffect(() => {
    if (headControl.lifecycleState === "active") {
      startupAttemptRef.current = false;
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
  }, [headControl]);

  const handleRetry = () => {
    startupAttemptRef.current = false;
    setJustCalibrated(false);
    headControl.cancelCalibration();
    if (headControl.lifecycleState === "error") headControl.disableControl();
    if (headControl.lifecycleState === "tracking_lost") headControl.resumeControl();
  };

  const statusTone: StatusTone = isCompleted
    ? "ready"
    : isFailed || headControl.lifecycleState === "error" || isTrackingLost
      ? "attention"
      : isActive
        ? "ready"
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
            : isActive
              ? m.controls_camera_ready({}, options)
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
                <p className="aksa-calibration-dialog__instruction">
                  {isCompleted
                    ? m.onboarding_calibration_success_title({}, options)
                    : m.onboarding_calibration_center_title({}, options)}
                </p>
                <p className="aksa-calibration-dialog__helper">
                  {isCompleted
                    ? m.onboarding_calibration_success_helper({}, options)
                    : m.onboarding_calibration_center_helper({}, options)}
                </p>
              </div>
              <div aria-label="Center" className="aksa-calibration-dialog__target" role="img">
                {isCompleted ? <Check aria-hidden="true" size={28} /> : <Crosshair aria-hidden="true" size={28} />}
              </div>
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
          ) : (
            <button
              className="aksa-button aksa-button--primary"
              disabled={!isActive}
              onClick={handleInstantCalibrate}
              type="button"
            >
              <Sparkles aria-hidden="true" className="aksa-icon" />
              <span>
                {isCompleted
                  ? m.onboarding_calibration_restart({}, options)
                  : m.onboarding_calibration_start({}, options)}
              </span>
            </button>
          )}

          <button className="aksa-button aksa-button--quiet" onClick={handleCancel} type="button">
            {isCompleted ? m.onboarding_calibration_done({}, options) : m.onboarding_calibration_cancel({}, options)}
          </button>
        </div>
      </div>
    </div>
  );
}
