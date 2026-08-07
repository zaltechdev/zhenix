import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  HeadControlProvider,
  useHeadControl,
  type HeadControlEngineFactory
} from "@/lib/client/vision/head-control-context";
import { getCachedProfile, setCachedProfile, clearCachedProfile } from "@/lib/client/vision/profile-cache";
import { GestureDetector } from "@/lib/client/vision/gesture-detector";
import { CalibrationEngine } from "@/lib/client/vision/calibration";

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

describe("Head Control Coordinator Comprehensive Regression Suite", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    await clearCachedProfile("user-a");
    await clearCachedProfile("user-b");
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

    // Enforce mandatory user ID error on empty string
    await expect(setCachedProfile(profileA, "")).rejects.toThrow();
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

  it("prevents stale profile closure: updating profile changes pointer mapping live", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider userId="test-user">{children}</HeadControlProvider>
    );

    const { result } = renderHook(() => useHeadControl(), { wrapper });

    const initialSens = result.current.profile.pointerSensitivity;

    act(() => {
      result.current.updateProfile({
        ...result.current.profile,
        pointerSensitivity: 95
      });
    });

    expect(result.current.profile.pointerSensitivity).toBe(95);
    expect(result.current.profile.pointerSensitivity).not.toBe(initialSens);
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
});
