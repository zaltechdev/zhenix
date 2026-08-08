"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  provisionalAccessibilityProfile,
  type AccessibilityProfile
} from "@/lib/contracts/auth";
import { NeutralBaseline } from "./head-pose";
import {
  VelocityController,
  clampCoordinates,
  PoseInputStabilizer,
  Vector2D,
  defaultDeadZone,
  scaleDeadZone,
  type CalibratedDeadZone
} from "./pointer-mapping";
import { resolveTargetAtPoint } from "./target-resolver";
import { TargetAssistController } from "./target-assist";
import { RestLockController } from "./rest-lock";
import {
  FreshFrameClock,
  TrackingReacquisitionController
} from "./tracking-stability";
import { DwellController, DwellProgress } from "./dwell-controller";
import { GestureDetector, GestureStatus } from "./gesture-detector";
import {
  VisionEngine,
  cameraFailureFromException,
  type VisionEngineCallbacks,
  type VisionFailureCategory,
  type VisionFrameData,
  type VisionLifecycleState
} from "./vision-engine";
import {
  CALIBRATION_CONFIG,
  CalibrationEngine,
  CalibrationState,
  type DirectionalCalibrationRange
} from "./calibration";
import { AksaPointer } from "@/components/workspace/aksa-pointer";
import { getCachedProfile, setCachedProfile } from "./profile-cache";

export interface HeadControlContextValue {
  userId: string | null;
  lifecycleState: VisionLifecycleState;
  errorCategory: VisionFailureCategory | null;
  pointerPosition: Vector2D;
  activeTarget: HTMLElement | null;
  dwellProgress: DwellProgress;
  gestureStatus: GestureStatus;
  activationFeedbackKey: number;
  isRestLocked: boolean;
  profile: AccessibilityProfile;
  neutralBaseline: NeutralBaseline | null;
  activeStream: MediaStream | null;
  calibrationState: CalibrationState;
  isPaused: boolean;
  startHeadControl: (videoElement?: HTMLVideoElement | null) => Promise<boolean>;
  startCamera: (videoElement: HTMLVideoElement, stream: MediaStream) => Promise<boolean>;
  startCalibration: () => void;
  cancelCalibration: () => void;
  pauseControl: () => void;
  resumeControl: () => void;
  disableControl: () => void;
  setNeutralBaseline: (baseline: NeutralBaseline) => void;
  updateProfile: (profile: AccessibilityProfile) => void;
  configureRuntime: (configuration: {
    userId: string | null;
    initialProfile?: AccessibilityProfile | null;
  }) => void;
}

export interface HeadControlEngine {
  initialize: () => Promise<boolean>;
  start: (videoElement: HTMLVideoElement, stream: MediaStream) => void;
  pause: () => void;
  resume: () => void;
  disable: () => void;
  setNeutralBaseline: (baseline: NeutralBaseline) => void;
}

export type HeadControlEngineFactory = (
  callbacks: VisionEngineCallbacks
) => HeadControlEngine;

const HeadControlContext = createContext<HeadControlContextValue | null>(null);

const DEFAULT_DWELL: DwellProgress = {
  state: "idle",
  progressRatio: 0,
  targetElement: null,
  activeTargetBounds: null
};

const DEFAULT_GESTURE: GestureStatus = {
  gestureType: null,
  currentScore: 0,
  thresholdNormalized: 0.5,
  isDetected: false,
  isTriggered: false,
  inCooldown: false
};

const DEFAULT_CALIBRATION: CalibrationState = {
  status: "idle",
  progressRatio: 0,
  samplesCount: 0,
  baseline: null,
  range: null,
  deadZone: null,
  direction: "center",
  step: 1,
  errorMessage: null,
  attemptId: 0
};

export function HeadControlProvider({
  children,
  userId = null,
  initialProfile,
  engineFactory = (callbacks) => new VisionEngine(callbacks)
}: {
  children: ReactNode;
  userId?: string | null;
  initialProfile?: AccessibilityProfile | null;
  engineFactory?: HeadControlEngineFactory;
}) {
  const [runtimeUserId, setRuntimeUserId] = useState<string | null>(userId);
  const [profile, setProfileState] = useState<AccessibilityProfile>(
    initialProfile ?? provisionalAccessibilityProfile
  );
  const [lifecycleState, setLifecycleState] = useState<VisionLifecycleState>("idle");
  const [errorCategory, setErrorCategory] = useState<VisionFailureCategory | null>(null);
  const [pointerPosition, setPointerPosition] = useState<Vector2D>(() =>
    typeof window !== "undefined"
      ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      : { x: 0, y: 0 }
  );
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);
  const [dwellProgress, setDwellProgress] = useState<DwellProgress>(DEFAULT_DWELL);
  const [gestureStatus, setGestureStatus] = useState<GestureStatus>(DEFAULT_GESTURE);
  const [activationFeedbackKey, setActivationFeedbackKey] = useState(0);
  const [isRestLocked, setIsRestLocked] = useState(false);
  const [neutralBaseline, setNeutralBaselineState] = useState<NeutralBaseline | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>(DEFAULT_CALIBRATION);

  // References for live callback freshness & teardown
  const profileRef = useRef<AccessibilityProfile>(profile);
  const engineRef = useRef<HeadControlEngine | null>(null);
  const dwellRef = useRef<DwellController | null>(null);
  const gestureRef = useRef<GestureDetector | null>(null);
  const calibrationEngineRef = useRef<CalibrationEngine>(new CalibrationEngine());
  const calibrationRangeRef = useRef<DirectionalCalibrationRange | null>(null);
  const calibrationDeadZoneRef = useRef<CalibratedDeadZone | null>(null);
  const calibrationFallbackRangeRef = useRef<DirectionalCalibrationRange | null>(null);
  const calibrationFallbackDeadZoneRef = useRef<CalibratedDeadZone | null>(null);
  const calibrationAttemptRef = useRef(0);
  const calibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const currentPosRef = useRef<Vector2D>(pointerPosition);
  const renderedPosRef = useRef<Vector2D>(pointerPosition);
  const reacquisitionReadyRef = useRef(false);
  const trackingWasLostRef = useRef(false);
  const frameClockRef = useRef<FreshFrameClock>(new FreshFrameClock());
  const reacquisitionRef = useRef<TrackingReacquisitionController>(
    new TrackingReacquisitionController()
  );
  const poseInputRef = useRef<PoseInputStabilizer>(new PoseInputStabilizer());
  const velocityRef = useRef<VelocityController>(new VelocityController());
  // Rest Lock and Target Assist are retained but bypassed in normal movement
  const restLockRef = useRef<RestLockController>(new RestLockController());
  const targetAssistRef = useRef<TargetAssistController>(new TargetAssistController());
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeModalRef = useRef<Element | null>(null);
  const startupCancelledRef = useRef(false);
  const runtimeUserIdRef = useRef<string | null>(userId);
  const runtimeConfiguredRef = useRef(false);
  const profileChangedBeforeIdentityRef = useRef(false);

  const resetInteractionState = useCallback((resetPointer: boolean) => {
    poseInputRef.current.reset();
    velocityRef.current.reset();
    restLockRef.current.reset();
    setIsRestLocked(false);
    targetAssistRef.current.clear();
    if (dwellRef.current) dwellRef.current.requireFreshCycle();
    if (gestureRef.current) gestureRef.current.disarmUntilRelease();
    setActiveTarget(null);
    setDwellProgress(DEFAULT_DWELL);
    setGestureStatus(DEFAULT_GESTURE);

    if (resetPointer && typeof window !== "undefined") {
      const centered = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      currentPosRef.current = centered;
      renderedPosRef.current = centered;
      setPointerPosition(centered);
    }
  }, []);

  const removeBackgroundVideo = useCallback(() => {
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.remove();
      backgroundVideoRef.current = null;
    }
  }, []);

  const ensureBackgroundVideo = useCallback(() => {
    if (backgroundVideoRef.current) return backgroundVideoRef.current;
    if (typeof document === "undefined") return null;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.display = "none";
    document.body.appendChild(video);
    backgroundVideoRef.current = video;
    return video;
  }, []);

  const cleanFailedStartup = useCallback(
    (videoElement: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // Continue cleanup so one broken track cannot leave another running.
          }
        }
      }
      if (videoElement) {
        try {
          if (!stream || videoElement.srcObject === stream) {
            videoElement.srcObject = null;
          }
        } catch {
          // The stream is already stopped; a broken video binding cannot retain it.
        }
      }
      if (videoElement === backgroundVideoRef.current) {
        removeBackgroundVideo();
      }
    },
    [removeBackgroundVideo]
  );

  // Keep profileRef.current strictly updated with current state
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /** Dispatch through the same DOM click path as mouse and keyboard before visual confirmation. */
  const dispatchHeadSelection = useCallback((target: HTMLElement) => {
    target.click();
    setActivationFeedbackKey((current) => current + 1);
  }, []);

  // Synchronize controllers with current profile settings
  useEffect(() => {
    if (!dwellRef.current) {
      dwellRef.current = new DwellController({
        dwellDurationMs: profile.dwellDurationMs ?? 1200,
        cooldownMs: 500,
        onActivate: dispatchHeadSelection
      });
    } else {
      dwellRef.current.updateConfig(profile.dwellDurationMs ?? 1200);
    }

    if (!gestureRef.current) {
      gestureRef.current = new GestureDetector({
        gestureType: profile.selectionMode === "off" ? null : profile.gestureType,
        threshold: profile.gestureThreshold ?? 50,
        cooldownMs: profile.gestureCooldownMs ?? 600,
        onActivate: dispatchHeadSelection
      });
    } else {
      gestureRef.current.updateConfig({
        gestureType:
          profile.selectionMode === "off" || profile.selectionMode === "dwell"
            ? null
            : profile.gestureType,
        threshold: profile.gestureThreshold ?? 50,
        cooldownMs: profile.gestureCooldownMs ?? 600,
        onActivate: dispatchHeadSelection
      });
    }
  }, [
    profile.dwellDurationMs,
    profile.gestureCooldownMs,
    profile.gestureThreshold,
    profile.gestureType,
    profile.selectionMode,
    dispatchHeadSelection
  ]);

  // Synchronize live profile settings & write to user-scoped cache
  const updateProfile = useCallback(
    (newProfile: AccessibilityProfile) => {
      const selectionWasChanged = profileRef.current.selectionMode !== newProfile.selectionMode;
      setProfileState(newProfile);
      profileRef.current = newProfile;
      if (!runtimeUserIdRef.current) {
        profileChangedBeforeIdentityRef.current = true;
      } else {
        void setCachedProfile(newProfile, runtimeUserIdRef.current);
      }

      if (dwellRef.current) {
        dwellRef.current.updateConfig(newProfile.dwellDurationMs ?? 1200);
        if (selectionWasChanged) {
          dwellRef.current.requireFreshCycle();
        }
      }
      if (gestureRef.current) {
        gestureRef.current.updateConfig({
          gestureType:
            newProfile.selectionMode === "off" || newProfile.selectionMode === "dwell"
              ? null
              : newProfile.gestureType,
          threshold: newProfile.gestureThreshold ?? 50,
          cooldownMs: newProfile.gestureCooldownMs ?? 600,
          onActivate: dispatchHeadSelection
        });
        if (selectionWasChanged) {
          gestureRef.current.disarmUntilRelease();
        }
      }
      if (newProfile.selectionMode === "off") {
        targetAssistRef.current.clear();
        setActiveTarget(null);
        setDwellProgress(DEFAULT_DWELL);
        setGestureStatus(DEFAULT_GESTURE);
      }
    },
    [dispatchHeadSelection]
  );

  const configureRuntime = useCallback(
    ({
      userId: nextUserId,
      initialProfile: nextInitialProfile
    }: {
      userId: string | null;
      initialProfile?: AccessibilityProfile | null;
    }) => {
      const previousUserId = runtimeUserIdRef.current;
      const changedUser = previousUserId !== nextUserId;
      const isInitialConfiguration = !runtimeConfiguredRef.current;
      runtimeConfiguredRef.current = true;
      runtimeUserIdRef.current = nextUserId;
      if (changedUser) {
        setRuntimeUserId(nextUserId);
      }

      // Preserve the active anonymous onboarding draft when entering the workspace.
      // A genuine account switch receives its own server or cached profile instead.
      const shouldApplyServerProfile =
        Boolean(nextInitialProfile) &&
        (!profileChangedBeforeIdentityRef.current || Boolean(previousUserId));

      if (changedUser && shouldApplyServerProfile && nextInitialProfile) {
        setProfileState(nextInitialProfile);
        profileRef.current = nextInitialProfile;
      }

      if ((changedUser || isInitialConfiguration) && nextUserId && !nextInitialProfile) {
        const configuredUserId = nextUserId;
        if (changedUser) {
          setProfileState(provisionalAccessibilityProfile);
          profileRef.current = provisionalAccessibilityProfile;
        }
        void getCachedProfile(configuredUserId).then((cached) => {
          if (runtimeUserIdRef.current === configuredUserId && cached) {
            setProfileState(cached);
            profileRef.current = cached;
          }
        });
      }
    },
    []
  );

  // Direct provider consumers retain the same configuration contract as the root bridge.
  useEffect(() => {
    configureRuntime({ userId, initialProfile });
  }, [configureRuntime, initialProfile, userId]);

  const setNeutralBaseline = useCallback((baseline: NeutralBaseline) => {
    setNeutralBaselineState(baseline);
    resetInteractionState(false);
    if (engineRef.current) {
      engineRef.current.setNeutralBaseline(baseline);
    }
  }, [resetInteractionState]);

  const clearCalibrationTimeout = useCallback(() => {
    if (calibrationTimeoutRef.current !== null) {
      clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
  }, []);

  const restoreCalibrationRange = useCallback(() => {
    const fallbackRange = calibrationFallbackRangeRef.current;
    calibrationRangeRef.current = fallbackRange ? { ...fallbackRange } : null;
    const fallbackDeadZone = calibrationFallbackDeadZoneRef.current;
    calibrationDeadZoneRef.current = fallbackDeadZone ? { ...fallbackDeadZone } : null;
  }, []);

  const scheduleCalibrationTimeout = useCallback(
    (attemptId: number) => {
      clearCalibrationTimeout();
      calibrationTimeoutRef.current = setTimeout(() => {
        if (calibrationAttemptRef.current !== attemptId) {
          return;
        }
        const state = calibrationEngineRef.current.fail("timeout", attemptId);
        setCalibrationState(state);
        restoreCalibrationRange();
        resetInteractionState(false);
        calibrationTimeoutRef.current = null;
      }, CALIBRATION_CONFIG.timeoutMs);
    },
    [clearCalibrationTimeout, resetInteractionState, restoreCalibrationRange]
  );

  // Calibration triggers
  const startCalibration = useCallback(() => {
    if (lifecycleState !== "active") {
      return;
    }
    clearCalibrationTimeout();
    const attemptId = calibrationEngineRef.current.start();
    const appliedRange = calibrationRangeRef.current;
    const appliedDeadZone = calibrationDeadZoneRef.current;
    calibrationFallbackRangeRef.current = appliedRange ? { ...appliedRange } : null;
    calibrationFallbackDeadZoneRef.current = appliedDeadZone ? { ...appliedDeadZone } : null;
    calibrationRangeRef.current = null;
    calibrationDeadZoneRef.current = null;
    calibrationAttemptRef.current = attemptId;
    scheduleCalibrationTimeout(attemptId);
    resetInteractionState(false);
    setCalibrationState(calibrationEngineRef.current.getState());
  }, [clearCalibrationTimeout, lifecycleState, resetInteractionState, scheduleCalibrationTimeout]);

  const cancelCalibration = useCallback(() => {
    clearCalibrationTimeout();
    calibrationAttemptRef.current += 1;
    calibrationEngineRef.current.cancel();
    restoreCalibrationRange();
    resetInteractionState(false);
    setCalibrationState(calibrationEngineRef.current.getState());
  }, [clearCalibrationTimeout, resetInteractionState, restoreCalibrationRange]);

  const prepareForSafeReacquisition = useCallback(() => {
    reacquisitionReadyRef.current = false;
    trackingWasLostRef.current = false;
    reacquisitionRef.current.reset();
    frameClockRef.current.reset();
    resetInteractionState(true);
    activeModalRef.current = null;
    if (calibrationEngineRef.current.getState().status === "capturing") {
      clearCalibrationTimeout();
      calibrationAttemptRef.current += 1;
      calibrationEngineRef.current.fail("tracking_lost");
      restoreCalibrationRange();
      setCalibrationState(calibrationEngineRef.current.getState());
    }
  }, [clearCalibrationTimeout, resetInteractionState, restoreCalibrationRange]);

  // Frame processing callback reading CURRENT profileRef.current
  const handleFrame = useCallback(
    (data: VisionFrameData) => {
      const currentProfile = profileRef.current;
      const now = data.timestampMs;
      const frameTime = frameClockRef.current.process(now);
      if (!frameTime.accepted) {
        return;
      }
      const dt = frameTime.deltaTimeMs;

      // 1. Tracking loss clears every inherited interaction and calibration sample.
      if (!data.faceDetected || data.lifecycleState === "tracking_lost") {
        reacquisitionReadyRef.current = false;
        trackingWasLostRef.current = true;
        reacquisitionRef.current.reset();
        resetInteractionState(false);
        // Freeze pointer at last rendered position, velocity becomes zero
        currentPosRef.current = { ...renderedPosRef.current };
        setLifecycleState("tracking_lost");
        setErrorCategory("tracking_lost");
        if (calibrationEngineRef.current.getState().status === "capturing") {
          clearCalibrationTimeout();
          calibrationAttemptRef.current += 1;
          calibrationEngineRef.current.fail("tracking_lost");
          restoreCalibrationRange();
          setCalibrationState(calibrationEngineRef.current.getState());
        }
        return;
      }

      // 2. Startup and reacquisition establish a fresh neutral from stable raw poses.
      if (!reacquisitionReadyRef.current) {
        const reacquisition = reacquisitionRef.current.process(data.pose);
        setLifecycleState("initializing");
        setActiveTarget(null);
        setDwellProgress(DEFAULT_DWELL);
        setGestureStatus(DEFAULT_GESTURE);

        if (reacquisition.baseline) {
          reacquisitionReadyRef.current = true;
          setNeutralBaselineState(reacquisition.baseline);
          engineRef.current?.setNeutralBaseline(reacquisition.baseline);
          const shouldResetCenter =
            trackingWasLostRef.current &&
            currentProfile.reacquisitionPointerBehavior === "reset_center";
          if (!shouldResetCenter) {
            currentPosRef.current = { ...renderedPosRef.current };
          }
          resetInteractionState(shouldResetCenter);
          trackingWasLostRef.current = false;
          if (dwellRef.current) dwellRef.current.requireFreshCycle();
          if (gestureRef.current) gestureRef.current.disarmUntilRelease();
        }
        return;
      }

      // Stabilize pose input (spike rejection, temporal filtering)
      const stabilizedPose = poseInputRef.current.process(
        data.poseDelta,
        currentProfile.smoothing,
        dt
      );

      setLifecycleState("active");
      setErrorCategory(null);

      // 3. Calibration consumes only real frames after stable reacquisition.
      const calibrationWasCapturing =
        calibrationEngineRef.current.getState().status === "capturing";
      if (calibrationWasCapturing) {
        const previousStep = calibrationEngineRef.current.getState().step;
        const state = calibrationEngineRef.current.addSample(
          data.pose,
          data.timestampMs,
          calibrationAttemptRef.current
        );
        setCalibrationState(state);
        if (state.status === "completed" && state.baseline) {
          clearCalibrationTimeout();
          // Install both range and dead zone from calibration
          calibrationRangeRef.current = state.range;
          calibrationDeadZoneRef.current = state.deadZone;
          calibrationFallbackRangeRef.current = state.range ? { ...state.range } : null;
          calibrationFallbackDeadZoneRef.current = state.deadZone ? { ...state.deadZone } : null;
          setNeutralBaseline(state.baseline);
          resetInteractionState(false);
        } else if (state.status === "failed") {
          clearCalibrationTimeout();
          // Restore previous calibration on failure
          restoreCalibrationRange();
        } else if (state.step !== previousStep) {
          scheduleCalibrationTimeout(calibrationAttemptRef.current);
        }

        // Calibration freezes the current coordinate and leaves dwell and gesture
        // controllers disarmed until the next normal tracking frame.
        resetInteractionState(false);
        return;
      }

      // 4. VELOCITY-BASED pointer movement
      // Get effective dead zone: calibrated (scaled by user pref) or default
      const baseDeadZone = calibrationDeadZoneRef.current ?? defaultDeadZone();
      const effectiveDeadZone = scaleDeadZone(baseDeadZone, currentProfile.deadZone);

      const deltaTimeSec = dt / 1000;
      const velocityDelta = velocityRef.current.process(
        { yaw: stabilizedPose.yaw, pitch: stabilizedPose.pitch },
        effectiveDeadZone,
        calibrationRangeRef.current,
        currentProfile.pointerSensitivity,
        deltaTimeSec,
        { yaw: data.poseDelta.yaw, pitch: data.poseDelta.pitch }
      );

      // Integrate: add velocity delta to current position
      const newPos: Vector2D = {
        x: currentPosRef.current.x + velocityDelta.x,
        y: currentPosRef.current.y + velocityDelta.y
      };

      const clampedPos = clampCoordinates(newPos, window.innerWidth, window.innerHeight);
      currentPosRef.current = clampedPos;

      // Rest Lock and Target Assist are BYPASSED for this corrective pass.
      // The velocity controller + calibrated dead zones handle rest naturally.
      setIsRestLocked(velocityDelta.x === 0 && velocityDelta.y === 0);

      // 5. Confirmation Lockout & Re-Arm Guard
      const currentModal =
        typeof document !== "undefined"
          ? document.querySelector('[data-aksa-calibration-guard="true"]') ||
            document.querySelector('[data-aksa-confirmation-guard="true"]') ||
            document.querySelector('[aria-modal="true"]')
          : null;

      // Opening a modal consumes this frame and requires a new physical selection cycle.
      if (currentModal && currentModal !== activeModalRef.current) {
        activeModalRef.current = currentModal;
        if (dwellRef.current) dwellRef.current.requireFreshCycle();
        if (gestureRef.current) gestureRef.current.disarmUntilRelease();
      } else if (!currentModal) {
        activeModalRef.current = null;
      }

      const isControlActive =
        data.lifecycleState === "active" &&
        currentProfile.selectionMode !== "off" &&
        !calibrationWasCapturing &&
        !Boolean(
          typeof document !== "undefined" &&
            document.querySelector('[data-aksa-calibration-guard="true"]')
        );

      // Target Assist remains disabled. Resolve only the topmost direct DOM hit.
      const directTarget = isControlActive
        ? resolveTargetAtPoint(clampedPos.x, clampedPos.y)
        : null;
      const eligibleTarget =
        directTarget?.isEligible &&
        directTarget.element &&
        (!currentModal || currentModal.contains(directTarget.element))
          ? directTarget.element
          : null;
      const eligibleBounds = eligibleTarget ? directTarget?.bounds ?? null : null;

      renderedPosRef.current = clampedPos;
      setPointerPosition(clampedPos);
      setActiveTarget(eligibleTarget);

      // Process Dwell
      if (
        dwellRef.current &&
        !calibrationWasCapturing &&
        (currentProfile.selectionMode === "dwell" || currentProfile.selectionMode === "both")
      ) {
        const dProgress = dwellRef.current.processFrame(
          clampedPos,
          eligibleTarget,
          eligibleBounds,
          now,
          isControlActive
        );
        setDwellProgress(dProgress);
      } else {
        setDwellProgress(DEFAULT_DWELL);
      }

      // Process Facial Gesture
      if (
        gestureRef.current &&
        !calibrationWasCapturing &&
        (currentProfile.selectionMode === "gesture" || currentProfile.selectionMode === "both")
      ) {
        const gStatus = gestureRef.current.processFrame(
          data.blendshapes,
          eligibleTarget,
          now,
          isControlActive
        );
        setGestureStatus(gStatus);
      } else {
        setGestureStatus(DEFAULT_GESTURE);
      }
    },
    [
      clearCalibrationTimeout,
      resetInteractionState,
      restoreCalibrationRange,
      scheduleCalibrationTimeout,
      setNeutralBaseline
    ]
  );

  const startCamera = useCallback(
    async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<boolean> => {
      startupCancelledRef.current = false;
      const processingVideo = ensureBackgroundVideo();
      if (!processingVideo) {
        cleanFailedStartup(videoElement, stream);
        setLifecycleState("error");
        setErrorCategory("camera_unavailable");
        return false;
      }
      if (!engineRef.current) {
        engineRef.current = engineFactory({
          onFrame: handleFrame,
          onStateChange: (state, failure) => {
            if (state === "active" && !reacquisitionReadyRef.current) {
              setLifecycleState("initializing");
            } else {
              setLifecycleState(state);
            }
            setErrorCategory(
              state === "tracking_lost" ? "tracking_lost" : failure ?? null
            );
            if (state === "error" || state === "disabled") {
              activeStreamRef.current = null;
              setActiveStream(null);
            }
            if (state === "error") {
              prepareForSafeReacquisition();
              removeBackgroundVideo();
            }
          }
        });
      }

      setLifecycleState("initializing");
      setErrorCategory(null);
      prepareForSafeReacquisition();

      const cleanStartup = () => {
        cleanFailedStartup(videoElement, stream);
        if (processingVideo !== videoElement) {
          cleanFailedStartup(processingVideo, null);
        }
      };

      const failStartup = (category: VisionFailureCategory): false => {
        try {
          engineRef.current?.disable();
        } catch {
          // Stream cleanup below remains authoritative.
        }
        activeStreamRef.current = null;
        setActiveStream(null);
        cleanStartup();
        setLifecycleState("error");
        setErrorCategory(category);
        return false;
      };

      try {
        videoElement.srcObject = stream;
        if (processingVideo !== videoElement) {
          processingVideo.srcObject = stream;
        }
      } catch {
        return failStartup("camera_unavailable");
      }

      const playVideo = (video: HTMLVideoElement) => {
        void video.play().catch(() => {
          // The engine remains authoritative if a browser blocks muted playback.
        });
      };
      for (const video of new Set([videoElement, processingVideo])) {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          playVideo(video);
        } else {
          video.addEventListener("loadedmetadata", () => playVideo(video), { once: true });
        }
      }

      let initialized = false;
      try {
        initialized = await engineRef.current.initialize();
      } catch {
        if (startupCancelledRef.current) {
          cleanStartup();
          setLifecycleState("disabled");
          setErrorCategory(null);
          return false;
        }
        return failStartup("model_load_failed");
      }
      if (startupCancelledRef.current) {
        try {
          engineRef.current.disable();
        } catch {
          // Stream cleanup below remains authoritative.
        }
        cleanStartup();
        setLifecycleState("disabled");
        setErrorCategory(null);
        return false;
      }
      if (!initialized) {
        return failStartup("model_load_failed");
      }

      try {
        engineRef.current.start(processingVideo, stream);
        activeStreamRef.current = stream;
        setActiveStream(stream);
        return true;
      } catch {
        return failStartup("camera_unavailable");
      }
    },
    [
      cleanFailedStartup,
      engineFactory,
      ensureBackgroundVideo,
      handleFrame,
      prepareForSafeReacquisition,
      removeBackgroundVideo
    ]
  );

  const startHeadControl = useCallback(
    async (videoElement?: HTMLVideoElement | null): Promise<boolean> => {
      startupCancelledRef.current = false;
      if (
        typeof window === "undefined" ||
        !window.isSecureContext ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setLifecycleState("error");
        setErrorCategory("camera_unavailable");
        return false;
      }

      let stream: MediaStream | null = null;
      let targetVideo = videoElement ?? null;

      try {
        setLifecycleState("initializing");
        setErrorCategory(null);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });

        if (startupCancelledRef.current) {
          cleanFailedStartup(targetVideo, stream);
          return false;
        }

        if (!targetVideo) {
          targetVideo = ensureBackgroundVideo();
        }

        if (!targetVideo) {
          cleanFailedStartup(null, stream);
          setLifecycleState("error");
          setErrorCategory("camera_unavailable");
          return false;
        }

        return await startCamera(targetVideo, stream);
      } catch (error) {
        cleanFailedStartup(targetVideo, stream);
        if (startupCancelledRef.current) {
          return false;
        }
        setLifecycleState("error");
        setErrorCategory(cameraFailureFromException(error));
        return false;
      }
    },
    [cleanFailedStartup, ensureBackgroundVideo, startCamera]
  );

  const pauseControl = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
    if (calibrationEngineRef.current.getState().status === "capturing") {
      clearCalibrationTimeout();
      calibrationAttemptRef.current += 1;
      calibrationEngineRef.current.cancel();
      restoreCalibrationRange();
      setCalibrationState(calibrationEngineRef.current.getState());
    }
    resetInteractionState(false);
    setLifecycleState("paused");
  }, [clearCalibrationTimeout, resetInteractionState, restoreCalibrationRange]);

  const resumeControl = useCallback(() => {
    reacquisitionReadyRef.current = false;
    reacquisitionRef.current.reset();
    frameClockRef.current.reset();
    resetInteractionState(true);
    if (engineRef.current) {
      engineRef.current.resume();
    }
  }, [resetInteractionState]);

  const disableControl = useCallback(() => {
    startupCancelledRef.current = true;
    if (engineRef.current) {
      engineRef.current.disable();
    }
    if (dwellRef.current) dwellRef.current.cancel();
    if (gestureRef.current) gestureRef.current.reset();
    reacquisitionReadyRef.current = false;
    reacquisitionRef.current.reset();
    frameClockRef.current.reset();
    resetInteractionState(true);
    activeModalRef.current = null;
    clearCalibrationTimeout();
    calibrationAttemptRef.current += 1;
    calibrationEngineRef.current.cancel();
    calibrationFallbackRangeRef.current = null;
    calibrationFallbackDeadZoneRef.current = null;
    calibrationRangeRef.current = null;
    calibrationDeadZoneRef.current = null;
    setCalibrationState(calibrationEngineRef.current.getState());
    activeStreamRef.current = null;
    setActiveStream(null);
    removeBackgroundVideo();
    setErrorCategory(null);
    setLifecycleState("disabled");
  }, [clearCalibrationTimeout, removeBackgroundVideo, resetInteractionState]);

  // Provider unmount teardown effect
  useEffect(() => {
    return () => {
      startupCancelledRef.current = true;
      if (engineRef.current) {
        engineRef.current.disable();
      }
      clearCalibrationTimeout();
      removeBackgroundVideo();
    };
  }, [clearCalibrationTimeout, removeBackgroundVideo]);

  const isPaused = lifecycleState === "paused";

  return (
    <HeadControlContext.Provider
      value={{
        userId: runtimeUserId,
        lifecycleState,
        errorCategory,
        pointerPosition,
        activeTarget,
        dwellProgress,
        gestureStatus,
        activationFeedbackKey,
        isRestLocked,
        profile,
        neutralBaseline,
        activeStream,
        calibrationState,
        isPaused,
        startHeadControl,
        startCamera,
        startCalibration,
        cancelCalibration,
        pauseControl,
        resumeControl,
        disableControl,
        setNeutralBaseline,
        updateProfile,
        configureRuntime
      }}
    >
      {children}
      {/* Live Aksa DOM Overlay Pointer Mounted Everywhere */}
      <AksaPointer
        dwellProgress={dwellProgress}
        hasTarget={activeTarget !== null}
        lifecycleState={calibrationState.status === "capturing" ? "paused" : lifecycleState}
        position={pointerPosition}
        reducedMotion={profile.reducedMotion}
        activationKey={activationFeedbackKey}
      />
    </HeadControlContext.Provider>
  );
}

export function useHeadControl(): HeadControlContextValue {
  const context = useContext(HeadControlContext);
  if (!context) {
    throw new Error("useHeadControl must be used within a HeadControlProvider");
  }
  return context;
}

/** Configures the shared runtime when authenticated workspace data becomes available. */
export function HeadControlRuntimeConfigurator({
  userId,
  initialProfile
}: {
  userId: string | null;
  initialProfile?: AccessibilityProfile | null;
}) {
  const { configureRuntime } = useHeadControl();

  useEffect(() => {
    configureRuntime({ userId, initialProfile });
  }, [configureRuntime, initialProfile, userId]);

  return null;
}

/**
 * Uses the app-level runtime when present and supplies an isolated provider for
 * independently rendered shells and focused component tests.
 */
export function HeadControlRuntimeBoundary({
  children,
  engineFactory,
  initialProfile,
  userId
}: {
  children: ReactNode;
  engineFactory?: HeadControlEngineFactory;
  initialProfile?: AccessibilityProfile | null;
  userId: string | null;
}) {
  const existingRuntime = useContext(HeadControlContext);

  if (existingRuntime) {
    return (
      <>
        <HeadControlRuntimeConfigurator initialProfile={initialProfile} userId={userId} />
        {children}
      </>
    );
  }

  return (
    <HeadControlProvider
      engineFactory={engineFactory}
      initialProfile={initialProfile}
      userId={userId}
    >
      {children}
    </HeadControlProvider>
  );
}
