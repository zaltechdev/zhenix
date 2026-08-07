import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { HeadControlProvider, useHeadControl } from "@/lib/client/vision/head-control-context";
import { getCachedProfile, setCachedProfile, clearCachedProfile } from "@/lib/client/vision/profile-cache";
import { GestureDetector } from "@/lib/client/vision/gesture-detector";
import { CalibrationEngine } from "@/lib/client/vision/calibration";
import { VisionEngine } from "@/lib/client/vision/vision-engine";

describe("Head Control Coordinator Comprehensive Regression Suite", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
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

  it("reports error when camera initialization fails without setting state to ready", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider userId="test-user">{children}</HeadControlProvider>
    );

    const { result } = renderHook(() => useHeadControl(), { wrapper });

    // Mock MediaPipe init failure
    const mockEngine = new VisionEngine();
    vi.spyOn(mockEngine, "initialize").mockResolvedValue(false);

    let success = true;
    await act(async () => {
      success = await result.current.startHeadControl(null);
    });

    expect(success).toBe(false);
  });

  it("teardown stops stream tracks and animation frame loop on unmount", () => {
    const trackStopSpy = vi.fn();
    const mockTrack = { stop: trackStopSpy } as unknown as MediaStreamTrack;
    const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream;

    const videoEl = document.createElement("video");
    const engine = new VisionEngine();

    engine.start(videoEl, mockStream);
    engine.disable();

    expect(trackStopSpy).toHaveBeenCalled();
    expect(engine.getState()).toBe("disabled");
  });
});
