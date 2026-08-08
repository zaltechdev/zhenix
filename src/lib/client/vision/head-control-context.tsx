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
  mapCameraPoseToScreenDelta,
  smoothCoordinates,
  clampCoordinates,
  PoseInputStabilizer,
  Vector2D
} from "./pointer-mapping";
import { getEligibleTargetCandidates } from "./target-resolver";
import { TargetAssistController } from "./target-assist";
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
import { CalibrationEngine, CalibrationState } from "./calibration";
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
  profile: AccessibilityProfile;
  neutralBaseline: NeutralBaseline | null;
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
  errorMessage: null
};

const STABLE_REACQUISITION_FRAMES_REQUIRED = 5;

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
  const initialProfileKey = initialProfile ? JSON.stringify(initialProfile) : "cache";
  const profileScope = `${userId ?? "anonymous"}:${initialProfileKey}`;
  const [profileState, setProfileState] = useState<{
    scope: string;
    value: AccessibilityProfile;
  }>(() => ({
    scope: profileScope,
    value: initialProfile ?? provisionalAccessibilityProfile
  }));
  const profile =
    profileState.scope === profileScope
      ? profileState.value
      : initialProfile ?? provisionalAccessibilityProfile;
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
  const [neutralBaseline, setNeutralBaselineState] = useState<NeutralBaseline | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>(DEFAULT_CALIBRATION);

  // References for live callback freshness & teardown
  const profileRef = useRef<AccessibilityProfile>(profile);
  const engineRef = useRef<HeadControlEngine | null>(null);
  const dwellRef = useRef<DwellController | null>(null);
  const gestureRef = useRef<GestureDetector | null>(null);
  const calibrationEngineRef = useRef<CalibrationEngine>(new CalibrationEngine(20));
  const currentPosRef = useRef<Vector2D>(pointerPosition);
  const reacquisitionCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const poseInputRef = useRef<PoseInputStabilizer>(new PoseInputStabilizer());
  const targetAssistRef = useRef<TargetAssistController>(new TargetAssistController());
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeModalRef = useRef<Element | null>(null);
  const startupCancelledRef = useRef(false);

  const removeBackgroundVideo = useCallback(() => {
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.remove();
      backgroundVideoRef.current = null;
    }
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

  // Server data wins. Without it, reset before loading only the current user's cache.
  useEffect(() => {
    let cancelled = false;

    if (!initialProfile && userId) {
      void getCachedProfile(userId).then((cached) => {
        if (!cancelled && cached) {
          setProfileState({ scope: profileScope, value: cached });
          profileRef.current = cached;
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [initialProfile, profileScope, userId]);

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
      setProfileState({ scope: profileScope, value: newProfile });
      profileRef.current = newProfile;
      if (userId) {
        void setCachedProfile(newProfile, userId);
      }

      if (dwellRef.current) {
        dwellRef.current.updateConfig(newProfile.dwellDurationMs ?? 1200);
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
      }
    },
    [dispatchHeadSelection, profileScope, userId]
  );

  const setNeutralBaseline = useCallback((baseline: NeutralBaseline) => {
    setNeutralBaselineState(baseline);
    poseInputRef.current.reset();
    targetAssistRef.current.clear();
    if (engineRef.current) {
      engineRef.current.setNeutralBaseline(baseline);
    }
  }, []);

  // Calibration triggers
  const startCalibration = useCallback(() => {
    if (lifecycleState !== "active") {
      return;
    }
    calibrationEngineRef.current.start();
    if (dwellRef.current) dwellRef.current.requireFreshCycle();
    if (gestureRef.current) gestureRef.current.disarmUntilRelease();
    targetAssistRef.current.clear();
    setActiveTarget(null);
    setDwellProgress(DEFAULT_DWELL);
    setGestureStatus(DEFAULT_GESTURE);
    setCalibrationState(calibrationEngineRef.current.getState());
  }, [lifecycleState]);

  const cancelCalibration = useCallback(() => {
    calibrationEngineRef.current.cancel();
    setCalibrationState(calibrationEngineRef.current.getState());
  }, []);

  const prepareForSafeReacquisition = useCallback(() => {
    reacquisitionCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    poseInputRef.current.reset();
    targetAssistRef.current.clear();
    activeModalRef.current = null;
    if (dwellRef.current) dwellRef.current.requireFreshCycle();
    if (gestureRef.current) gestureRef.current.disarmUntilRelease();
    if (calibrationEngineRef.current.getState().status === "capturing") {
      calibrationEngineRef.current.clearSamples();
      setCalibrationState(calibrationEngineRef.current.getState());
    }
    setActiveTarget(null);
    setDwellProgress(DEFAULT_DWELL);
    setGestureStatus(DEFAULT_GESTURE);
  }, []);

  // Frame processing callback reading CURRENT profileRef.current
  const handleFrame = useCallback(
    (data: VisionFrameData) => {
      const currentProfile = profileRef.current;
      const now = data.timestampMs;
      const dt = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16.6;
      lastFrameTimeRef.current = now;

      // 1. Tracking loss clears every inherited interaction and calibration sample.
      if (!data.faceDetected || data.lifecycleState === "tracking_lost") {
        reacquisitionCountRef.current = 0;
        poseInputRef.current.reset();
        targetAssistRef.current.clear();
        setLifecycleState("tracking_lost");
        setErrorCategory("tracking_lost");
        if (dwellRef.current) dwellRef.current.requireFreshCycle();
        if (gestureRef.current) gestureRef.current.disarmUntilRelease();
        if (calibrationEngineRef.current.getState().status === "capturing") {
          calibrationEngineRef.current.clearSamples();
          setCalibrationState(calibrationEngineRef.current.getState());
        }
        setDwellProgress(DEFAULT_DWELL);
        setGestureStatus(DEFAULT_GESTURE);
        setActiveTarget(null);
        return;
      }

      const stabilizedPose = poseInputRef.current.process(
        data.poseDelta,
        currentProfile.deadZone,
        currentProfile.smoothing,
        dt
      );

      // 2. Reacquisition needs consecutive frames, then one separate interaction frame.
      if (reacquisitionCountRef.current < STABLE_REACQUISITION_FRAMES_REQUIRED) {
        reacquisitionCountRef.current += 1;
        setLifecycleState("initializing");
        setActiveTarget(null);
        setDwellProgress(DEFAULT_DWELL);
        setGestureStatus(DEFAULT_GESTURE);

        if (reacquisitionCountRef.current === STABLE_REACQUISITION_FRAMES_REQUIRED) {
          const screenDelta = mapCameraPoseToScreenDelta(
            stabilizedPose.yaw,
            stabilizedPose.pitch,
            currentProfile.pointerSensitivity,
            0,
            window.innerWidth,
            window.innerHeight
          );
          const reacquiredPosition = clampCoordinates(
            {
              x: window.innerWidth / 2 + screenDelta.x,
              y: window.innerHeight / 2 + screenDelta.y
            },
            window.innerWidth,
            window.innerHeight
          );
          currentPosRef.current = reacquiredPosition;
          setPointerPosition(reacquiredPosition);
          if (dwellRef.current) dwellRef.current.requireFreshCycle();
          if (gestureRef.current) gestureRef.current.disarmUntilRelease();
        }
        return;
      }

      setLifecycleState("active");
      setErrorCategory(null);

      // 3. Calibration consumes only real frames after stable reacquisition.
      const calibrationWasCapturing =
        calibrationEngineRef.current.getState().status === "capturing";
      if (calibrationWasCapturing) {
        const state = calibrationEngineRef.current.addSample(data.pose);
        setCalibrationState(state);
        if (state.status === "completed" && state.baseline) {
          setNeutralBaseline(state.baseline);
        }
      }

      // 4. Map Head Pose to Screen Coordinates using CURRENT profileRef.current
      const screenDelta = mapCameraPoseToScreenDelta(
        stabilizedPose.yaw,
        stabilizedPose.pitch,
        currentProfile.pointerSensitivity,
        0,
        window.innerWidth,
        window.innerHeight
      );

      const targetPos: Vector2D = {
        x: window.innerWidth / 2 + screenDelta.x,
        y: window.innerHeight / 2 + screenDelta.y
      };

      const smoothedPos = smoothCoordinates(
        currentPosRef.current,
        targetPos,
        currentProfile.smoothing,
        dt,
        stabilizedPose.motionResponse
      );
      const clampedPos = clampCoordinates(smoothedPos, window.innerWidth, window.innerHeight);

      currentPosRef.current = clampedPos;

      // 5. Confirmation Lockout & Re-Arm Guard
      const currentModal =
        typeof document !== "undefined"
          ? document.querySelector('[data-aksa-confirmation-guard="true"]') ||
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
        !calibrationWasCapturing;

      const targetAssist = isControlActive
        ? targetAssistRef.current.process(
            clampedPos,
            getEligibleTargetCandidates(clampedPos, currentModal),
            now
          )
        : null;
      if (!targetAssist) {
        targetAssistRef.current.clear();
      }

      const assistedPosition = targetAssist?.position ?? clampedPos;
      const eligibleTarget = targetAssist?.activeTarget ?? null;
      const eligibleBounds = targetAssist?.activeTargetBounds ?? null;
      setPointerPosition(assistedPosition);
      setActiveTarget(eligibleTarget);

      // Process Dwell
      if (
        dwellRef.current &&
        !calibrationWasCapturing &&
        (currentProfile.selectionMode === "dwell" || currentProfile.selectionMode === "both")
      ) {
        const dProgress = dwellRef.current.processFrame(
          assistedPosition,
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
    [setNeutralBaseline]
  );

  const startCamera = useCallback(
    async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<boolean> => {
      startupCancelledRef.current = false;
      if (!engineRef.current) {
        engineRef.current = engineFactory({
          onFrame: handleFrame,
          onStateChange: (state, failure) => {
            if (state === "active" && reacquisitionCountRef.current < STABLE_REACQUISITION_FRAMES_REQUIRED) {
              setLifecycleState("initializing");
            } else {
              setLifecycleState(state);
            }
            setErrorCategory(
              state === "tracking_lost" ? "tracking_lost" : failure ?? null
            );
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

      const failStartup = (category: VisionFailureCategory): false => {
        try {
          engineRef.current?.disable();
        } catch {
          // Stream cleanup below remains authoritative.
        }
        cleanFailedStartup(videoElement, stream);
        setLifecycleState("error");
        setErrorCategory(category);
        return false;
      };

      try {
        videoElement.srcObject = stream;
      } catch {
        return failStartup("camera_unavailable");
      }

      let initialized = false;
      try {
        initialized = await engineRef.current.initialize();
      } catch {
        if (startupCancelledRef.current) {
          cleanFailedStartup(videoElement, stream);
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
        cleanFailedStartup(videoElement, stream);
        setLifecycleState("disabled");
        setErrorCategory(null);
        return false;
      }
      if (!initialized) {
        return failStartup("model_load_failed");
      }

      try {
        engineRef.current.start(videoElement, stream);
        return true;
      } catch {
        return failStartup("camera_unavailable");
      }
    },
    [
      cleanFailedStartup,
      engineFactory,
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
          if (!backgroundVideoRef.current && typeof document !== "undefined") {
            const vid = document.createElement("video");
            vid.autoplay = true;
            vid.muted = true;
            vid.playsInline = true;
            vid.style.display = "none";
            document.body.appendChild(vid);
            backgroundVideoRef.current = vid;
          }
          targetVideo = backgroundVideoRef.current;
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
    [cleanFailedStartup, startCamera]
  );

  const pauseControl = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
    poseInputRef.current.reset();
    targetAssistRef.current.clear();
    lastFrameTimeRef.current = 0;
    if (dwellRef.current) dwellRef.current.requireFreshCycle();
    if (gestureRef.current) gestureRef.current.disarmUntilRelease();
    setActiveTarget(null);
    setDwellProgress(DEFAULT_DWELL);
    setGestureStatus(DEFAULT_GESTURE);
    setLifecycleState("paused");
  }, []);

  const resumeControl = useCallback(() => {
    reacquisitionCountRef.current = 0;
    poseInputRef.current.reset();
    targetAssistRef.current.clear();
    lastFrameTimeRef.current = 0;
    if (dwellRef.current) dwellRef.current.requireFreshCycle();
    if (gestureRef.current) gestureRef.current.disarmUntilRelease();
    if (engineRef.current) {
      engineRef.current.resume();
    }
  }, []);

  const disableControl = useCallback(() => {
    startupCancelledRef.current = true;
    if (engineRef.current) {
      engineRef.current.disable();
    }
    if (dwellRef.current) dwellRef.current.cancel();
    if (gestureRef.current) gestureRef.current.reset();
    reacquisitionCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    poseInputRef.current.reset();
    targetAssistRef.current.clear();
    activeModalRef.current = null;
    calibrationEngineRef.current.cancel();
    setCalibrationState(calibrationEngineRef.current.getState());
    setActiveTarget(null);
    setDwellProgress(DEFAULT_DWELL);
    setGestureStatus(DEFAULT_GESTURE);
    removeBackgroundVideo();
    setErrorCategory(null);
    setLifecycleState("disabled");
  }, [removeBackgroundVideo]);

  // Provider unmount teardown effect
  useEffect(() => {
    return () => {
      startupCancelledRef.current = true;
      if (engineRef.current) {
        engineRef.current.disable();
      }
      removeBackgroundVideo();
    };
  }, [removeBackgroundVideo]);

  const isPaused = lifecycleState === "paused";

  return (
    <HeadControlContext.Provider
      value={{
        userId,
        lifecycleState,
        errorCategory,
        pointerPosition,
        activeTarget,
        dwellProgress,
        gestureStatus,
        activationFeedbackKey,
        profile,
        neutralBaseline,
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
        updateProfile
      }}
    >
      {children}
      {/* Live Aksa DOM Overlay Pointer Mounted Everywhere */}
      <AksaPointer
        dwellProgress={dwellProgress}
        hasTarget={activeTarget !== null}
        lifecycleState={lifecycleState}
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
