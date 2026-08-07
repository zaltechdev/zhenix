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
import { mapPoseToScreenDelta, smoothCoordinates, clampCoordinates, Vector2D } from "./pointer-mapping";
import { resolveTargetAtPoint } from "./target-resolver";
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
  const [profile, setProfile] = useState<AccessibilityProfile>(
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
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeModalRef = useRef<Element | null>(null);

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

  // Initialize or fetch user-scoped cached profile on mount
  useEffect(() => {
    if (!initialProfile && userId) {
      void getCachedProfile(userId).then((cached) => {
        if (cached) {
          setProfile(cached);
          profileRef.current = cached;
        }
      });
    }
  }, [initialProfile, userId]);

  // Synchronize controllers with current profile settings
  useEffect(() => {
    if (!dwellRef.current) {
      dwellRef.current = new DwellController({
        dwellDurationMs: profile.dwellDurationMs ?? 1200,
        cooldownMs: 500
      });
    } else {
      dwellRef.current.updateConfig(profile.dwellDurationMs ?? 1200);
    }

    if (!gestureRef.current) {
      gestureRef.current = new GestureDetector({
        gestureType: profile.selectionMode === "off" ? null : profile.gestureType,
        threshold: profile.gestureThreshold ?? 50,
        cooldownMs: profile.gestureCooldownMs ?? 600
      });
    } else {
      gestureRef.current.updateConfig({
        gestureType:
          profile.selectionMode === "off" || profile.selectionMode === "dwell"
            ? null
            : profile.gestureType,
        threshold: profile.gestureThreshold ?? 50,
        cooldownMs: profile.gestureCooldownMs ?? 600
      });
    }
  }, [
    profile.dwellDurationMs,
    profile.gestureCooldownMs,
    profile.gestureThreshold,
    profile.gestureType,
    profile.selectionMode
  ]);

  // Synchronize live profile settings & write to user-scoped cache
  const updateProfile = useCallback(
    (newProfile: AccessibilityProfile) => {
      setProfile(newProfile);
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
          cooldownMs: newProfile.gestureCooldownMs ?? 600
        });
      }
    },
    [userId]
  );

  const setNeutralBaseline = useCallback((baseline: NeutralBaseline) => {
    setNeutralBaselineState(baseline);
    if (engineRef.current) {
      engineRef.current.setNeutralBaseline(baseline);
    }
  }, []);

  // Calibration triggers
  const startCalibration = useCallback(() => {
    calibrationEngineRef.current.start();
    setCalibrationState(calibrationEngineRef.current.getState());
  }, []);

  const cancelCalibration = useCallback(() => {
    calibrationEngineRef.current.cancel();
    setCalibrationState(calibrationEngineRef.current.getState());
  }, []);

  // Frame processing callback reading CURRENT profileRef.current
  const handleFrame = useCallback(
    (data: VisionFrameData) => {
      const currentProfile = profileRef.current;
      const now = data.timestampMs;
      const dt = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16.6;
      lastFrameTimeRef.current = now;

      // 1. Calibration handling with REAL face frames (zero random poses)
      if (calibrationEngineRef.current.getState().status === "capturing") {
        if (data.faceDetected) {
          const st = calibrationEngineRef.current.addSample(data.pose);
          setCalibrationState(st);
          if (st.status === "completed" && st.baseline) {
            setNeutralBaseline(st.baseline);
          }
        }
      }

      // 2. Tracking loss / stability reacquisition handling
      if (!data.faceDetected || data.lifecycleState === "tracking_lost") {
        reacquisitionCountRef.current = 0;
        setLifecycleState("tracking_lost");
        if (dwellRef.current) dwellRef.current.cancel();
        if (gestureRef.current) gestureRef.current.reset();
        setDwellProgress(DEFAULT_DWELL);
        setGestureStatus(DEFAULT_GESTURE);
        setActiveTarget(null);
        return;
      }

      // Require STABLE_REACQUISITION_FRAMES_REQUIRED consecutive frames before activating
      if (reacquisitionCountRef.current < STABLE_REACQUISITION_FRAMES_REQUIRED) {
        reacquisitionCountRef.current += 1;
        if (reacquisitionCountRef.current < STABLE_REACQUISITION_FRAMES_REQUIRED) {
          setLifecycleState("initializing");
          return;
        }
        // First frame after reacquisition -> reset pointer smoothing to target to prevent teleport interpolation
        const screenDelta = mapPoseToScreenDelta(
          data.poseDelta.yaw,
          data.poseDelta.pitch,
          currentProfile.pointerSensitivity,
          currentProfile.deadZone
        );
        currentPosRef.current = clampCoordinates(
          { x: window.innerWidth / 2 + screenDelta.x, y: window.innerHeight / 2 + screenDelta.y },
          window.innerWidth,
          window.innerHeight
        );
      }

      setLifecycleState("active");

      // 3. Map Head Pose to Screen Coordinates using CURRENT profileRef.current
      const screenDelta = mapPoseToScreenDelta(
        data.poseDelta.yaw,
        data.poseDelta.pitch,
        currentProfile.pointerSensitivity,
        currentProfile.deadZone
      );

      const targetPos: Vector2D = {
        x: window.innerWidth / 2 + screenDelta.x,
        y: window.innerHeight / 2 + screenDelta.y
      };

      const smoothedPos = smoothCoordinates(currentPosRef.current, targetPos, currentProfile.smoothing, dt);
      const clampedPos = clampCoordinates(smoothedPos, window.innerWidth, window.innerHeight);

      currentPosRef.current = clampedPos;
      setPointerPosition(clampedPos);

      // 4. Confirmation Lockout & Re-Arm Guard
      const currentModal =
        typeof document !== "undefined"
          ? document.querySelector('[data-aksa-confirmation-guard="true"]') ||
            document.querySelector('[aria-modal="true"]')
          : null;

      // If a modal just opened this frame, reset dwell and gesture immediately to clear momentum
      if (currentModal && currentModal !== activeModalRef.current) {
        activeModalRef.current = currentModal;
        if (dwellRef.current) dwellRef.current.cancel();
        if (gestureRef.current) gestureRef.current.reset();
      } else if (!currentModal) {
        activeModalRef.current = null;
      }

      // Resolve Target
      const resolution = resolveTargetAtPoint(clampedPos.x, clampedPos.y);
      const eligibleTarget = resolution.element;
      setActiveTarget(eligibleTarget);

      const isControlActive =
        data.lifecycleState === "active" && currentProfile.selectionMode !== "off";

      // Process Dwell
      if (
        dwellRef.current &&
        (currentProfile.selectionMode === "dwell" || currentProfile.selectionMode === "both")
      ) {
        const dProgress = dwellRef.current.processFrame(
          clampedPos,
          eligibleTarget,
          resolution.bounds,
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
          }
        });
      }

      setLifecycleState("initializing");
      setErrorCategory(null);

      try {
        videoElement.srcObject = stream;
        const initialized = await engineRef.current.initialize();
        if (!initialized) {
          try {
            engineRef.current.disable();
          } catch {
            // Stream cleanup below remains authoritative.
          }
          cleanFailedStartup(videoElement, stream);
          setLifecycleState("error");
          setErrorCategory("model_load_failed");
          return false;
        }

        engineRef.current.start(videoElement, stream);
        return true;
      } catch {
        try {
          engineRef.current.disable();
        } catch {
          // Stream cleanup below remains authoritative.
        }
        cleanFailedStartup(videoElement, stream);
        setLifecycleState("error");
        setErrorCategory("camera_unavailable");
        return false;
      }
    },
    [cleanFailedStartup, engineFactory, handleFrame]
  );

  const startHeadControl = useCallback(
    async (videoElement?: HTMLVideoElement | null): Promise<boolean> => {
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
    if (dwellRef.current) dwellRef.current.cancel();
    if (gestureRef.current) gestureRef.current.reset();
    setLifecycleState("paused");
  }, []);

  const resumeControl = useCallback(() => {
    reacquisitionCountRef.current = 0;
    if (engineRef.current) {
      engineRef.current.resume();
    }
  }, []);

  const disableControl = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.disable();
    }
    if (dwellRef.current) dwellRef.current.cancel();
    if (gestureRef.current) gestureRef.current.reset();
    removeBackgroundVideo();
    setErrorCategory(null);
    setLifecycleState("disabled");
  }, [removeBackgroundVideo]);

  // Provider unmount teardown effect
  useEffect(() => {
    return () => {
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
