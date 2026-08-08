"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Crosshair,
  Mic,
  Sparkles,
  MousePointer,
  Keyboard,
  Shield
} from "lucide-react";
import DefaultLogo from "../../../logo/Default.svg";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { OnboardingVoiceDemoState } from "@/lib/contracts/onboarding-voice";
import {
  createRecognition,
  isSpeechRecognitionSupported,
  transcriptFromEvent,
  type SpeechRecognitionLike
} from "@/lib/client/voice/speech-recognition";
import { useBrowserValue } from "@/lib/client/state/use-browser-value";
import {
  applyOnboardingVoiceIntent,
  resolveOnboardingVoiceCommand
} from "@/lib/client/voice/onboarding-voice-task";
import {
  clearOnboardingStep,
  useOnboardingStep
} from "@/lib/client/state/onboarding-step-store";
import { PENDING_COMMAND_STORAGE_KEY } from "@/lib/client/state/pending-command";
import { AccessibilityControls } from "@/components/workspace/accessibility-controls";
import { StatusChip } from "@/components/workspace/status-chip";
import { AccessibilityWidget } from "@/components/shared/accessibility-widget";

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

function getPhaseRadialProgress(phaseId: OnboardingPhase, currentPhase: OnboardingPhase): number {
  if (currentPhase > phaseId) return 100;
  if (currentPhase < phaseId) return 0;

  if (phaseId === 1) return 100;
  if (phaseId === 2 || phaseId === 3) return 100;
  return 100;
}

function calibrationDirectionLabel(
  direction: "center" | "left" | "right" | "up" | "down" | "return_center",
  options: { locale: Locale }
): string {
  if (direction === "left") return m.onboarding_calibration_direction_left({}, options);
  if (direction === "right") return m.onboarding_calibration_direction_right({}, options);
  if (direction === "up") return m.onboarding_calibration_direction_up({}, options);
  if (direction === "down") return m.onboarding_calibration_direction_down({}, options);
  if (direction === "return_center") return m.onboarding_calibration_direction_return_center({}, options);
  return m.onboarding_calibration_direction_center({}, options);
}

function CalibrationDirectionIcon({
  direction
}: {
  direction: "center" | "left" | "right" | "up" | "down" | "return_center";
}) {
  if (direction === "left") return <ArrowLeft aria-hidden="true" size={24} />;
  if (direction === "right") return <ArrowRight aria-hidden="true" size={24} />;
  if (direction === "up") return <ArrowUp aria-hidden="true" size={24} />;
  if (direction === "down") return <ArrowDown aria-hidden="true" size={24} />;
  return <Crosshair aria-hidden="true" size={22} />;
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
  const [voiceDemoState, setVoiceDemoState] = useState<OnboardingVoiceDemoState>({
    includeSources: false,
    addSummary: false,
    highlightColor: "blue"
  });
  const [voiceTaskStatus, setVoiceTaskStatus] = useState<
    "idle" | "classifying" | "mismatch" | "complete" | "no_speech" | "service_unavailable"
  >("idle");
  const [voiceFailureReason, setVoiceFailureReason] = useState<
    "none" | "no_speech" | "microphone_unavailable" | "recognition_error"
  >("none");
  const [firstCommand, setFirstCommand] = useState<string>("");
  const [taskSubmitted, setTaskSubmitted] = useState(false);
  const [selectedCards, setSelectedCards] = useState<{ head: boolean; voice: boolean }>({ head: true, voice: true });

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const controlVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const voiceRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceClassifyAttemptRef = useRef(0);
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

  useEffect(() => {
    const preview = previewVideoRef.current;
    const stream = streamRef.current;
    if (!preview || !stream) return;

    preview.srcObject = stream;
    const playback = preview.play();
    if (playback && typeof playback.catch === "function") {
      void playback.catch(() => {
        // Muted preview playback can be blocked without affecting control tracking.
      });
    }
  }, [cameraOutcome, currentPhase]);

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

    // Tracking loss is recoverable on the existing stream. Never request a
    // second camera while the provider still owns the active processing loop.
    if (
      headControl.lifecycleState === "active" ||
      headControl.lifecycleState === "tracking_lost"
    ) {
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
      const videoElement = controlVideoRef.current;
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
  const calibrationInstruction =
    headControl.calibrationState.direction === "left"
      ? {
          title: m.onboarding_calibration_left_title({}, options),
          helper: m.onboarding_calibration_left_helper({}, options)
        }
      : headControl.calibrationState.direction === "right"
        ? {
            title: m.onboarding_calibration_right_title({}, options),
            helper: m.onboarding_calibration_right_helper({}, options)
          }
        : headControl.calibrationState.direction === "up"
          ? {
              title: m.onboarding_calibration_up_title({}, options),
              helper: m.onboarding_calibration_up_helper({}, options)
            }
          : headControl.calibrationState.direction === "down"
            ? {
                title: m.onboarding_calibration_down_title({}, options),
                helper: m.onboarding_calibration_down_helper({}, options)
              }
            : headControl.calibrationState.direction === "return_center"
              ? {
                  title: m.onboarding_calibration_return_center_title({}, options),
                  helper: m.onboarding_calibration_return_center_helper({}, options)
                }
              : {
          title: m.onboarding_calibration_center_title({}, options),
          helper: m.onboarding_calibration_center_helper({}, options)
        };
  const calibrationStepDirection = calibrationDirectionLabel(
    headControl.calibrationState.direction,
    options
  );
  const trackingReady =
    effectiveCameraOutcome === "active" && headControl.lifecycleState === "active";
  const calibrationCopy = !canCalibrate
    ? effectiveCameraOutcome === "active" && headControl.lifecycleState === "tracking_lost"
      ? m.onboarding_calibration_tracking_interrupted({}, options)
      : m.onboarding_calibration_tracking_required({}, options)
    : calibrationStatus === "completed"
      ? m.onboarding_calibration_success_title({}, options)
    : calibrationStatus === "capturing"
        ? calibrationInstruction.title
    : calibrationStatus === "failed"
      ? headControl.calibrationState.errorMessage === "tracking_lost"
        ? m.onboarding_calibration_tracking_interrupted({}, options)
            : m.onboarding_calibration_position_failed({}, options)
          : m.onboarding_calibration_center_title({}, options);
  const calibrationHelper = !trackingReady
    ? m.onboarding_head_setup_detail({}, options)
    : calibrationStatus === "capturing"
      ? calibrationInstruction.helper
      : calibrationStatus === "completed"
        ? m.onboarding_calibration_success_helper({}, options)
        : m.onboarding_calibration_center_helper({}, options);

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
      setSubstepIndex(9);
    } catch {
      setMicrophoneOutcome("denied");
    }
  }, [setSubstepIndex]);

  const runVoiceTest = useCallback(() => {
    const recognition = createRecognition(locale === "id" ? "id" : "en");
    if (recognition === null) {
      setRecognitionFailed(true);
      return;
    }

    voiceRecognitionRef.current?.abort();
    voiceRecognitionRef.current = recognition;
    setIsListening(true);
    setVoiceFailureReason("none");
    setVoiceTaskStatus("idle");
    recognition.onresult = (event) => {
      const heard = transcriptFromEvent(event);
      setTranscript(heard);
      if (heard === "") {
        setVoiceFailureReason("no_speech");
        setVoiceTaskStatus("no_speech");
        return;
      }

      const attempt = voiceClassifyAttemptRef.current + 1;
      voiceClassifyAttemptRef.current = attempt;
      setVoiceTaskStatus("classifying");
      void resolveOnboardingVoiceCommand({
        transcript: heard,
        locale: locale === "id" ? "id" : "en",
        state: voiceDemoState
      }).then((result) => {
        if (voiceClassifyAttemptRef.current !== attempt) return;
        if (result.status === "matched") {
          setVoiceDemoState((current) => applyOnboardingVoiceIntent(current, result.result));
          setVoiceTaskStatus("complete");
        } else if (result.status === "unknown") {
          setVoiceTaskStatus("mismatch");
        } else {
          setVoiceTaskStatus("service_unavailable");
        }
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicrophoneOutcome("denied");
      } else if (event.error === "audio-capture") {
        setVoiceFailureReason("microphone_unavailable");
        setVoiceTaskStatus("service_unavailable");
      } else if (event.error === "no-speech") {
        setVoiceFailureReason("no_speech");
        setVoiceTaskStatus("no_speech");
      } else {
        setVoiceFailureReason("recognition_error");
        setVoiceTaskStatus("service_unavailable");
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      if (voiceRecognitionRef.current === recognition) {
        voiceRecognitionRef.current = null;
      }
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setMicrophoneOutcome("denied");
      setVoiceFailureReason("recognition_error");
      setIsListening(false);
    }
  }, [locale, voiceDemoState]);

  const stopVoiceTest = useCallback(() => {
    voiceClassifyAttemptRef.current += 1;
    voiceRecognitionRef.current?.abort();
    voiceRecognitionRef.current = null;
    setIsListening(false);
  }, []);

  const finish = useCallback(() => {
    stopVoiceTest();
    if (firstCommand.trim() !== "") {
      window.sessionStorage.setItem(PENDING_COMMAND_STORAGE_KEY, firstCommand.trim());
    }
    clearOnboardingStep();
  }, [firstCommand, stopVoiceTest]);

  const disableHeadControl = useCallback(() => {
    cameraAttemptRef.current += 1;
    headControl.disableControl();
    streamRef.current = null;
    if (controlVideoRef.current) {
      controlVideoRef.current.srcObject = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setCameraOutcome("idle");
    setCameraFailure(null);
  }, [headControl]);

  const disableVoiceControl = useCallback(() => {
    stopVoiceTest();
    setVoiceSkippedText(true);
  }, [stopVoiceTest]);

  const nextEnabledPhase = useCallback(
    (targetPhase: OnboardingPhase): OnboardingPhase => {
      if (targetPhase === 2 && !selectedCards.head) {
        return selectedCards.voice ? 3 : 4;
      }
      if (targetPhase === 3 && !selectedCards.voice) {
        return 4;
      }
      return targetPhase;
    },
    [selectedCards]
  );

  // Phase navigation
  const goToPhase = (targetPhase: OnboardingPhase) => {
    const resolvedPhase = nextEnabledPhase(targetPhase);
    if (resolvedPhase !== 3) stopVoiceTest();
    // Entering Head Control always starts with its explanation before calibration/tuning.
    setSubstepIndex(resolvedPhase === 2 ? 2 : phaseSubstepRef.current[resolvedPhase]);
  };

  const skipPhase2 = () => {
    disableHeadControl();
    setSelectedCards((previous) => ({ ...previous, head: false }));
    setSubstepIndex(selectedCards.voice ? phaseSubstepRef.current[3] : phaseSubstepRef.current[4]);
  };

  const skipPhase3 = () => {
    disableVoiceControl();
    setSelectedCards((previous) => ({ ...previous, voice: false }));
    setSubstepIndex(phaseSubstepRef.current[4]);
  };

  const toggleHeadOption = () => {
    const enabled = !selectedCards.head;
    setSelectedCards((previous) => ({ ...previous, head: enabled }));
    if (!enabled) disableHeadControl();
  };

  const toggleVoiceOption = () => {
    const enabled = !selectedCards.voice;
    setSelectedCards((previous) => ({ ...previous, voice: enabled }));
    if (!enabled) disableVoiceControl();
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
              const progressPercentage = getPhaseRadialProgress(p.id, currentPhase);
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
                      {p.optional ? (
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
                  onClick={toggleHeadOption}
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
                  onClick={toggleVoiceOption}
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
                <button
                  className="aksa-button aksa-button--primary"
                  onClick={() => goToPhase(selectedCards.head ? 2 : selectedCards.voice ? 3 : 4)}
                  type="button"
                >
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
                {m.onboarding_head_explanation_title({}, options)}
              </h1>
              <p className="aksa-onboarding__description">
                {m.onboarding_head_explanation_desc({}, options)}
              </p>
              {/* Camera permission and calibration share one responsive surface. */}
              <div className="aksa-onboarding-panel aksa-onboarding-panel--head-control">
                <div
                  className="aksa-camera-preview-container"
                  hidden={effectiveCameraOutcome !== "active"}
                >
                  <video
                    aria-label={m.onboarding_camera_preview_label({}, options)}
                    autoPlay
                    className="aksa-camera-preview aksa-camera-preview--mirrored"
                    muted
                    playsInline
                    ref={previewVideoRef}
                  />
                  {effectiveCameraOutcome === "active" ? (
                    <>
                      <div className="aksa-camera-preview__status">
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
                      </div>
                      <div
                        aria-labelledby="onboarding-calibration-title"
                        className="aksa-camera-preview__calibration"
                        role="status"
                      >
                        <div className="aksa-camera-preview__calibration-copy">
                          <div className="aksa-camera-preview__calibration-title" id="onboarding-calibration-title">
                            {calibrationCopy}
                          </div>
                          <p className="aksa-camera-preview__calibration-helper">{calibrationHelper}</p>
                          {calibrationStatus === "capturing" ? (
                            <p className="aksa-camera-preview__calibration-step" aria-live="polite">
                              {m.onboarding_calibration_step(
                                {
                                  step: String(headControl.calibrationState.step),
                                  direction: calibrationStepDirection
                                },
                                options
                              )}
                            </p>
                          ) : null}
                        </div>
                        <div
                          aria-label={calibrationStepDirection}
                          className={`aksa-camera-preview__target aksa-camera-preview__target--${headControl.calibrationState.direction}`}
                          role="img"
                        >
                          <CalibrationDirectionIcon direction={headControl.calibrationState.direction} />
                        </div>
                        {calibrationStatus === "capturing" ? (
                          <div
                            aria-label={m.onboarding_calibration_progress_label({}, options)}
                            aria-valuemax={100}
                            aria-valuemin={0}
                            aria-valuenow={calibrationProgress}
                            className="aksa-camera-preview__progress"
                            role="progressbar"
                          >
                            <div
                              className="aksa-camera-preview__progress-value"
                              style={{ width: `${calibrationProgress}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>

                {effectiveCameraOutcome === "idle" ? (
                  <>
                    <div className="aksa-onboarding-calibration-waiting" role="status">
                      <StatusChip
                        tone="pending"
                        value={m.onboarding_calibration_tracking_required({}, options)}
                      />
                      <p>{m.onboarding_head_setup_detail({}, options)}</p>
                    </div>
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
                        onClick={skipPhase2}
                        type="button"
                      >
                        <span>{m.onboarding_continue_no_camera({}, options)}</span>
                      </button>
                    </div>
                    <div className="aksa-onboarding-privacy-notice">
                      <Shield aria-hidden="true" className="aksa-icon" size={14} />
                      <span>{m.onboarding_head_privacy_note({}, options)}</span>
                    </div>
                    <div className="aksa-onboarding-head-actions">
                      <button
                        className="aksa-button aksa-button--primary"
                        disabled
                        onClick={handleStartCalibration}
                        type="button"
                      >
                        <Sparkles aria-hidden="true" className="aksa-icon" size={16} />
                        <span>{m.onboarding_calibration_start({}, options)}</span>
                      </button>
                    </div>
                  </>
                ) : null}

                {effectiveCameraOutcome === "starting" ? (
                  <StatusChip tone="pending" value={m.a11y_initializing_head_control({}, options)} />
                ) : null}

                {effectiveCameraOutcome === "active" ? (
                  <div className="aksa-onboarding-head-actions">
                    {calibrationStatus === "capturing" ? (
                      <button
                        className="aksa-button aksa-button--secondary"
                        onClick={headControl.cancelCalibration}
                        type="button"
                      >
                        {m.onboarding_calibration_cancel({}, options)}
                      </button>
                    ) : (
                      <button
                        className="aksa-button aksa-button--primary"
                        disabled={!canCalibrate}
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
                    <button className="aksa-button aksa-button--secondary" onClick={stopCamera} type="button">
                      <CameraOff aria-hidden="true" className="aksa-icon" />
                      <span>{m.onboarding_pause_camera({}, options)}</span>
                    </button>
                  </div>
                ) : null}

                {effectiveCameraOutcome === "paused" ? (
                  <div className="aksa-onboarding-camera-state">
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
                      <button className="aksa-button aksa-button--secondary" onClick={skipPhase2} type="button">
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

              {/* Pointer Feel appears only after the camera calibration is complete. */}
              {calibrationStatus === "completed" ? (
                <section
                  aria-labelledby="onboarding-pointer-feel-title"
                  className="aksa-onboarding-pointer-feel"
                >
                  <div className="aksa-onboarding-pointer-feel__header">
                    <h2 id="onboarding-pointer-feel-title">{m.onboarding_tuning_title({}, options)}</h2>
                    <p>{m.onboarding_tuning_body({}, options)}</p>
                  </div>
                  <AccessibilityControls initialProfile={headControl.profile} locale={locale} />
                </section>
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
                    onClick={() => goToPhase(selectedCards.voice ? 3 : 4)}
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
                {m.onboarding_voice_task_title({}, options)}
              </h1>
              <p className="aksa-onboarding__description">
                {m.onboarding_voice_task_body({}, options)}
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

                  {microphoneOutcome === "unavailable" ? (
                    <div className="aksa-state-panel" data-tone="attention" role="status">
                      <StatusChip tone="attention" value={m.onboarding_microphone_unavailable({}, options)} />
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
                  ) : null}
                </div>
              ) : null}

              {/* Substep 9: Voice Test */}
              {substepIndex === 9 ? (
                <div className="aksa-onboarding-panel">
                  <p className="aksa-onboarding-voice-task__prompt">{m.onboarding_voice_task_prompt({}, options)}</p>
                  <div aria-label={m.onboarding_voice_demo_project({}, options)} className="aksa-onboarding-voice-demo" role="group">
                    <div className="aksa-onboarding-voice-demo__header">
                      <h2 className="aksa-onboarding-voice-demo__title">
                        {m.onboarding_voice_demo_project({}, options)}
                      </h2>
                      <span className="aksa-hint">{m.onboarding_voice_demo_local({}, options)}</span>
                    </div>
                    <div className="aksa-onboarding-voice-demo__tasks">
                      <div
                        aria-checked={voiceDemoState.includeSources}
                        className={`aksa-onboarding-voice-demo__task ${voiceDemoState.includeSources ? "is-checked" : ""}`}
                        role="checkbox"
                      >
                        <span aria-hidden="true" className="aksa-onboarding-voice-demo__checkbox">
                          {voiceDemoState.includeSources ? <Check size={16} /> : null}
                        </span>
                        <span>{m.onboarding_voice_demo_include_sources({}, options)}</span>
                      </div>
                      <div
                        aria-checked={voiceDemoState.addSummary}
                        className={`aksa-onboarding-voice-demo__task ${voiceDemoState.addSummary ? "is-checked" : ""}`}
                        role="checkbox"
                      >
                        <span aria-hidden="true" className="aksa-onboarding-voice-demo__checkbox">
                          {voiceDemoState.addSummary ? <Check size={16} /> : null}
                        </span>
                        <span>{m.onboarding_voice_demo_add_summary({}, options)}</span>
                      </div>
                    </div>
                    <div className="aksa-onboarding-voice-demo__color">
                      <span>{m.onboarding_voice_demo_highlight({}, options)}</span>
                      <span className={`aksa-onboarding-voice-demo__color-value is-${voiceDemoState.highlightColor}`}>
                        {voiceDemoState.highlightColor === "yellow"
                          ? m.onboarding_voice_demo_color_yellow({}, options)
                          : voiceDemoState.highlightColor === "red"
                            ? m.onboarding_voice_demo_color_red({}, options)
                            : m.onboarding_voice_demo_color_blue({}, options)}
                      </span>
                    </div>
                  </div>
                  <div className="aksa-onboarding-voice-demo__commands">
                    <p className="aksa-hint">{m.onboarding_voice_demo_primary_label({}, options)}</p>
                    <code>{m.onboarding_voice_demo_primary_command({}, options)}</code>
                    <p className="aksa-hint">{m.onboarding_voice_demo_secondary_command({}, options)}</p>
                  </div>
                  {voiceSupported === false ? (
                    <StatusChip tone="attention" value={m.onboarding_microphone_unsupported({}, options)} />
                  ) : isListening ? (
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
                  <div aria-live="polite" className="aksa-onboarding-voice-task__result" role="status">
                    {isListening ? <p>{m.onboarding_voice_task_listening({}, options)}</p> : null}
                    {voiceTaskStatus === "classifying" ? (
                      <p>{m.onboarding_voice_task_classifying({}, options)}</p>
                    ) : null}
                    {transcript ? <p>{m.onboarding_voice_task_heard({ transcript }, options)}</p> : null}
                    {voiceTaskStatus === "mismatch" ? (
                      <p>{m.onboarding_voice_task_mismatch({}, options)}</p>
                    ) : null}
                    {voiceTaskStatus === "no_speech" ? (
                      <div className="aksa-onboarding-voice-task__recovery">
                        <p>{m.onboarding_voice_task_no_speech({}, options)}</p>
                        <button className="aksa-button aksa-button--secondary" onClick={runVoiceTest} type="button">
                          {m.onboarding_voice_task_retry({}, options)}
                        </button>
                      </div>
                    ) : null}
                    {voiceTaskStatus === "service_unavailable" ? (
                      <div className="aksa-onboarding-voice-task__recovery">
                        <p>
                          {voiceFailureReason === "microphone_unavailable"
                            ? m.onboarding_microphone_unavailable({}, options)
                            : voiceFailureReason === "recognition_error"
                              ? m.onboarding_voice_task_recognition_error({}, options)
                              : m.onboarding_voice_task_service_unavailable({}, options)}
                        </p>
                        <div className="aksa-state-panel__actions">
                          <button className="aksa-button aksa-button--secondary" onClick={runVoiceTest} type="button">
                            {m.onboarding_voice_task_retry({}, options)}
                          </button>
                          <button
                            className="aksa-button aksa-button--quiet"
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
                    {voiceTaskStatus === "complete" ? (
                      <div className="aksa-onboarding-voice-task__success">
                        <p>{m.onboarding_voice_task_success({}, options)}</p>
                        <p>{m.onboarding_voice_task_ready({}, options)}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Phase 3 Footer */}
              <div className="aksa-onboarding-footer">
                <button
                  className="aksa-button aksa-button--quiet"
                  onClick={() => goToPhase(selectedCards.head ? 2 : 1)}
                  type="button"
                >
                  {m.onboarding_back({}, options)}
                </button>
                <div className="aksa-onboarding-footer__right">
                  <button className="aksa-button aksa-button--quiet" onClick={skipPhase3} type="button">
                    {m.onboarding_skip_voice({}, options)}
                  </button>
                  <button
                    className="aksa-button aksa-button--primary"
                    onClick={() => goToPhase(4)}
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
                    <button
                      className="aksa-button aksa-button--quiet"
                      onClick={() => goToPhase(selectedCards.voice ? 3 : selectedCards.head ? 2 : 1)}
                      type="button"
                    >
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
      <video
        aria-hidden="true"
        autoPlay
        className="aksa-camera-control-video"
        muted
        playsInline
        ref={controlVideoRef}
        tabIndex={-1}
      />
      <AccessibilityWidget locale={locale} />
    </div>
  );
}
