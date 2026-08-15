import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  HeadControlController,
  type VirtualCursorState
} from "@/lib/client/vision/head-control-controller";
import { LANDMARK_INDICES } from "@/lib/client/vision/head-motion";

function createMockLandmarks(noseOffset = { x: 0, y: 0 }, eyeDistance = 100) {
  const landmarks = new Array(300).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
  const halfEye = eyeDistance / 2;
  landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER] = { x: 300 - halfEye, y: 200, z: 0 };
  landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER] = { x: 300 + halfEye, y: 200, z: 0 };
  landmarks[LANDMARK_INDICES.NOSE_TIP] = { x: 300 + noseOffset.x, y: 200 + noseOffset.y, z: 0 };
  return landmarks;
}

describe("HeadControlController", () => {
  let controller: HeadControlController;
  let cursorUpdates: VirtualCursorState[] = [];
  const mockDwellClick = vi.fn();
  const mockStatusChange = vi.fn();

  beforeEach(() => {
    cursorUpdates = [];
    vi.clearAllMocks();
    vi.useFakeTimers();

    controller = new HeadControlController({
      mouseTakeoverDelayMs: 2000,
      enableAudioFeedback: false,
      motionOptions: { sensitivity: 50, smoothing: 50, invertX: false },
      dwellOptions: { dwellDurationMs: 500, stabilityRadiusPx: 30 },
      onCursorUpdate: (state) => cursorUpdates.push(state),
      onDwellClick: mockDwellClick,
      onStatusChange: mockStatusChange
    });
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  it("initializes with idle status and default center position", () => {
    expect(controller.getStatus()).toBe("idle");
    const pos = controller.getCursorPosition();
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it("handles landmarker results and updates cursor position", () => {
    // Simulate first frame to establish neutral baseline
    const centerLandmarks = createMockLandmarks({ x: 0, y: 0 });
    controller.handleLandmarkerResult({ faceLandmarks: [centerLandmarks] } as unknown as FaceLandmarkerResult, 1000);

    const initialPos = { ...controller.getCursorPosition() };

    // Turn head right (nose shifted right by 15px)
    const rightLandmarks = createMockLandmarks({ x: 15, y: 0 });
    controller.handleLandmarkerResult({ faceLandmarks: [rightLandmarks] } as unknown as FaceLandmarkerResult, 1033);

    const updatedPos = controller.getCursorPosition();
    expect(updatedPos.x).toBeGreaterThan(initialPos.x);
    expect(cursorUpdates.length).toBe(2);
    expect(cursorUpdates[1].isVisible).toBe(true);
  });

  it("clamps cursor strictly within viewport boundaries", () => {
    // First frame establishes baseline
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 0, y: 0 })] } as unknown as FaceLandmarkerResult, 1000);

    // Continuous deflection to move cursor
    const extremeRightLandmarks = createMockLandmarks({ x: 25, y: 0 });
    for (let i = 0; i < 100; i++) {
      controller.handleLandmarkerResult({ faceLandmarks: [extremeRightLandmarks] } as unknown as FaceLandmarkerResult, 1000 + i * 33);
    }

    const pos = controller.getCursorPosition();
    expect(pos.x).toBeLessThanOrEqual(window.innerWidth);
    expect(pos.y).toBeLessThanOrEqual(window.innerHeight);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it("dispatches full synthetic DOM click and pointer events upon dwell completion", () => {
    const button = document.createElement("button");
    button.textContent = "Click Me";
    document.body.appendChild(button);

    const pointerDownSpy = vi.fn();
    const clickSpy = vi.fn();
    button.addEventListener("pointerdown", pointerDownSpy);
    button.addEventListener("click", clickSpy);

    // Mock document.elementFromPoint
    document.elementFromPoint = vi.fn().mockReturnValue(button);

    // Start dwell at t=1000
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 0, y: 0 })] } as unknown as FaceLandmarkerResult, 1000);
    expect(cursorUpdates[cursorUpdates.length - 1].dwellState).toBe("dwelling");

    // Complete dwell at t=1600 (elapsed 600ms >= 500ms dwell duration)
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 0, y: 0 })] } as unknown as FaceLandmarkerResult, 1600);

    expect(pointerDownSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(mockDwellClick).toHaveBeenCalledWith(button, expect.any(Object));

    document.body.removeChild(button);
  });

  it("handles physical mouse takeover and resumes after delay", () => {
    // First establish head tracking active
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 0, y: 0 })] } as unknown as FaceLandmarkerResult, 1000);

    // User moves physical mouse
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 100 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 120, clientY: 120 }));

    expect(controller.getStatus()).toBe("mouse_takeover");

    // Head movement should not move virtual cursor while in takeover
    const posDuringTakeover = { ...controller.getCursorPosition() };
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 15, y: 0 })] } as unknown as FaceLandmarkerResult, 1100);
    expect(controller.getCursorPosition()).toEqual(posDuringTakeover);

    // Advance timers past mouseTakeoverDelayMs (2000ms)
    vi.advanceTimersByTime(2100);

    expect(controller.getStatus()).toBe("active");

    // Head movement resumes
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 15, y: 0 })] } as unknown as FaceLandmarkerResult, 3200);
    expect(controller.getCursorPosition().x).toBeGreaterThan(posDuringTakeover.x);
  });

  it("recalibrates neutral baseline on calibrate()", () => {
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 0, y: 0 })] } as unknown as FaceLandmarkerResult, 1000);

    // Move head and calibrate
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 10, y: 5 })] } as unknown as FaceLandmarkerResult, 1033);
    controller.calibrate();

    // After recalibrate, the current deflected pose is the new baseline (delta becomes 0)
    controller.handleLandmarkerResult({ faceLandmarks: [createMockLandmarks({ x: 10, y: 5 })] } as unknown as FaceLandmarkerResult, 1066);
    const lastMotion = controller.getMotionFilter().getLastMotion();
    expect(lastMotion?.vx).toBe(0);
    expect(lastMotion?.vy).toBe(0);
  });
});
