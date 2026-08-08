"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, CameraOff, Check, ChevronRight, Mic, Sparkles, MousePointer, Keyboard, Shield } from "lucide-react";
import DefaultLogo from "../../../logo/Default.svg";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { provisionalAccessibilityProfile } from "@/lib/contracts/auth";
import {
  createRecognition,
  isSpeechRecognitionSupported,
  transcriptFromEvent
} from "@/lib/client/voice/speech-recognition";
import { useBrowserValue } from "@/lib/client/state/use-browser-value";
import {
  clearOnboardingStep,
  useOnboardingStep
} from "@/lib/client/state/onboarding-step-store";
import { PENDING_COMMAND_STORAGE_KEY } from "@/lib/client/state/pending-command";
import { AccessibilityControls } from "@/components/workspace/accessibility-controls";
import { StatusChip } from "@/components/workspace/status-chip";

import {
  HeadControlRuntimeBoundary,
  useHeadControl,
  type HeadControlEngineFactory
} from "@/lib/client/vision/head-control-context";
import {
  cameraFailureFromException,
  type VisionFailureCategory
} from "@/lib/client/vision/vision-engine";

export type OnboardingPhase = 1 | 2 | 3 | 4;

type PermissionOutcome = "idle" | "granted" | "paused" | "denied" | "unavailable" | "insecure";
type CameraOutcome = "idle" | "starting" | "active" | "paused" | "failed" | "insecure";

interface PhaseDef {
  id: OnboardingPhase;
  titleKey: "onboarding_phase_welcome" | "onboarding_phase_head_control" | "onboarding_phase_voice" | "onboarding_phase_first_task";
  optional?: boolean;
}

const PHASES: PhaseDef[] = [
  { id: 1, titleKey: "onboarding_phase_welcome" },
  { id: 2, titleKey: "onboarding_phase_head_control", optional: true },
  { id: 3, titleKey: "onboarding_phase_voice", optional: true },
  { id: 4, titleKey: "onboarding_phase_first_task" }
];

function getPhaseRadialProgress(phaseId: OnboardingPhase, currentPhase: OnboardingPhase, substepIndex: number): number {
  if (currentPhase > phaseId) return 100;
  if (currentPhase < phaseId) return 0;

  if (phaseId === 1) return 100;
  if (phaseId === 2) {
    if (substepIndex <= 5) return 50; // half radial
    return 100; // full radial
  }
  if (phaseId === 3) {
    if (substepIndex <= 8) return 50; // half radial
    return 100; // full radial
  }
  return 100;
}

function getNestedPart(phaseId: OnboardingPhase, substepIndex: number): "1" | "2" | null {
  if (phaseId === 2) {
    if (substepIndex <= 5) return "1";
    return "2";
  }
  if (phaseId === 3) {
    if (substepIndex <= 8) return "1";
    return "2";
  }
  return null;
}

export function OnboardingFlow({
  locale,
  engineFactory
}: {
  locale: Locale;
  engineFactory?: HeadControlEngineFactory;
}) {
  return (
    <HeadControlRuntimeBoundary engineFactory={engineFactory} userId={null}>
    <OnboardingFlowContent locale={locale} />
    </HeadControlRuntimeBoundary>
  );
}

function OnboardingFlowContent({ locale }: { locale: Locale }) {
  const headControl = useHeadControl();
  // Underlying 12 substeps mapping into 4 phases
  const [substepIndex, setSubstepIndex] = useOnboardingStep(12);

  // Local states
  const [cameraOutcome, setCameraOutcome] = useState<CameraOutcome>("idle");
  const [cameraFailure, setCameraFailure] = useState<VisionFailureCategory | null>(null);
  const [microphoneOutcome, setMicrophoneOutcome] = useState<PermissionOutcome>("idle");
  const [voiceSkippedText, setVoiceSkippedText] = useState(false);
  const [recognitionFailed, setRecognitionFailed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [firstCommand, setFirstCommand] = useState<string>("");
  const [taskSubmitted, setTaskSubmitted] = useState(false);
  const [selectedCards, setSelectedCards] = useState<{ head: boolean; voice: boolean }>({ head: true, voice: true });
  const [setupStyle, setSetupStyle] = useState<"recommended" | "custom">("recommended");

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraAttemptRef = useRef(0);
  const phaseSubstepRef = useRef<Record<OnboardingPhase, number>>({
    1: 0,
    2: 2,
    3: 7,
    4: 10
  });
  const options = { locale };

  // Calculate current visible phase (1 to 4)
  let currentPhase: OnboardingPhase = 1;
  if (substepIndex >= 0 && substepIndex <= 1) currentPhase = 1;
  else if (substepIndex >= 2 && substepIndex <= 6) currentPhase = 2;
  else if (substepIndex >= 7 && substepIndex <= 9) currentPhase = 3;
  else currentPhase = 4;

  useEffect(() => {
    phaseSubstepRef.current[currentPhase] = substepIndex;
  }, [currentPhase, substepIndex]);

  const browserVoiceSupported = useBrowserValue(isSpeechRecognitionSupported, false);
  const voiceSupported = browserVoiceSupported && !recognitionFailed;

  // Programmatic Focus on phase transition without text selection or visible outline box
  useEffect(() => {
    if (mounted && headingRef.current) {
      headingRef.current.focus({ preventScroll: true });
    }
  }, [currentPhase, substepIndex, mounted]);

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1;
    headControl.pauseControl();
    setCameraOutcome("paused");
    setCameraFailure(null);
  }, [headControl]);

  useEffect(() => {
    return () => {
      cameraAttemptRef.current += 1;
      // The shared provider owns the stream so head control survives workspace navigation.
    };
  }, []);

  const requestCamera = useCallback(async () => {
    if (!window.isSecureContext) {
      setCameraOutcome("insecure");
      setCameraFailure(null);
      return;
    }

    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setCameraOutcome("failed");
      setCameraFailure("camera_unavailable");
      return;
    }

    if (headControl.lifecycleState === "paused") {
      headControl.resumeControl();
      setCameraOutcome("active");
      setCameraFailure(null);
      return;
    }

    setCameraOutcome("starting");
    setCameraFailure(null);
    const attempt = cameraAttemptRef.current + 1;
    cameraAttemptRef.current = attempt;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (cameraAttemptRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const videoElement = videoRef.current;
      if (!videoElement) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraFailure("camera_unavailable");
        setCameraOutcome("failed");
        return;
      }

      const operational = await headControl.startCamera(videoElement, stream);
      if (cameraAttemptRef.current !== attempt) {
        return;
      }
      if (operational) {
        setCameraOutcome("active");
      } else {
        streamRef.current = null;
        setCameraOutcome("failed");
      }
    } catch (error) {
      if (cameraAttemptRef.current !== attempt) {
        return;
      }
      streamRef.current = null;
      setCameraFailure(cameraFailureFromException(error));
      setCameraOutcome("failed");
    }
  }, [headControl]);

  const runtimeCameraFailure =
    headControl.lifecycleState === "error" &&
    headControl.errorCategory !== "tracking_lost"
      ? headControl.errorCategory
      : null;
  const effectiveCameraFailure = runtimeCameraFailure ?? cameraFailure;
  const effectiveCameraOutcome = runtimeCameraFailure ? "failed" : cameraOutcome;
  const cameraFailureCopy =
    effectiveCameraFailure === "permission_denied"
      ? m.onboarding_camera_denied({}, options)
      : effectiveCameraFailure === "no_device"
        ? m.onboarding_camera_unavailable({}, options)
        : effectiveCameraFailure === "model_load_failed"
          ? m.onboarding_camera_model_failed({}, options)
          : effectiveCameraFailure === "stream_ended"
            ? m.onboarding_camera_stream_ended({}, options)
            : m.onboarding_camera_busy({}, options);

  const handleStartCalibration = useCallback(() => {
    if (headControl.lifecycleState !== "active") {
      return;
    }
    headControl.startCalibration();
  }, [headControl]);

  const canCalibrate =
    effectiveCameraOutcome === "active" && headControl.lifecycleState === "active";
  const calibrationProgress = Math.round(
    headControl.calibrationState.progressRatio * 100
  );
  const calibrationStatus = headControl.calibrationState.status;
  const calibrationCopy = !canCalibrate
    ? m.onboarding_calibration_tracking_required({}, options)
    : calibrationStatus === "completed"
      ? m.onboarding_calibration_complete({}, options)
      : calibrationStatus === "capturing"
        ? m.onboarding_calibration_capturing({ progress: calibrationProgress }, options)
        : calibrationStatus === "failed"
          ? headControl.calibrationState.errorMessage === "tracking_lost"
            ? m.onboarding_calibration_tracking_interrupted({}, options)
            : m.onboarding_calibration_failed({}, options)
          : m.onboarding_calibration_idle({}, options);
  const calibrationHelper = !canCalibrate
    ? m.onboarding_head_setup_detail({}, options)
    : calibrationStatus === "capturing"
      ? m.onboarding_calibration_capturing({ progress: calibrationProgress }, options)
      : m.onboarding_head_setup_detail({}, options);

  const requestMicrophone = useCallback(async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setMicrophoneOutcome("unavailable");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneOutcome("granted");
      setVoiceSkippedText(false);
    } catch {
      setMicrophoneOutcome("denied");
    }
  }, []);

  const runVoiceTest = useCallback(() => {
    const recognition = createRecognition(locale === "id" ? "id" : "en");
    if (recognition === null) {
      setRecognitionFailed(true);
      return;
    }

    setIsListening(true);
    recognition.onresult = (event) => {
      setTranscript(transcriptFromEvent(event));
    };
    recognition.onerror = () => {
      setMicrophoneOutcome("denied");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setMicrophoneOutcome("denied");
      setIsListening(false);
    }
  }, [locale]);

  const stopVoiceTest = useCallback(() => {
    setIsListening(false);
  }, []);

  const finish = useCallback(() => {
    if (firstCommand.trim() !== "") {
      window.sessionStorage.setItem(PENDING_COMMAND_STORAGE_KEY, firstCommand.trim());
    }
    clearOnboardingStep();
  }, [firstCommand]);

  // Phase navigation
  const goToPhase = (targetPhase: OnboardingPhase) => {
    // Entering Head Control always starts with its explanation before calibration/tuning.
    setSubstepIndex(targetPhase === 2 ? 2 : phaseSubstepRef.current[targetPhase]);
  };

  const skipPhase2 = () => {
    stopCamera();
    goToPhase(3);
  };

  const skipPhase3 = () => {
    goToPhase(4);
  };

  return (
    <div className="aksa-onboarding-shell" data-mounted={mounted}>
      {/* Centered 3-Column Header: Privacy link left, Centered Aksa logo, Finish later right */}
      <header className="aksa-onboarding-header">
        <div className="aksa-onboarding-header__left">
          <Link className="aksa-link aksa-link--subtle" href="/" target="_blank">
            {m.onboarding_privacy_link({}, options)}
          </Link>
        </div>
        <Link className="aksa-onboarding-brand" href="/">
          <Image
            alt="Aksa Home"
            height={28}
            priority
            src={DefaultLogo}
            style={{ height: "28px", width: "auto" }}
            width={92}
          />
        </Link>
        <div className="aksa-onboarding-header__right">
          <Link className="aksa-button aksa-button--quiet" href="/workspace" onClick={finish}>
            {m.onboarding_finish_later({}, options)}
          </Link>
        </div>
      </header>

      {/* Main 2-Column Shell */}
      <div className="aksa-onboarding-body">
        {/* Desktop Left Rail Navigation (Stepper) */}
        <nav aria-label={m.onboarding_step_label({}, options)} className="aksa-onboarding-rail">
          <ol className="aksa-onboarding-rail__list">
            {PHASES.map((p, idx) => {
              const isActive = currentPhase === p.id;
              const isCompleted = currentPhase > p.id;
              const progressPercentage = getPhaseRadialProgress(p.id, currentPhase, substepIndex);
              const part = getNestedPart(p.id, substepIndex);
              const partLabel = part ? m.onboarding_phase_part({ part }, options) : null;
              const CIRCUMFERENCE = 75.398;
              const dashOffset = CIRCUMFERENCE - (progressPercentage / 100) * CIRCUMFERENCE;

              return (
                <li key={p.id} className="aksa-onboarding-rail__item">
                  {idx > 0 ? <div className={`aksa-onboarding-rail__connector ${isCompleted ? "is-completed" : ""}`} /> : null}
                  <button
                    aria-current={isActive ? "step" : undefined}
                    className={`aksa-onboarding-rail__button ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`}
                    onClick={() => goToPhase(p.id)}
                    type="button"
                  >
                    <span className="aksa-onboarding-rail__badge">
                      <svg key={`radial-svg-${p.id}`} className="aksa-rail-radial-ring" height="28" viewBox="0 0 28 28" width="28">
                        <circle cx="14" cy="14" fill="none" r="12" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2.5" />
                        {progressPercentage > 0 ? (
                          <circle
                            cx="14"
                            cy="14"
                            fill="none"
                            r="12"
                            stroke="var(--color-aksa-teal)"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            strokeWidth="2.5"
                            style={{
                              transform: "rotate(-90deg)",
                              transformOrigin: "50% 50%",
                              transition: "stroke-dashoffset 500ms cubic-bezier(0.4, 0, 0.2, 1)"
                            }}
                          />
                        ) : null}
                      </svg>
                      {isCompleted ? <Check aria-hidden="true" size={14} /> : p.id}
                    </span>
                    <span className="aksa-onboarding-rail__label">
                      {m[p.titleKey]({}, options)}
                      {isActive && part ? (
                        <span className="aksa-onboarding-rail__optional-tag">
                          {" · "}{partLabel}
                        </span>
                      ) : p.optional ? (
                        <span className="aksa-onboarding-rail__optional-tag">
                          {" · "}{m.onboarding_phase_optional({}, options)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Vertical Divider */}
        <div className="aksa-onboarding-divider" aria-hidden="true" />

        {/* Main Content Area */}
        <main className="aksa-onboarding-main" id="main-content">
          {/* Mobile Phase Progress Bar */}
          <div className="aksa-onboarding-mobile-progress">
            <div className="aksa-onboarding-mobile-progress__info">
              <span className="aksa-onboarding-mobile-progress__step">
                {m.onboarding_progress({ current: String(currentPhase), total: "4" }, options)}
              </span>
              <span className="aksa-onboarding-mobile-progress__title">
                {m[PHASES[currentPhase - 1].titleKey]({}, options)}
              </span>
            </div>
            <progress
              aria-label={m.onboarding_step_label({}, options)}
              className="aksa-progress"
              max={4}
              value={currentPhase}
            />
          </div>

          {/* Phase 1: Welcome */}
          {currentPhase === 1 ? (
            <div className="aksa-onboarding-phase">
              <h1 className="aksa-onboarding__heading" data-onboarding-heading ref={headingRef} tabIndex={-1}>
                {m.onboarding_welcome_title({}, options)}
              </h1>
              <p className="aksa-onboarding__description">
                {m.onboarding_welcome_body({}, options)}
              </p>

              <div className="aksa-onboarding-cards">
                {/* Card 1: Head control */}
                <button
                  aria-pressed={selectedCards.head}
                  className={`aksa-onboarding-card ${selectedCards.head ? "is-selected" : ""}`}
                  onClick={() => setSelectedCards((prev) => ({ ...prev, head: !prev.head }))}
                  type="button"
                >
                  <div className="aksa-onboarding-card__header">
                    <MousePointer aria-hidden="true" className="aksa-onboarding-card__icon" size={20} />
                    {selectedCards.head ? (
                      <Check aria-hidden="true" className="aksa-onboarding-card__check" size={16} />
                    ) : null}
                  </div>
                  <h2 className="aksa-onboarding-card__title">{m.onboarding_card_head({}, options)}</h2>
                  <p className="aksa-onboarding-card__desc">{m.onboarding_card_head_desc({}, options)}</p>
                </button>

                {/* Card 2: Voice */}
                <button
                  aria-pressed={selectedCards.voice}
                  className={`aksa-onboarding-card ${selectedCards.voice ? "is-selected" : ""}`}
                  onClick={() => setSelectedCards((prev) => ({ ...prev, voice: !prev.voice }))}
                  type="button"
                >
                  <div className="aksa-onboarding-card__header">
                    <Mic aria-hidden="true" className="aksa-onboarding-card__icon" size={20} />
                    {selectedCards.voice ? (
                      <Check aria-hidden="true" className="aksa-onboarding-card__check" size={16} />
                    ) : null}
                  </div>
                  <h2 className="aksa-onboarding-card__title">{m.onboarding_card_voice({}, options)}</h2>
                  <p className="aksa-onboarding-card__desc">{m.onboarding_card_voice_desc({}, options)}</p>
                </button>
              </div>

              {/* Reassurance Row for Keyboard and Mouse */}
              <div className="aksa-onboarding-reassurance">
                <Keyboard aria-hidden="true" className="aksa-icon" size={16} />
                <span>{m.onboarding_reassurance_km({}, options)}</span>
              </div>

              {/* Phase 1 Footer: Single Primary Action (No Back button on screen 1) */}
              <div className="aksa-onboarding-footer aksa-onboarding-footer--right">
                <button className="aksa-button aksa-button--primary" onClick={() => goToPhase(2)} type="button">
                  <span>{m.onboarding_continue({}, options)}</span>
                  <ChevronRight aria-hidden="true" className="aksa-icon" size={18} />
                </button>
              </div>
            </div>
          ) : null}

          {/* Phase 2: Head Control */}
          {currentPhase === 2 ? (
            <div className="aksa-onboarding-phase aksa-onboarding-phase--head-control">
              <h1 className="aksa-onboarding__heading" data-onboarding-heading ref={headingRef} tabIndex={-1}>
                {substepIndex === 2 || substepIndex === 3
                  ? m.onboarding_head_explanation_title({}, options)
                  : substepIndex === 4 || substepIndex === 5
                    ? m.onboarding_head_setup_title({}, options)
                    : m.onboarding_tuning_title({}, options)}
              </h1>
              <p className="aksa-onboarding__description">
                {substepIndex === 2 || substepIndex === 3
                  ? m.onboarding_head_explanation_desc({}, options)
                  : substepIndex === 4 || substepIndex === 5
                    ? m.onboarding_head_setup_body({}, options)
                    : m.onboarding_tuning_body({}, options)}
              </p>
              {/* Substep 2 & 3: Explanation and Camera permission */}
              {substepIndex === 2 || substepIndex === 3 ? (
                <div className="aksa-onboarding-panel">
                  <div
                    className="aksa-camera-preview-container aksa-camera-preview--mirrored"
                    hidden={effectiveCameraOutcome !== "active"}
                  >
                    <video
                      aria-label={m.onboarding_camera_preview_label({}, options)}
                      autoPlay
                      className="aksa-camera-preview"
                      muted
                      playsInline
                      ref={videoRef}
                    />
                  </div>

                  {effectiveCameraOutcome === "idle" ? (
                    <>
                      <div className="aksa-onboarding__controls">
                        <button
                          className="aksa-button aksa-button--primary"
                          onClick={() => void requestCamera()}
                          type="button"
                        >
                          <Camera aria-hidden="true" className="aksa-icon" />
                          <span>{m.onboarding_allow_camera({}, options)}</span>
                        </button>
                        <button
                          className="aksa-button aksa-button--secondary"
                          onClick={() => goToPhase(3)}
                          type="button"
                        >
                          <span>{m.onboarding_continue_no_camera({}, options)}</span>
                        </button>
                      </div>
                      <div className="aksa-onboarding-privacy-notice">
                        <Shield aria-hidden="true" className="aksa-icon" size={14} />
                        <span>{m.onboarding_head_privacy_note({}, options)}</span>
                      </div>
                    </>
                  ) : null}

                  {effectiveCameraOutcome === "starting" ? (
                    <StatusChip
                      tone="pending"
                      value={m.a11y_initializing_head_control({}, options)}
                    />
                  ) : null}

                  {effectiveCameraOutcome === "active" ? (
                    <div className="aksa-onboarding-preview-box">
                      <div className="aksa-onboarding-preview-header">
                        <StatusChip
                          tone={
                            headControl.lifecycleState === "tracking_lost"
                              ? "attention"
                              : headControl.lifecycleState === "active"
                                ? "ready"
                                : "pending"
                          }
                          value={
                            headControl.lifecycleState === "tracking_lost"
                              ? m.a11y_tracking_lost_status({}, options)
                              : headControl.lifecycleState === "active"
                                ? m.onboarding_head_control_ready({}, options)
                                : m.a11y_initializing_head_control({}, options)
                          }
                        />
                        <span className="aksa-hint">
                          {m.onboarding_camera_guidance({}, options)}
                        </span>
                      </div>
                      <button className="aksa-button aksa-button--secondary" onClick={stopCamera} type="button">
                        <CameraOff aria-hidden="true" className="aksa-icon" />
                        <span>{m.onboarding_pause_camera({}, options)}</span>
                      </button>
                    </div>
                  ) : null}

                  {effectiveCameraOutcome === "paused" ? (
                    <div className="aksa-onboarding-preview-box">
                      <p className="aksa-hint">{m.a11y_camera_paused_status({}, options)}</p>
                      <button className="aksa-button aksa-button--primary" onClick={() => void requestCamera()} type="button">
                        <Camera aria-hidden="true" className="aksa-icon" />
                        <span>{m.onboarding_resume_camera({}, options)}</span>
                      </button>
                    </div>
                  ) : null}

                  {effectiveCameraOutcome === "failed" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={cameraFailureCopy} />
                      <div className="aksa-state-panel__actions">
                        <button className="aksa-button aksa-button--primary" onClick={() => void requestCamera()} type="button">
                          {m.onboarding_try_camera_again({}, options)}
                        </button>
                        <button className="aksa-button aksa-button--secondary" onClick={() => goToPhase(3)} type="button">
                          {m.onboarding_continue_no_camera({}, options)}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {effectiveCameraOutcome === "insecure" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_camera_insecure({}, options)} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Substep 4 & 5: Calibration / Head setup */}
              {substepIndex === 4 || substepIndex === 5 ? (
                <div className="aksa-onboarding-panel">
                  <section
                    aria-labelledby="onboarding-calibration-title"
                    className="aksa-onboarding-calibration-card"
                  >
                    <div className="aksa-onboarding-calibration-card__status" role="status">
                      <span aria-hidden="true" className="aksa-onboarding-calibration-card__icon">
                        {headControl.calibrationState.status === "completed" ? (
                          <Check className="aksa-icon" size={20} />
                        ) : headControl.calibrationState.status === "capturing" ? (
                          <Sparkles className="aksa-icon" size={20} />
                        ) : (
                          <Camera className="aksa-icon" size={20} />
                        )}
                      </span>
                      <div>
                        <h2 className="aksa-onboarding-calibration-card__title" id="onboarding-calibration-title">
                          {calibrationCopy}
                        </h2>
                        <p className="aksa-onboarding-calibration-card__helper">{calibrationHelper}</p>
                      </div>
                    </div>

                    {headControl.calibrationState.status === "capturing" ? (
                      <div
                        aria-label={m.onboarding_calibration_progress_label({}, options)}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={calibrationProgress}
                        className="aksa-onboarding-calibration-card__progress"
                        role="progressbar"
                      >
                        <div
                          className="aksa-onboarding-calibration-card__progress-value"
                          style={{ width: `${calibrationProgress}%` }}
                        />
                      </div>
                    ) : null}

                    {calibrationStatus === "capturing" ? (
                      <button
                        className="aksa-button aksa-button--secondary aksa-onboarding-calibration-card__action"
                        onClick={headControl.cancelCalibration}
                        type="button"
                      >
                        {m.confirmation_cancel({}, options)}
                      </button>
                    ) : !canCalibrate ? (
                      <button
                        className="aksa-button aksa-button--primary aksa-onboarding-calibration-card__action"
                        onClick={() => void requestCamera()}
                        type="button"
                      >
                        <Camera aria-hidden="true" className="aksa-icon" size={16} />
                        <span>{m.a11y_start_head_control({}, options)}</span>
                      </button>
                    ) : (
                      <button
                        className="aksa-button aksa-button--primary aksa-onboarding-calibration-card__action"
                        onClick={handleStartCalibration}
                        type="button"
                      >
                        <Sparkles aria-hidden="true" className="aksa-icon" size={16} />
                        <span>
                          {calibrationStatus === "completed"
                            ? m.onboarding_calibration_restart({}, options)
                            : calibrationStatus === "failed"
                              ? m.action_retry({}, options)
                              : m.onboarding_calibration_start({}, options)}
                        </span>
                      </button>
                    )}
                  </section>
                </div>
              ) : null}

              {/* Substep 6: Tuning / Preferences */}
              {substepIndex === 6 ? (
                <div className="aksa-onboarding-panel">
                  <div
                    aria-label={m.onboarding_setup_style_label({}, options)}
                    className="aksa-setup-radio-group"
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                        event.preventDefault();
                        setSetupStyle("custom");
                        (event.currentTarget.querySelector('[data-value="custom"]') as HTMLElement | null)?.focus();
                      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                        event.preventDefault();
                        setSetupStyle("recommended");
                        (event.currentTarget.querySelector('[data-value="recommended"]') as HTMLElement | null)?.focus();
                      }
                    }}
                    role="radiogroup"
                  >
                    <button
                      aria-checked={setupStyle === "recommended"}
                      className={`aksa-setup-radio-option ${setupStyle === "recommended" ? "is-selected" : ""}`}
                      data-value="recommended"
                      onClick={() => setSetupStyle("recommended")}
                      role="radio"
                      tabIndex={setupStyle === "recommended" ? 0 : -1}
                      type="button"
                    >
                      <span className="aksa-setup-radio-option__content">
                        <span className="aksa-setup-radio-option__label">{m.onboarding_setup_recommended({}, options)}</span>
                        <span className="aksa-setup-radio-option__desc">{m.onboarding_setup_recommended_desc({}, options)}</span>
                      </span>
                      {setupStyle === "recommended" ? <Check aria-hidden="true" className="aksa-setup-radio-option__check" size={16} /> : null}
                    </button>

                    <button
                      aria-checked={setupStyle === "custom"}
                      className={`aksa-setup-radio-option ${setupStyle === "custom" ? "is-selected" : ""}`}
                      data-value="custom"
                      onClick={() => setSetupStyle("custom")}
                      role="radio"
                      tabIndex={setupStyle === "custom" ? 0 : -1}
                      type="button"
                    >
                      <span className="aksa-setup-radio-option__content">
                        <span className="aksa-setup-radio-option__label">{m.onboarding_setup_custom({}, options)}</span>
                        <span className="aksa-setup-radio-option__desc">{m.onboarding_setup_custom_desc({}, options)}</span>
                      </span>
                      {setupStyle === "custom" ? <Check aria-hidden="true" className="aksa-setup-radio-option__check" size={16} /> : null}
                    </button>
                  </div>

                  {setupStyle === "custom" ? (
                    <div className="aksa-setup-custom-controls" id="onboarding-advanced-controls">
                      <AccessibilityControls initialProfile={provisionalAccessibilityProfile} locale={locale} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Phase 2 Footer */}
              <div className="aksa-onboarding-footer">
                <button className="aksa-button aksa-button--quiet" onClick={() => goToPhase(1)} type="button">
                  {m.onboarding_back({}, options)}
                </button>
                <div className="aksa-onboarding-footer__right">
                  <button className="aksa-button aksa-button--quiet" onClick={skipPhase2} type="button">
                    {m.onboarding_skip_head({}, options)}
                  </button>
                  <button
                    className="aksa-button aksa-button--primary"
                    onClick={() =>
                      substepIndex < 4
                        ? setSubstepIndex(4)
                        : substepIndex < 6
                          ? setSubstepIndex(6)
                          : goToPhase(3)
                    }
                    type="button"
                  >
                    <span>{m.onboarding_continue({}, options)}</span>
                    <ChevronRight aria-hidden="true" className="aksa-icon" size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Phase 3: Voice */}
          {currentPhase === 3 ? (
            <div className="aksa-onboarding-phase">
              <h1 className="aksa-onboarding__heading" data-onboarding-heading ref={headingRef} tabIndex={-1}>
                {substepIndex === 7 || substepIndex === 8
                  ? m.onboarding_voice_explanation_title({}, options)
                  : m.onboarding_voice_test_title({}, options)}
              </h1>
              <p className="aksa-onboarding__description">
                {substepIndex === 7 || substepIndex === 8
                  ? m.onboarding_voice_explanation_desc({}, options)
                  : m.onboarding_voice_test_body({}, options)}
              </p>
              {/* Substep 7 & 8: Voice Explanation & Permission */}
              {substepIndex === 7 || substepIndex === 8 ? (
                <div className="aksa-onboarding-panel">
                  {voiceSkippedText ? (
                    <div className="aksa-state-panel" data-tone="ready" role="status">
                      <StatusChip tone="ready" value={m.onboarding_voice_skipped({}, options)} />
                    </div>
                  ) : voiceSupported === false ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_microphone_unsupported({}, options)} />
                      <div className="aksa-state-panel__actions">
                        <button
                          className="aksa-button aksa-button--secondary"
                          onClick={() => {
                            setVoiceSkippedText(true);
                            setSubstepIndex(9);
                          }}
                          type="button"
                        >
                          {m.onboarding_continue_text({}, options)}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="aksa-onboarding__controls">
                        <button
                          className="aksa-button aksa-button--primary"
                          onClick={() => void requestMicrophone()}
                          type="button"
                        >
                          <Mic aria-hidden="true" className="aksa-icon" />
                          <span>{m.onboarding_allow_microphone({}, options)}</span>
                        </button>
                        <button
                          className="aksa-button aksa-button--secondary"
                          onClick={() => {
                            setVoiceSkippedText(true);
                            setSubstepIndex(9);
                          }}
                          type="button"
                        >
                          <span>{m.onboarding_continue_text({}, options)}</span>
                        </button>
                      </div>
                      <div className="aksa-onboarding-privacy-notice">
                        <Shield aria-hidden="true" className="aksa-icon" size={14} />
                        <span>{m.onboarding_voice_privacy_note({}, options)}</span>
                      </div>
                    </>
                  )}

                  {microphoneOutcome === "granted" ? (
                    <StatusChip tone="ready" value={m.onboarding_microphone_granted({}, options)} />
                  ) : null}

                  {microphoneOutcome === "denied" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_microphone_denied({}, options)} />
                      <div className="aksa-state-panel__actions">
                        <button
                          className="aksa-button aksa-button--primary"
                          onClick={() => void requestMicrophone()}
                          type="button"
                        >
                          {m.onboarding_try_microphone_again({}, options)}
                        </button>
                        <button
                          className="aksa-button aksa-button--secondary"
                          onClick={() => {
                            setVoiceSkippedText(true);
                            setSubstepIndex(9);
                          }}
                          type="button"
                        >
                          {m.onboarding_continue_text({}, options)}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Substep 9: Voice Test */}
              {substepIndex === 9 ? (
                <div className="aksa-onboarding-panel">
                  {voiceSupported === false ? (
                    <StatusChip tone="attention" value={m.onboarding_microphone_unsupported({}, options)} />
                  ) : (
                    <div className="aksa-onboarding__controls">
                      {isListening ? (
                        <button className="aksa-button aksa-button--secondary" onClick={stopVoiceTest} type="button">
                          <Mic aria-hidden="true" className="aksa-icon" />
                          <span>{m.composer_stop_listening({}, options)}</span>
                        </button>
                      ) : (
                        <button className="aksa-button aksa-button--primary" onClick={runVoiceTest} type="button">
                          <Mic aria-hidden="true" className="aksa-icon" />
                          <span>{m.composer_start_listening({}, options)}</span>
                        </button>
                      )}
                      <button className="aksa-button aksa-button--quiet" onClick={() => setTranscript("")} type="button">
                        {m.composer_clear({}, options)}
                      </button>
                    </div>
                  )}

                  <div className="aksa-field">
                    <label className="aksa-label" htmlFor="onboarding-transcript">
                      {m.onboarding_voice_transcript_label({}, options)}
                    </label>
                    <textarea
                      className="aksa-textarea"
                      id="onboarding-transcript"
                      onChange={(event) => setTranscript(event.target.value)}
                      placeholder={m.onboarding_first_command_example({}, options)}
                      rows={2}
                      value={transcript}
                    />
                  </div>
                </div>
              ) : null}

              {/* Phase 3 Footer */}
              <div className="aksa-onboarding-footer">
                <button className="aksa-button aksa-button--quiet" onClick={() => goToPhase(2)} type="button">
                  {m.onboarding_back({}, options)}
                </button>
                <div className="aksa-onboarding-footer__right">
                  <button className="aksa-button aksa-button--quiet" onClick={skipPhase3} type="button">
                    {m.onboarding_skip_voice({}, options)}
                  </button>
                  <button
                    className="aksa-button aksa-button--primary"
                    onClick={() => (substepIndex < 9 ? setSubstepIndex(9) : goToPhase(4))}
                    type="button"
                  >
                    <span>{m.onboarding_continue({}, options)}</span>
                    <ChevronRight aria-hidden="true" className="aksa-icon" size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Phase 4: First Task */}
          {currentPhase === 4 ? (
            <div className="aksa-onboarding-phase">
              {!taskSubmitted ? (
                <>
                  <h1 className="aksa-onboarding__heading" data-onboarding-heading ref={headingRef} tabIndex={-1}>
                    {m.onboarding_first_task_title({}, options)}
                  </h1>
                  <p className="aksa-onboarding__description">
                    {m.onboarding_first_task_desc({}, options)}
                  </p>

                  <div className="aksa-onboarding-panel">
                    <div className="aksa-field">
                      <label className="aksa-label" htmlFor="onboarding-first-command">
                        {m.composer_input_label({}, options)}
                      </label>
                      <input
                        className="aksa-input"
                        id="onboarding-first-command"
                        onChange={(e) => setFirstCommand(e.target.value)}
                        placeholder={m.onboarding_first_command_example({}, options)}
                        type="text"
                        value={firstCommand}
                      />
                    </div>

                    <div className="aksa-onboarding-suggestions">
                      <p className="aksa-hint">{m.composer_examples_label({}, options)}</p>
                      <div className="aksa-onboarding-suggestions__list">
                        {[
                          { short: m.onboarding_suggestion_1_short({}, options), full: m.onboarding_suggestion_1({}, options) },
                          { short: m.onboarding_suggestion_2_short({}, options), full: m.onboarding_suggestion_2({}, options) },
                          { short: m.onboarding_suggestion_3_short({}, options), full: m.onboarding_suggestion_3({}, options) }
                        ].map((item) => (
                          <button
                            key={item.full}
                            className="aksa-button aksa-button--secondary"
                            onClick={() => {
                              setFirstCommand(item.full);
                              document.getElementById("onboarding-first-command")?.focus();
                            }}
                            type="button"
                          >
                            <Sparkles aria-hidden="true" className="aksa-icon" size={14} />
                            <span>{item.short}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="aksa-onboarding-footer">
                    <button className="aksa-button aksa-button--quiet" onClick={() => goToPhase(3)} type="button">
                      {m.onboarding_back({}, options)}
                    </button>
                    <div className="aksa-onboarding-footer__right">
                      <button
                        className="aksa-button aksa-button--primary"
                        onClick={() => setTaskSubmitted(true)}
                        type="button"
                      >
                        <span>{m.onboarding_continue({}, options)}</span>
                        <ChevronRight aria-hidden="true" className="aksa-icon" size={18} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="aksa-onboarding__heading" data-onboarding-heading ref={headingRef} tabIndex={-1}>
                    {m.onboarding_ready_title({}, options)}
                  </h1>
                  <p className="aksa-onboarding__description">
                    {m.onboarding_complete_body({}, options)}
                  </p>

                  <div className="aksa-onboarding-complete-box">
                    <StatusChip tone="ready" value={m.onboarding_ready_title({}, options)} />
                  </div>

                  <div className="aksa-onboarding-footer aksa-onboarding-footer--right">
                    <Link className="aksa-button aksa-button--secondary" href="/workspace/accessibility" onClick={finish}>
                      {m.onboarding_review_settings({}, options)}
                    </Link>
                    <Link className="aksa-button aksa-button--primary" href="/workspace" onClick={finish}>
                      <span>{m.onboarding_enter_workspace({}, options)}</span>
                      <ChevronRight aria-hidden="true" className="aksa-icon" size={18} />
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
