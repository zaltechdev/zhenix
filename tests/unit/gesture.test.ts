import { describe, expect, it, vi, beforeEach } from "vitest";
import { GestureDetector } from "@/lib/client/vision/gesture-detector";

describe("Gesture Selection Detector", () => {
  let detector: GestureDetector;
  let mockBtn: HTMLButtonElement;
  let activateSpy: (target: HTMLElement) => void;

  beforeEach(() => {
    mockBtn = document.createElement("button");
    mockBtn.textContent = "Action";
    document.body.appendChild(mockBtn);
    activateSpy = vi.fn();

    detector = new GestureDetector({
      gestureType: "mouth_open",
      threshold: 50,
      cooldownMs: 500,
      onActivate: activateSpy
    });
  });

  it("does nothing when gesture score is below threshold", () => {
    const blendshapes = [{ categoryName: "jawOpen", score: 0.2 }];
    const status = detector.processFrame(blendshapes, mockBtn, 1000, true);

    expect(status.isDetected).toBe(false);
    expect(status.isTriggered).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();
  });

  it("activates once on rising-edge threshold crossing over eligible target", () => {
    // Frame 1: Below threshold
    detector.processFrame([{ categoryName: "jawOpen", score: 0.2 }], mockBtn, 1000, true);

    // Frame 2: Crosses threshold -> Trigger!
    const status = detector.processFrame([{ categoryName: "jawOpen", score: 0.7 }], mockBtn, 1030, true);

    expect(status.isDetected).toBe(true);
    expect(status.isTriggered).toBe(true);
    expect(activateSpy).toHaveBeenCalledTimes(1);
    expect(activateSpy).toHaveBeenCalledWith(mockBtn);
  });

  it("prevents continuous hold click spam", () => {
    // Frame 1: Trigger
    detector.processFrame([{ categoryName: "jawOpen", score: 0.2 }], mockBtn, 1000, true);
    detector.processFrame([{ categoryName: "jawOpen", score: 0.7 }], mockBtn, 1030, true);

    // Frame 3 & 4: Continuous hold above threshold
    detector.processFrame([{ categoryName: "jawOpen", score: 0.75 }], mockBtn, 1060, true);
    detector.processFrame([{ categoryName: "jawOpen", score: 0.8 }], mockBtn, 1090, true);

    expect(activateSpy).toHaveBeenCalledTimes(1); // STILL only 1 click!
  });

  it("does nothing when performed over empty space (off-target)", () => {
    detector.processFrame([{ categoryName: "jawOpen", score: 0.2 }], null, 1000, true);
    const status = detector.processFrame([{ categoryName: "jawOpen", score: 0.8 }], null, 1030, true);

    expect(status.isDetected).toBe(true);
    expect(status.isTriggered).toBe(false);
    expect(activateSpy).not.toHaveBeenCalled();
  });
});
