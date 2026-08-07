import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { HeadControlProvider, useHeadControl } from "@/lib/client/vision/head-control-context";
import { getCachedProfile, setCachedProfile, clearCachedProfile } from "@/lib/client/vision/profile-cache";
import { GestureDetector } from "@/lib/client/vision/gesture-detector";

describe("Head Control Coordinator Integration", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    await clearCachedProfile("user-a");
    await clearCachedProfile("user-b");
  });

  it("isolates IndexedDB cached profiles by user ID", async () => {
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
    expect(cachedA?.selectionMode).toBe("dwell");
    expect(cachedB?.selectionMode).toBe("gesture");
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

    // 0ms: Blink starts
    let status = detector.processFrame(blinkHigh, btn, 1000, true);
    expect(status.isDetected).toBe(true);
    expect(status.isTriggered).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();

    // 200ms: Still holding blink (under 350ms duration)
    status = detector.processFrame(blinkHigh, btn, 1200, true);
    expect(status.isTriggered).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();

    // Released at 250ms (quick normal blink) -> reset hold
    status = detector.processFrame([], btn, 1250, true);
    expect(status.isDetected).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();

    // Now hold continuously for >= 350ms
    detector.processFrame(blinkHigh, btn, 2000, true); // 0ms hold
    detector.processFrame(blinkHigh, btn, 2200, true); // 200ms hold
    status = detector.processFrame(blinkHigh, btn, 2360, true); // 360ms hold -> TRIGGER!

    expect(status.isTriggered).toBe(true);
    expect(activateSpy).toHaveBeenCalledTimes(1);
  });

  it("provides active HeadControlContext to React components", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HeadControlProvider userId="test-user">{children}</HeadControlProvider>
    );

    const { result } = renderHook(() => useHeadControl(), { wrapper });

    expect(result.current.lifecycleState).toBe("idle");
    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.pauseControl();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.lifecycleState).toBe("paused");
  });
});
