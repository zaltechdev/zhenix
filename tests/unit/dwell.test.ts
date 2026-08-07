import { describe, expect, it, vi, beforeEach } from "vitest";
import { DwellController } from "@/lib/client/vision/dwell-controller";

describe("Dwell Selection Controller", () => {
  let controller: DwellController;
  let mockBtn: HTMLButtonElement;
  let activateSpy: (target: HTMLElement) => void;

  beforeEach(() => {
    mockBtn = document.createElement("button");
    mockBtn.textContent = "Submit";
    document.body.appendChild(mockBtn);
    activateSpy = vi.fn();

    controller = new DwellController({
      dwellDurationMs: 1000,
      cooldownMs: 500,
      stabilityRadiusPx: 35,
      stabilityWindowMs: 100,
      onActivate: activateSpy
    });
  });

  it("starts dwell only on eligible target and completes after configured duration", () => {
    const pos = { x: 100, y: 100 };
    const rect = mockBtn.getBoundingClientRect();

    // 0ms: enter target -> stabilizing
    let result = controller.processFrame(pos, mockBtn, rect, 1000, true);
    expect(result.state).toBe("stabilizing");

    // 150ms: stability window passed -> dwelling
    result = controller.processFrame(pos, mockBtn, rect, 1150, true);
    expect(result.state).toBe("dwelling");
    expect(result.progressRatio).toBeLessThan(1.0);

    // 1200ms: dwell duration completed -> activates ONCE and enters cooldown
    result = controller.processFrame(pos, mockBtn, rect, 2200, true);
    expect(result.state).toBe("cooldown");
    expect(activateSpy).toHaveBeenCalledTimes(1);
    expect(activateSpy).toHaveBeenCalledWith(mockBtn);
  });

  it("cancels immediately when moving off target before completion", () => {
    const pos = { x: 100, y: 100 };
    const rect = mockBtn.getBoundingClientRect();

    controller.processFrame(pos, mockBtn, rect, 1000, true);
    controller.processFrame(pos, mockBtn, rect, 1150, true); // dwelling

    // Pointer leaves target -> reset to idle
    const result = controller.processFrame(pos, null, null, 1500, true);
    expect(result.state).toBe("idle");
    expect(result.progressRatio).toBe(0);
    expect(activateSpy).not.toHaveBeenCalled();
  });

  it("cancels when control is paused or confirmation guard is active", () => {
    const pos = { x: 100, y: 100 };
    const rect = mockBtn.getBoundingClientRect();

    controller.processFrame(pos, mockBtn, rect, 1000, true);
    controller.processFrame(pos, mockBtn, rect, 1150, true); // dwelling

    // Control paused
    const result = controller.processFrame(pos, mockBtn, rect, 1300, false);
    expect(result.state).toBe("idle");
    expect(activateSpy).not.toHaveBeenCalled();
  });

  it("blocks immediate repeat activation during cooldown", () => {
    const pos = { x: 100, y: 100 };
    const rect = mockBtn.getBoundingClientRect();

    controller.processFrame(pos, mockBtn, rect, 1000, true);
    controller.processFrame(pos, mockBtn, rect, 1150, true);
    controller.processFrame(pos, mockBtn, rect, 2200, true); // activated once, cooldown

    // Continuous dwelling during cooldown
    controller.processFrame(pos, mockBtn, rect, 2300, true);
    expect(activateSpy).toHaveBeenCalledTimes(1); // STILL only 1 click!
  });
});
