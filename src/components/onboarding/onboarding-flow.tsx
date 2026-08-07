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

import { HeadControlProvider, useHeadControl } from "@/lib/client/vision/head-control-context";

export type OnboardingPhase = 1 | 2 | 3 | 4;

type PermissionOutcome = "idle" | "granted" | "paused" | "denied" | "unavailable" | "insecure";

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

function getNestedPartLabel(phaseId: OnboardingPhase, substepIndex: number): string | null {
  if (phaseId === 2) {
    if (substepIndex <= 5) return "Part 1 of 2";
    return "Part 2 of 2";
  }
  if (phaseId === 3) {
    if (substepIndex <= 8) return "Part 1 of 2";
    return "Part 2 of 2";
  }
  return null;
}

export function OnboardingFlow({ locale }: { locale: Locale }) {
  return (
    <HeadControlProvider>
      <OnboardingFlowContent locale={locale} />
    </HeadControlProvider>
  );
}

function OnboardingFlowContent({ locale }: { locale: Locale }) {
  const headControl = useHeadControl();
  // Underlying 12 substeps mapping into 4 phases
  const [substepIndex, setSubstepIndex] = useOnboardingStep(12);

  // Local states
  const [cameraOutcome, setCameraOutcome] = useState<PermissionOutcome>("idle");
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
  const options = { locale };

  // Calculate current visible phase (1 to 4)
  let currentPhase: OnboardingPhase = 1;
  if (substepIndex >= 0 && substepIndex <= 1) currentPhase = 1;
  else if (substepIndex >= 2 && substepIndex <= 6) currentPhase = 2;
  else if (substepIndex >= 7 && substepIndex <= 9) currentPhase = 3;
  else currentPhase = 4;

  const browserVoiceSupported = useBrowserValue(isSpeechRecognitionSupported, false);
  const voiceSupported = browserVoiceSupported && !recognitionFailed;

  // Programmatic Focus on phase transition without text selection or visible outline box
  useEffect(() => {
    if (mounted && headingRef.current) {
      headingRef.current.focus({ preventScroll: true });
    }
  }, [currentPhase, substepIndex, mounted]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
    setCameraOutcome("paused");
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const requestCamera = useCallback(async () => {
    if (!window.isSecureContext) {
      setCameraOutcome("insecure");
      return;
    }

    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setCameraOutcome("unavailable");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
        await headControl.startCamera(videoRef.current, stream);
      }
      setCameraOutcome("granted");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      setCameraOutcome(name === "NotFoundError" || name === "DevicesNotFoundError" ? "unavailable" : "denied");
    }
  }, [headControl]);

  const handleStartCalibration = useCallback(() => {
    headControl.startCalibration();
  }, [headControl]);

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
    if (targetPhase === 1) setSubstepIndex(0);
    else if (targetPhase === 2) setSubstepIndex(2);
    else if (targetPhase === 3) setSubstepIndex(7);
    else setSubstepIndex(10);
  };

  const skipPhase2 = () => {
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
              const isAvailable = isCompleted || isActive;
              const progressPercentage = getPhaseRadialProgress(p.id, currentPhase, substepIndex);
              const partLabel = getNestedPartLabel(p.id, substepIndex);
              const CIRCUMFERENCE = 75.398;
              const dashOffset = CIRCUMFERENCE - (progressPercentage / 100) * CIRCUMFERENCE;

              return (
                <li key={p.id} className="aksa-onboarding-rail__item">
                  {idx > 0 ? <div className={`aksa-onboarding-rail__connector ${isCompleted ? "is-completed" : ""}`} /> : null}
                  <button
                    aria-current={isActive ? "step" : undefined}
                    className={`aksa-onboarding-rail__button ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`}
                    disabled={!isAvailable}
                    onClick={() => goToPhase(p.id)}
                    tabIndex={isAvailable ? 0 : -1}
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
                      {isActive && partLabel ? (
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
            <div className="aksa-onboarding-phase">
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
                  {cameraOutcome === "idle" ? (
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

                  {cameraOutcome === "granted" ? (
                    <div className="aksa-onboarding-preview-box">
                      <div className="aksa-onboarding-preview-header">
                        <StatusChip tone="ready" value={m.onboarding_camera_active({}, options)} />
                        <span className="aksa-hint">{m.onboarding_camera_guidance({}, options)}</span>
                      </div>
                      <div className="aksa-camera-preview-container">
                        <video
                          aria-label={m.onboarding_camera_preview_label({}, options)}
                          autoPlay
                          className="aksa-camera-preview"
                          muted
                          playsInline
                          ref={videoRef}
                        />
                      </div>
                      <button className="aksa-button aksa-button--secondary" onClick={stopCamera} type="button">
                        <CameraOff aria-hidden="true" className="aksa-icon" />
                        <span>{m.onboarding_pause_camera({}, options)}</span>
                      </button>
                    </div>
                  ) : null}

                  {cameraOutcome === "paused" ? (
                    <div className="aksa-onboarding-preview-box">
                      <p className="aksa-hint">Camera paused.</p>
                      <button className="aksa-button aksa-button--primary" onClick={() => void requestCamera()} type="button">
                        <Camera aria-hidden="true" className="aksa-icon" />
                        <span>{m.onboarding_resume_camera({}, options)}</span>
                      </button>
                    </div>
                  ) : null}

                  {cameraOutcome === "denied" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_camera_denied({}, options)} />
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

                  {cameraOutcome === "unavailable" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_camera_unavailable({}, options)} />
                    </div>
                  ) : null}

                  {cameraOutcome === "insecure" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_camera_insecure({}, options)} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Substep 4 & 5: Calibration / Head setup */}
              {substepIndex === 4 || substepIndex === 5 ? (
                <div className="aksa-onboarding-panel">
                  <p className="aksa-hint">{m.onboarding_head_setup_detail({}, options)}</p>

                  <div className="aksa-onboarding-calibration-box" style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <StatusChip
                        tone={
                          headControl.calibrationState.status === "completed"
                            ? "ready"
                            : headControl.calibrationState.status === "failed"
                              ? "attention"
                              : headControl.calibrationState.status === "capturing"
                                ? "pending"
                                : "neutral"
                        }
                        value={
                          headControl.calibrationState.status === "completed"
                            ? "Neutral position calibrated successfully"
                            : headControl.calibrationState.status === "capturing"
                              ? `Capturing baseline... ${Math.round(headControl.calibrationState.progressRatio * 100)}%`
                              : headControl.calibrationState.status === "failed"
                                ? headControl.calibrationState.errorMessage ?? "Calibration failed"
                                : "Neutral pose not calibrated"
                        }
                      />
                    </div>

                    {headControl.calibrationState.status === "capturing" ? (
                      <div className="aksa-progress-bar-container" style={{ width: "100%", height: "8px", background: "var(--color-aksa-line)", borderRadius: "4px", overflow: "hidden", marginBottom: "16px" }}>
                        <div
                          style={{
                            width: `${Math.round(headControl.calibrationState.progressRatio * 100)}%`,
                            height: "100%",
                            background: "var(--color-aksa-teal-deep)",
                            transition: "width 100ms ease"
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="aksa-onboarding__controls" style={{ display: "flex", gap: "12px" }}>
                      <button
                        className="aksa-button aksa-button--primary"
                        disabled={headControl.calibrationState.status === "capturing"}
                        onClick={handleStartCalibration}
                        type="button"
                      >
                        <Sparkles aria-hidden="true" className="aksa-icon" size={16} />
                        <span>{headControl.calibrationState.status === "completed" ? "Recalibrate neutral pose" : "Calibrate neutral pose"}</span>
                      </button>
                      <button
                        className="aksa-button aksa-button--secondary"
                        onClick={skipPhase2}
                        type="button"
                      >
                        <span>{m.onboarding_skip_head({}, options)}</span>
                      </button>
                    </div>
                  </div>
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
                    onClick={() => (substepIndex < 6 ? setSubstepIndex(6) : goToPhase(3))}
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
