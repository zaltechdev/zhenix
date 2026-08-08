import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import {
  HeadControlProvider,
  useHeadControl,
  type HeadControlEngineFactory
} from "@/lib/client/vision/head-control-context";
import { getCachedProfile, setCachedProfile, clearCachedProfile } from "@/lib/client/vision/profile-cache";
import { GestureDetector } from "@/lib/client/vision/gesture-detector";
import { DwellController } from "@/lib/client/vision/dwell-controller";
import { CalibrationEngine } from "@/lib/client/vision/calibration";
import {
  mapCameraPoseToScreenDelta,
  smoothCoordinates
} from "@/lib/client/vision/pointer-mapping";
import type {
  VisionEngineCallbacks,
  VisionFailureCategory,
  VisionLifecycleState,
  VisionFrameData
} from "@/lib/client/vision/vision-engine";
import type { AccessibilityProfile } from "@/lib/contracts/auth";
import { AksaPointer } from "@/components/workspace/aksa-pointer";

function createMockStream() {
  const stop = vi.fn();
  const track = {
    stop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stop, stream, track };
}

function createEngineFactory(options: {
  initialized: boolean;
  onDisable?: () => void;
  onStart?: (video: HTMLVideoElement, stream: MediaStream) => void;
}): HeadControlEngineFactory {
  return () => ({
    initialize: vi.fn().mockResolvedValue(options.initialized),
    start: vi.fn(options.onStart),
    pause: vi.fn(),
    resume: vi.fn(),
    disable: vi.fn(options.onDisable),
    setNeutralBaseline: vi.fn()
  });
}

function createControllableEngine() {
  let callbacks: VisionEngineCallbacks | null = null;
  const setNeutralBaseline = vi.fn();
  const factory = vi.fn<HeadControlEngineFactory>((nextCallbacks) => {
    callbacks = nextCallbacks;
    return {
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn(() => callbacks?.onStateChange?.("active", null)),
      pause: vi.fn(),
      resume: vi.fn(() => callbacks?.onStateChange?.("active", null)),
      disable: vi.fn(),
      setNeutralBaseline
    };
  });

  return {
    emit(frame: VisionFrameData) {
      if (!callbacks?.onFrame) throw new Error("Vision callbacks are not installed");
      callbacks.onFrame(frame);
    },
    emitState(
      state: VisionLifecycleState,
      failure: VisionFailureCategory | null = null
    ) {
      callbacks?.onStateChange?.(state, failure);
    },
    factory,
    setNeutralBaseline
  };
}

function visionFrame(
  timestampMs: number,
  overrides: Partial<VisionFrameData> = {}
): VisionFrameData {
  return {
    lifecycleState: "active",
    faceDetected: true,
    pose: { yaw: 2, pitch: 3, roll: 0 },
    poseDelta: { yaw: 2, pitch: 3, roll: 0 },
    blendshapes: [],
    timestampMs,
    failureCategory: null,
    ...overrides
  };
}

const SETTINGS_OFF: AccessibilityProfile = {
  pointerSensitivity: 20,
  deadZone: 40,
  smoothing: 80,
  selectionMode: "off",
  dwellDurationMs: null,
  gestureType: null,
  gestureThreshold: null,
  gestureCooldownMs: null,
  reducedMotion: false
};

function ProfileValue() {
  const { profile } = useHeadControl();
  return <output data-testid="profile-sensitivity">{profile.pointerSensitivity}</output>;
}

describe("Head Control Coordinator Comprehensive Regression Suite", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => null)
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(300, 200, 500, 500)
    );
    await clearCachedProfile("user-a");
    await clearCachedProfile("user-b");
    await clearCachedProfile("server-user");
  });

  it("does not render an operational pointer while camera startup is incomplete", () => {
    const dwellProgress = {
      state: "idle" as const,
      progressRatio: 0,
      targetElement: null,
      activeTargetBounds: null
    };
    const rendered = render(
      <AksaPointer
        dwellProgress={dwellProgress}
        hasTarget={false}
        lifecycleState="initializing"
        position={{ x: 100, y: 100 }}
      />
    );

    expect(rendered.container.querySelector(".aksa-pointer-overlay")).toBeNull();
    rendered.rerender(
      <AksaPointer
        dwellProgress={dwellProgress}
        hasTarget={false}
        lifecycleState="active"
        position={{ x: 100, y: 100 }}
      />
    );
    expect(rendered.container.querySelector(".aksa-pointer-overlay")).not.toBeNull();
  });

  it("isolates IndexedDB cached profiles by user ID and throws on missing user ID", async () => {
    const profileA = {
      pointerSensitivity: 80,
      deadZone: 10,
      smoothing: 30,
      selectionMode: "dwell" as const,
      dwellDurationMs: 800,
      gestureType: null,
      gestureThreshold: null,
      gestureCooldownMs: null,
      reducedMotion: false
    };

    const profileB = {
      pointerSensitivity: 20,
      deadZone: 40,
      smoothing: 70,
      selectionMode: "gesture" as const,
      dwellDurationMs: null,
      gestureType: "smile" as const,
      gestureThreshold: 60,
      gestureCooldownMs: 500,
      reducedMotion: true
    };

    await setCachedProfile(profileA, "user-a");
    await setCachedProfile(profileB, "user-b");

    const cachedA = await getCachedProfile("user-a");
    const cachedB = await getCachedProfile("user-b");

    expect(cachedA?.pointerSensitivity).toBe(80);
    expect(cachedB?.pointerSensitivity).toBe(20);

    // No anonymous/default bucket exists, even when JavaScript bypasses TypeScript.
    await expect(getCachedProfile("")).rejects.toThrow();
    await expect(setCachedProfile(profileA, "")).rejects.toThrow();
    await expect(clearCachedProfile("")).rejects.toThrow();
  });

  it("keeps a server profile authoritative when the browser cache contains stale settings", async () => {
    const staleCache = { ...SETTINGS_OFF, pointerSensitivity: 5 };
    const serverProfile = { ...SETTINGS_OFF, pointerSensitivity: 91 };
    await setCachedProfile(staleCache, "server-user");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider initialProfile={serverProfile} userId="server-user">
        {children}
      </HeadControlProvider>
    );

    const { result } = renderHook(() => useHeadControl(), { wrapper });
    await act(async () => Promise.resolve());

    expect(result.current.profile).toEqual(serverProfile);
  });

  it("resets profile state and rejects a late cache result when authenticated user changes", async () => {
    await setCachedProfile({ ...SETTINGS_OFF, pointerSensitivity: 88 }, "user-a");
    const rendered = render(
      <HeadControlProvider userId="user-a">
        <ProfileValue />
      </HeadControlProvider>
    );
    const sensitivity = () =>
      Number(rendered.getByTestId("profile-sensitivity").textContent);
    await waitFor(() => expect(sensitivity()).toBe(88));

    rendered.rerender(
      <HeadControlProvider userId="user-b">
        <ProfileValue />
      </HeadControlProvider>
    );

    await waitFor(() => expect(sensitivity()).toBe(50));
    expect(await getCachedProfile("user-b")).toBeNull();
  });

  it("requires 350ms hold duration for eye_blink_long gesture", () => {
    const activateSpy = vi.fn();
    const btn = document.createElement("button");
    btn.textContent = "Test Button";
    document.body.appendChild(btn);

    const detector = new GestureDetector({
      gestureType: "eye_blink_long",
      threshold: 50,
      cooldownMs: 500,
      onActivate: activateSpy
    });

    const blinkHigh = [{ categoryName: "eyeBlinkLeft", score: 0.8 }, { categoryName: "eyeBlinkRight", score: 0.8 }];

    // 0ms: Quick blink starts at 1000ms
    let status = detector.processFrame(blinkHigh, btn, 1000, true);
    expect(status.isDetected).toBe(true);
    expect(status.isTriggered).toBe(false);

    // 150ms: Still under 350ms duration requirement
    status = detector.processFrame(blinkHigh, btn, 1150, true);
    expect(status.isTriggered).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();

    // Release blink at 1200ms -> resets hold state
    detector.processFrame([], btn, 1200, true);

    // Now start a continuous long blink hold starting at 2000ms
    detector.processFrame(blinkHigh, btn, 2000, true); // 0ms hold
    detector.processFrame(blinkHigh, btn, 2200, true); // 200ms hold (under 350ms)
    expect(activateSpy).not.toHaveBeenCalled();

    status = detector.processFrame(blinkHigh, btn, 2380, true); // 380ms hold -> TRIGGER!
    expect(status.isTriggered).toBe(true);
    expect(activateSpy).toHaveBeenCalledTimes(1);
  });

  it("requires gesture release before a held signal can approve confirmation", () => {
    const trigger = document.createElement("button");
    const approve = document.createElement("button");
    const activate = vi.fn();
    const detector = new GestureDetector({
      gestureType: "mouth_open",
      threshold: 50,
      cooldownMs: 500,
      onActivate: activate
    });
    const held = [{ categoryName: "jawOpen", score: 0.9 }];

    expect(detector.processFrame(held, trigger, 1000, true).isTriggered).toBe(true);
    detector.disarmUntilRelease();
    expect(detector.processFrame(held, approve, 2000, true).isTriggered).toBe(false);
    expect(detector.processFrame(held, approve, 2600, true).isTriggered).toBe(false);
    detector.processFrame([], approve, 2700, true);
    expect(detector.processFrame(held, approve, 2800, true).isTriggered).toBe(true);
    expect(activate).toHaveBeenNthCalledWith(1, trigger);
    expect(activate).toHaveBeenNthCalledWith(2, approve);
  });

  it("does not convert an off-target held gesture into a target activation", () => {
    const button = document.createElement("button");
    const activate = vi.fn();
    const detector = new GestureDetector({
      gestureType: "smile",
      threshold: 50,
      cooldownMs: 100,
      onActivate: activate
    });
    const held = [
      { categoryName: "mouthSmileLeft", score: 0.9 },
      { categoryName: "mouthSmileRight", score: 0.9 }
    ];

    detector.processFrame(held, null, 1000, true);
    expect(detector.processFrame(held, button, 1200, true).isTriggered).toBe(false);
    detector.processFrame([], button, 1300, true);
    expect(detector.processFrame(held, button, 1400, true).isTriggered).toBe(true);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("requires a complete new dwell cycle after confirmation opens", () => {
    const trigger = document.createElement("button");
    const approve = document.createElement("button");
    const activate = vi.fn();
    const controller = new DwellController({
      dwellDurationMs: 300,
      stabilityWindowMs: 100,
      onActivate: activate
    });
    const point = { x: 100, y: 100 };
    const bounds = new DOMRect(80, 80, 40, 40);

    controller.processFrame(point, trigger, bounds, 1000, true);
    controller.processFrame(point, trigger, bounds, 1100, true);
    expect(controller.processFrame(point, trigger, bounds, 1250, true).progressRatio).toBe(0.5);

    controller.requireFreshCycle();
    expect(controller.processFrame(point, approve, bounds, 1260, true).state).toBe("idle");
    expect(controller.processFrame(point, approve, bounds, 1270, true).state).toBe("stabilizing");
    expect(controller.processFrame(point, approve, bounds, 1370, true).progressRatio).toBe(0);
    expect(controller.processFrame(point, approve, bounds, 1669, true).progressRatio).toBeLessThan(1);
    controller.processFrame(point, approve, bounds, 1670, true);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(approve);
  });

  it("uses updated sensitivity, dead zone, and smoothing in the installed frame callback", async () => {
    const engine = createControllableEngine();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider
        engineFactory={engine.factory}
        initialProfile={SETTINGS_OFF}
        userId="test-user"
      >
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    const { stream } = createMockStream();
    const video = document.createElement("video");
    const poseDelta = { yaw: 0.8, pitch: 0.6, roll: 0 };

    await act(async () => {
      expect(await result.current.startCamera(video, stream)).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100, { poseDelta }));
      }
    });

    const positionBeforeUpdate = result.current.pointerPosition;
    const updatedProfile = {
      ...SETTINGS_OFF,
      pointerSensitivity: 90,
      deadZone: 0,
      smoothing: 10
    };
    act(() => result.current.updateProfile(updatedProfile));
    act(() => engine.emit(visionFrame(600, { poseDelta })));

    const delta = mapCameraPoseToScreenDelta(
      poseDelta.yaw,
      poseDelta.pitch,
      updatedProfile.pointerSensitivity,
      updatedProfile.deadZone,
      window.innerWidth,
      window.innerHeight
    );
    const expected = smoothCoordinates(
      positionBeforeUpdate,
      { x: window.innerWidth / 2 + delta.x, y: window.innerHeight / 2 + delta.y },
      updatedProfile.smoothing,
      100,
      0
    );

    expect(result.current.pointerPosition.x).toBeCloseTo(expected.x, 5);
    expect(result.current.pointerPosition.y).toBeCloseTo(expected.y, 5);
    expect(engine.factory).toHaveBeenCalledTimes(1);
  });

  it("dispatches a real dwell click before emitting pointer activation feedback", async () => {
    const engine = createControllableEngine();
    const profile: AccessibilityProfile = {
      ...SETTINGS_OFF,
      selectionMode: "dwell",
      dwellDurationMs: 300
    };
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    document.body.appendChild(button);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} initialProfile={profile} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });

    await act(async () => {
      expect(await result.current.startCamera(document.createElement("video"), createMockStream().stream)).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100));
      }
      engine.emit(visionFrame(600));
      engine.emit(visionFrame(800));
      engine.emit(visionFrame(900));
      engine.emit(visionFrame(1200));
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.activationFeedbackKey).toBe(1);
  });

  it("does not emit activation feedback when dwell is cancelled before dispatch", async () => {
    const engine = createControllableEngine();
    const profile: AccessibilityProfile = {
      ...SETTINGS_OFF,
      selectionMode: "dwell",
      dwellDurationMs: 300
    };
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    document.body.appendChild(button);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} initialProfile={profile} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });

    await act(async () => {
      expect(await result.current.startCamera(document.createElement("video"), createMockStream().stream)).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100));
      }
      engine.emit(visionFrame(600));
      engine.emit(visionFrame(800));
      engine.emit(visionFrame(900));
      engine.emit(visionFrame(1000, { lifecycleState: "tracking_lost", faceDetected: false }));
    });

    expect(click).not.toHaveBeenCalled();
    expect(result.current.activationFeedbackKey).toBe(0);
  });

  it("blocks a held gesture across modal opening, then allows a released fresh gesture", async () => {
    const engine = createControllableEngine();
    const profile: AccessibilityProfile = {
      ...SETTINGS_OFF,
      selectionMode: "gesture",
      gestureType: "mouth_open",
      gestureThreshold: 50,
      gestureCooldownMs: 500
    };
    const trigger = document.createElement("button");
    const approve = document.createElement("button");
    const triggerClick = vi.fn();
    const approveClick = vi.fn();
    trigger.addEventListener("click", () => {
      triggerClick();
      const modal = document.createElement("div");
      modal.dataset.aksaConfirmationGuard = "true";
      modal.appendChild(approve);
      document.body.appendChild(modal);
    });
    approve.addEventListener("click", approveClick);
    document.body.appendChild(trigger);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => (approve.isConnected ? approve : trigger))
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} initialProfile={profile} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    const { stream } = createMockStream();
    const held = [{ categoryName: "jawOpen", score: 0.9 }];

    await act(async () => {
      expect(await result.current.startCamera(document.createElement("video"), stream)).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100, { blendshapes: held }));
      }
      engine.emit(visionFrame(600, { blendshapes: [] }));
      engine.emit(visionFrame(700, { blendshapes: [] }));
      engine.emit(visionFrame(800, { blendshapes: held }));
    });

    expect(triggerClick).toHaveBeenCalledTimes(1);
    expect(approveClick).not.toHaveBeenCalled();

    act(() => {
      engine.emit(visionFrame(900, { blendshapes: held }));
      engine.emit(visionFrame(1400, { blendshapes: held }));
    });
    expect(approveClick).not.toHaveBeenCalled();

    act(() => {
      engine.emit(visionFrame(1500, { blendshapes: [] }));
      engine.emit(visionFrame(1600, { blendshapes: held }));
    });
    expect(approveClick).toHaveBeenCalledTimes(1);
  });

  it("cancels activation on loss and requires stable recovery plus gesture release", async () => {
    const engine = createControllableEngine();
    const profile: AccessibilityProfile = {
      ...SETTINGS_OFF,
      deadZone: 0,
      selectionMode: "gesture",
      gestureType: "mouth_open",
      gestureThreshold: 50,
      gestureCooldownMs: 500
    };
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    document.body.appendChild(button);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => button)
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} initialProfile={profile} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    const { stream } = createMockStream();
    const held = [{ categoryName: "jawOpen", score: 0.9 }];

    await act(async () => {
      expect(await result.current.startCamera(document.createElement("video"), stream)).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100, { blendshapes: held }));
      }
      engine.emit(visionFrame(600, { blendshapes: [] }));
      engine.emit(visionFrame(700, { blendshapes: [] }));
      engine.emit(visionFrame(800, { blendshapes: held }));
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.activationFeedbackKey).toBe(1);

    act(() => {
      engine.emit(
        visionFrame(900, {
          lifecycleState: "tracking_lost",
          faceDetected: false,
          blendshapes: held
        })
      );
    });
    expect(result.current.lifecycleState).toBe("tracking_lost");
    expect(result.current.activeTarget).toBeNull();
    expect(result.current.dwellProgress.state).toBe("idle");
    expect(result.current.gestureStatus.isTriggered).toBe(false);

    const recoveryDelta = { yaw: -1, pitch: 0.5, roll: 0 };
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(
          visionFrame(900 + index * 100, { poseDelta: recoveryDelta, blendshapes: held })
        );
      }
    });
    const recoveryMapped = mapCameraPoseToScreenDelta(
      recoveryDelta.yaw,
      recoveryDelta.pitch,
      profile.pointerSensitivity,
      profile.deadZone,
      window.innerWidth,
      window.innerHeight
    );
    expect(result.current.pointerPosition.x).toBeCloseTo(window.innerWidth / 2 + recoveryMapped.x, 5);
    expect(result.current.pointerPosition.y).toBeCloseTo(window.innerHeight / 2 + recoveryMapped.y, 5);
    expect(result.current.activeTarget).toBeNull();
    expect(click).toHaveBeenCalledTimes(1);

    act(() => engine.emit(visionFrame(1500, { blendshapes: held })));
    expect(click).toHaveBeenCalledTimes(1);
    act(() => {
      engine.emit(visionFrame(1600, { blendshapes: [] }));
      engine.emit(visionFrame(1700, { blendshapes: held }));
    });
    expect(click).toHaveBeenCalledTimes(2);
    expect(result.current.activationFeedbackKey).toBe(2);
  });

  it("requires stable reacquisition and gesture release after disabling and restarting", async () => {
    const engine = createControllableEngine();
    const profile: AccessibilityProfile = {
      ...SETTINGS_OFF,
      selectionMode: "gesture",
      gestureType: "mouth_open",
      gestureThreshold: 50,
      gestureCooldownMs: 500
    };
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    document.body.appendChild(button);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => button)
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} initialProfile={profile} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    const held = [{ categoryName: "jawOpen", score: 0.9 }];

    await act(async () => {
      expect(
        await result.current.startCamera(document.createElement("video"), createMockStream().stream)
      ).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100, { blendshapes: held }));
      }
      engine.emit(visionFrame(600, { blendshapes: [] }));
      engine.emit(visionFrame(700, { blendshapes: [] }));
      engine.emit(visionFrame(800, { blendshapes: held }));
    });
    expect(click).toHaveBeenCalledTimes(1);

    act(() => result.current.disableControl());
    await act(async () => {
      expect(
        await result.current.startCamera(document.createElement("video"), createMockStream().stream)
      ).toBe(true);
    });
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(1000 + index * 100, { blendshapes: held }));
      }
      engine.emit(visionFrame(1600, { blendshapes: held }));
    });
    expect(click).toHaveBeenCalledTimes(1);

    act(() => {
      engine.emit(visionFrame(1700, { blendshapes: [] }));
      engine.emit(visionFrame(1800, { blendshapes: held }));
    });
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("requires active tracking, uses real frames, and clears calibration samples on loss", async () => {
    const engine = createControllableEngine();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider
        engineFactory={engine.factory}
        initialProfile={SETTINGS_OFF}
        userId="test-user"
      >
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    const { stream } = createMockStream();
    const pose = { yaw: 2, pitch: 4, roll: 1 };

    await act(async () => {
      expect(await result.current.startCamera(document.createElement("video"), stream)).toBe(true);
    });
    act(() => result.current.startCalibration());
    expect(result.current.calibrationState.status).toBe("idle");
    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(index * 100, { pose }));
      }
      engine.emit(visionFrame(600, { pose }));
    });
    expect(result.current.lifecycleState).toBe("active");
    act(() => result.current.startCalibration());
    expect(result.current.calibrationState.samplesCount).toBe(0);

    act(() => {
      for (let index = 1; index <= 7; index += 1) {
        engine.emit(visionFrame(600 + index * 100, { pose }));
      }
    });
    expect(result.current.calibrationState.samplesCount).toBe(7);
    act(() => {
      engine.emit(
        visionFrame(1400, { lifecycleState: "tracking_lost", faceDetected: false, pose })
      );
    });
    expect(result.current.calibrationState.status).toBe("capturing");
    expect(result.current.calibrationState.samplesCount).toBe(0);

    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        engine.emit(visionFrame(1400 + index * 100, { pose }));
      }
      for (let index = 1; index <= 19; index += 1) {
        engine.emit(visionFrame(1900 + index * 100, { pose }));
      }
    });
    expect(result.current.calibrationState.status).toBe("capturing");
    expect(result.current.calibrationState.samplesCount).toBe(19);

    act(() => engine.emit(visionFrame(3900, { pose })));
    expect(result.current.calibrationState.status).toBe("completed");
    expect(result.current.calibrationState.samplesCount).toBe(0);
    expect(result.current.neutralBaseline).toEqual(pose);
    expect(engine.setNeutralBaseline).toHaveBeenCalledWith(pose);
  });

  it("calibration consumes real supplied frame poses and discards raw samples after completion", () => {
    const calEngine = new CalibrationEngine(5);
    calEngine.start();

    for (let i = 0; i < 5; i++) {
      calEngine.addSample({ yaw: 2, pitch: 4, roll: 0 });
    }

    const state = calEngine.getState();
    expect(state.status).toBe("completed");
    expect(state.baseline).toEqual({ yaw: 2, pitch: 4, roll: 0 });
    expect(state.samplesCount).toBe(0); // Raw sample array cleared
  });

  it("stops the acquired stream and removes the hidden video when model startup fails", async () => {
    const { stop, stream } = createMockStream();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    });
    const engineFactory = createEngineFactory({ initialized: false });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engineFactory} userId="test-user">
        {children}
      </HeadControlProvider>
    );

    const { result } = renderHook(() => useHeadControl(), { wrapper });

    let success = true;
    await act(async () => {
      success = await result.current.startHeadControl(null);
    });

    expect(success).toBe(false);
    expect(stop).toHaveBeenCalled();
    expect(document.body.querySelector("video")).toBeNull();
    expect(result.current.lifecycleState).toBe("error");
    expect(result.current.errorCategory).toBe("model_load_failed");
  });

  it("stops the acquired stream when video attachment throws", async () => {
    const { stop, stream } = createMockStream();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    });
    const video = document.createElement("video");
    Object.defineProperty(video, "srcObject", {
      configurable: true,
      get: () => null,
      set: () => {
        throw new DOMException("attachment failed", "NotReadableError");
      }
    });
    const engineFactory = createEngineFactory({ initialized: true });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engineFactory} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });

    let success = true;
    await act(async () => {
      success = await result.current.startHeadControl(video);
    });

    expect(success).toBe(false);
    expect(stop).toHaveBeenCalled();
    expect(result.current.lifecycleState).toBe("error");
    expect(result.current.errorCategory).toBe("camera_unavailable");
  });

  it("stops a late camera stream when startup is cancelled during permission", async () => {
    const { stop, stream } = createMockStream();
    let resolveStream: (stream: MediaStream) => void = () => undefined;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => pendingStream) }
    });
    const engineFactory = vi.fn(createEngineFactory({ initialized: true }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engineFactory} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });
    let startup: Promise<boolean> = Promise.resolve(true);

    act(() => {
      startup = result.current.startHeadControl();
    });
    expect(result.current.lifecycleState).toBe("initializing");
    act(() => result.current.disableControl());

    let outcome = true;
    await act(async () => {
      resolveStream(stream);
      outcome = await startup;
    });

    expect(outcome).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(engineFactory).not.toHaveBeenCalled();
    expect(result.current.lifecycleState).toBe("disabled");
    expect(document.body.querySelector("video")).toBeNull();
  });

  it("provider unmount disables the engine and releases its camera stream", async () => {
    const { stop, stream } = createMockStream();
    let ownedStream: MediaStream | null = null;
    const disable = vi.fn(() => {
      ownedStream?.getTracks().forEach((track) => track.stop());
      ownedStream = null;
    });
    const engineFactory: HeadControlEngineFactory = () => ({
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn((_video, nextStream) => {
        ownedStream = nextStream;
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      disable,
      setNeutralBaseline: vi.fn()
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engineFactory} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const rendered = renderHook(() => useHeadControl(), { wrapper });
    const video = document.createElement("video");

    await act(async () => {
      expect(await rendered.result.current.startCamera(video, stream)).toBe(true);
    });
    rendered.unmount();

    expect(disable).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it("removes its hidden video after a runtime stream failure", async () => {
    const engine = createControllableEngine();
    const { stream } = createMockStream();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider engineFactory={engine.factory} userId="test-user">
        {children}
      </HeadControlProvider>
    );
    const { result } = renderHook(() => useHeadControl(), { wrapper });

    await act(async () => {
      expect(await result.current.startHeadControl()).toBe(true);
    });
    expect(document.body.querySelector("video")).not.toBeNull();

    act(() => {
      for (let index = 1; index <= 6; index += 1) {
        engine.emit(visionFrame(index * 100));
      }
    });
    act(() => {
      result.current.startCalibration();
      engine.emit(visionFrame(700));
    });
    expect(result.current.calibrationState.samplesCount).toBe(1);

    act(() => engine.emitState("error", "stream_ended"));

    expect(document.body.querySelector("video")).toBeNull();
    expect(result.current.lifecycleState).toBe("error");
    expect(result.current.errorCategory).toBe("stream_ended");
    expect(result.current.calibrationState.samplesCount).toBe(0);
  });
});
