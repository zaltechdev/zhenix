import { describe, expect, it, vi } from "vitest";
import { DwellController } from "@/lib/client/vision/dwell-controller";
import {
  TargetAssistController,
  TARGET_ASSIST_DEFAULTS,
  selectTargetAssistCandidate
} from "@/lib/client/vision/target-assist";
import { distanceToRectangle, type TargetCandidate } from "@/lib/client/vision/target-resolver";

function candidate(
  element: HTMLElement,
  left: number,
  top: number,
  width: number,
  height: number,
  order = 0
): TargetCandidate {
  return {
    element,
    bounds: new DOMRect(left, top, width, height),
    distancePx: Number.POSITIVE_INFINITY,
    order
  };
}

describe("Target Assist", () => {
  it("measures distance to a target rectangle instead of its centre", () => {
    const rect = new DOMRect(100, 100, 200, 80);

    expect(distanceToRectangle({ x: 90, y: 140 }, rect)).toBe(10);
    expect(distanceToRectangle({ x: 150, y: 140 }, rect)).toBe(0);
  });

  it("uses a clearly nearest eligible target with deterministic document order", () => {
    const first = document.createElement("button");
    const second = document.createElement("button");
    const pointer = { x: 90, y: 120 };
    const firstCandidate = candidate(first, 100, 100, 80, 40, 0);
    const secondCandidate = candidate(second, 200, 100, 80, 40, 1);

    expect(
      selectTargetAssistCandidate(pointer, [secondCandidate, firstCandidate])?.element
    ).toBe(first);
    expect(TARGET_ASSIST_DEFAULTS.assistRadiusPx).toBeGreaterThanOrEqual(30);
    expect(TARGET_ASSIST_DEFAULTS.assistRadiusPx).toBeLessThanOrEqual(50);
  });

  it("waits through the acquisition delay before locking a stable candidate", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 80, 40);
    const controller = new TargetAssistController();
    const pointer = { x: 95, y: 120 };

    expect(controller.process(pointer, [target], 0).isLocked).toBe(false);
    expect(controller.process(pointer, [target], 124).isLocked).toBe(false);
    expect(controller.process(pointer, [target], 125)).toMatchObject({
      activeTarget: button,
      isLocked: true
    });
  });

  it("suppresses tiny pointer jitter after a target lock", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 80, 40);
    const controller = new TargetAssistController();

    controller.process({ x: 95, y: 120 }, [target], 0);
    const locked = controller.process({ x: 95, y: 120 }, [target], 125);
    const jittered = controller.process({ x: 98, y: 120 }, [target], 225);

    expect(locked.isLocked).toBe(true);
    expect(jittered).toMatchObject({ activeTarget: button, isLocked: true });
    expect(jittered.position).toEqual(locked.position);
  });

  it("holds a lock inside its larger release radius, then releases outside it", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 60, 40);
    const controller = new TargetAssistController({
      escapeDisplacementPx: 200,
      escapeVelocityPxPerMs: 100
    });

    controller.process({ x: 95, y: 120 }, [target], 0);
    controller.process({ x: 95, y: 120 }, [target], 125);

    expect(controller.process({ x: 210, y: 120 }, [target], 1125)).toMatchObject({
      activeTarget: button,
      isLocked: true,
      released: false
    });
    expect(controller.process({ x: 231, y: 120 }, [target], 1225)).toMatchObject({
      activeTarget: button,
      isLocked: true,
      selectionSuppressed: true
    });
    expect(controller.process({ x: 250, y: 120 }, [target], 1325)).toMatchObject({
      activeTarget: null,
      isLocked: false,
      released: true
    });
  });

  it("releases after sustained deliberate raw-pointer movement escapes the lock", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 240, 60);
    const controller = new TargetAssistController({ escapeVelocityPxPerMs: 100 });

    controller.process({ x: 105, y: 120 }, [target], 0);
    controller.process({ x: 105, y: 120 }, [target], 125);

    expect(controller.process({ x: 145, y: 120 }, [target], 1125)).toMatchObject({
      activeTarget: button,
      isLocked: true,
      selectionSuppressed: true
    });
    expect(controller.process({ x: 180, y: 120 }, [target], 1225)).toMatchObject({
      activeTarget: null,
      isLocked: false,
      released: true
    });
  });

  it("does not oscillate between adjacent equally close controls", () => {
    const left = document.createElement("button");
    const right = document.createElement("button");
    const leftTarget = candidate(left, 100, 100, 40, 40, 0);
    const rightTarget = candidate(right, 150, 100, 40, 40, 1);
    const controller = new TargetAssistController({ escapeVelocityPxPerMs: 100 });

    expect(controller.process({ x: 145, y: 120 }, [leftTarget, rightTarget], 0).candidateTarget).toBeNull();
    controller.process({ x: 120, y: 120 }, [leftTarget, rightTarget], 100);
    expect(controller.process({ x: 120, y: 120 }, [leftTarget, rightTarget], 225)).toMatchObject({
      activeTarget: left,
      isLocked: true
    });
    expect(controller.process({ x: 145, y: 120 }, [leftTarget, rightTarget], 325)).toMatchObject({
      activeTarget: left,
      isLocked: true
    });
  });

  it("cancels dwell as soon as target assist unlocks", () => {
    const button = document.createElement("button");
    const activate = vi.fn();
    const target = candidate(button, 100, 100, 240, 60);
    const assist = new TargetAssistController({ escapeVelocityPxPerMs: 100 });
    const dwell = new DwellController({
      dwellDurationMs: 300,
      stabilityWindowMs: 50,
      onActivate: activate
    });

    assist.process({ x: 105, y: 120 }, [target], 0);
    const locked = assist.process({ x: 105, y: 120 }, [target], 125);
    dwell.processFrame(locked.position, locked.activeTarget, locked.activeTargetBounds, 125, true);
    expect(
      dwell.processFrame(locked.position, locked.activeTarget, locked.activeTargetBounds, 175, true).state
    ).toBe("dwelling");

    const escaping = assist.process({ x: 145, y: 120 }, [target], 275);
    expect(
      dwell.processFrame(
        escaping.position,
        escaping.selectionSuppressed ? null : escaping.activeTarget,
        escaping.activeTargetBounds,
        275,
        true
      )
    ).toMatchObject({ state: "idle", progressRatio: 0 });
    const released = assist.process({ x: 180, y: 120 }, [target], 300);
    expect(released).toMatchObject({ activeTarget: null, isLocked: false, released: true });
    expect(activate).not.toHaveBeenCalled();
  });

  it("holds the visual lock through one spike without target flapping", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 80, 40);
    const controller = new TargetAssistController();

    controller.process({ x: 95, y: 120 }, [target], 0);
    controller.process({ x: 95, y: 120 }, [target], 125);

    expect(controller.process({ x: 180, y: 120 }, [target], 150)).toMatchObject({
      activeTarget: button,
      isLocked: true,
      selectionSuppressed: true
    });
    expect(controller.process({ x: 96, y: 120 }, [target], 175)).toMatchObject({
      activeTarget: button,
      isLocked: true,
      selectionSuppressed: false
    });
  });

  it("clears locks on tracking loss and requires a fresh acquisition", () => {
    const button = document.createElement("button");
    const target = candidate(button, 100, 100, 80, 40);
    const controller = new TargetAssistController();

    controller.process({ x: 95, y: 120 }, [target], 0);
    expect(controller.process({ x: 95, y: 120 }, [target], 125).isLocked).toBe(true);

    controller.clear();
    expect(controller.process({ x: 95, y: 120 }, [target], 225)).toMatchObject({
      activeTarget: null,
      isLocked: false
    });
  });
});
