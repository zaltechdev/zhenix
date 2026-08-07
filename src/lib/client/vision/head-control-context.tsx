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
import { VisionEngine, VisionFrameData, VisionLifecycleState } from "./vision-engine";
import { AksaPointer } from "@/components/workspace/aksa-pointer";
import { getCachedProfile, setCachedProfile } from "./profile-cache";

export interface HeadControlContextValue {
  lifecycleState: VisionLifecycleState;
  pointerPosition: Vector2D;
  activeTarget: HTMLElement | null;
  dwellProgress: DwellProgress;
  gestureStatus: GestureStatus;
  profile: AccessibilityProfile;
  neutralBaseline: NeutralBaseline | null;
  isPaused: boolean;
  startCamera: (videoElement: HTMLVideoElement, stream: MediaStream) => Promise<boolean>;
  pauseControl: () => void;
  resumeControl: () => void;
  disableControl: () => void;
  setNeutralBaseline: (baseline: NeutralBaseline) => void;
  updateProfile: (profile: AccessibilityProfile) => void;
}

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

const STABLE_REACQUISITION_FRAMES_REQUIRED = 5;

export function HeadControlProvider({
  children,
  userId,
  initialProfile
}: {
  children: ReactNode;
  userId?: string | null;
  initialProfile?: AccessibilityProfile | null;
}) {
  const [profile, setProfile] = useState<AccessibilityProfile>(
    initialProfile ?? provisionalAccessibilityProfile
  );
  const [lifecycleState, setLifecycleState] = useState<VisionLifecycleState>("idle");
  const [pointerPosition, setPointerPosition] = useState<Vector2D>(() =>
    typeof window !== "undefined"
      ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      : { x: 0, y: 0 }
  );
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);
  const [dwellProgress, setDwellProgress] = useState<DwellProgress>(DEFAULT_DWELL);
  const [gestureStatus, setGestureStatus] = useState<GestureStatus>(DEFAULT_GESTURE);
  const [neutralBaseline, setNeutralBaselineState] = useState<NeutralBaseline | null>(null);

  const engineRef = useRef<VisionEngine | null>(null);
  const dwellRef = useRef<DwellController | null>(null);
  const gestureRef = useRef<GestureDetector | null>(null);
  const currentPosRef = useRef<Vector2D>(pointerPosition);
  const reacquisitionCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Initialize or fetch cached profile on mount
  useEffect(() => {
    if (!initialProfile) {
      void getCachedProfile(userId).then((cached) => {
        if (cached) {
          setProfile(cached);
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

  // Synchronize live profile settings
  const updateProfile = useCallback(
    (newProfile: AccessibilityProfile) => {
      setProfile(newProfile);
      void setCachedProfile(newProfile, userId);

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

  // Frame processing callback
  const handleFrame = useCallback(
    (data: VisionFrameData) => {
      const now = data.timestampMs;
      const dt = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16.6;
      lastFrameTimeRef.current = now;

      // 1. Handle tracking loss / recovery stability requirement
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
      }

      setLifecycleState("active");

      // 2. Map Head Pose to Screen Coordinates
      const screenDelta = mapPoseToScreenDelta(
        data.poseDelta.yaw,
        data.poseDelta.pitch,
        profile.pointerSensitivity,
        profile.deadZone
      );

      const targetPos: Vector2D = {
        x: window.innerWidth / 2 + screenDelta.x,
        y: window.innerHeight / 2 + screenDelta.y
      };

      const smoothedPos = smoothCoordinates(currentPosRef.current, targetPos, profile.smoothing, dt);
      const clampedPos = clampCoordinates(smoothedPos, window.innerWidth, window.innerHeight);

      currentPosRef.current = clampedPos;
      setPointerPosition(clampedPos);

      // 3. Check Confirmation Safety Guard
      const confirmationGuardActive =
        typeof document !== "undefined" &&
        (document.querySelector('[data-aksa-confirmation-guard="true"]') !== null ||
          document.querySelector('[aria-modal="true"]') !== null);

      if (dwellRef.current) {
        dwellRef.current.setConfirmationGuard(confirmationGuardActive);
      }

      // 4. Resolve Target & Process Selection
      const resolution = resolveTargetAtPoint(clampedPos.x, clampedPos.y);
      const eligibleTarget = confirmationGuardActive ? null : resolution.element;
      setActiveTarget(eligibleTarget);

      const isControlActive =
        data.lifecycleState === "active" && !confirmationGuardActive && profile.selectionMode !== "off";

      // Process Dwell
      if (
        dwellRef.current &&
        (profile.selectionMode === "dwell" || profile.selectionMode === "both")
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
        (profile.selectionMode === "gesture" || profile.selectionMode === "both")
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
    [profile]
  );

  const startCamera = useCallback(
    async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<boolean> => {
      if (!engineRef.current) {
        engineRef.current = new VisionEngine({
          onFrame: handleFrame,
          onStateChange: (st) => setLifecycleState(st)
        });
      }

      const initialized = await engineRef.current.initialize();
      if (initialized) {
        engineRef.current.start(videoElement, stream);
      }
      return initialized;
    },
    [handleFrame]
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
    setLifecycleState("disabled");
  }, []);

  const isPaused = lifecycleState === "paused";

  return (
    <HeadControlContext.Provider
      value={{
        lifecycleState,
        pointerPosition,
        activeTarget,
        dwellProgress,
        gestureStatus,
        profile,
        neutralBaseline,
        isPaused,
        startCamera,
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
