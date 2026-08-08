import { describe, expect, it } from "vitest";
import { RestLockController } from "@/lib/client/vision/rest-lock";

describe("RestLockController", () => {
  function createRestLock() {
    return new RestLockController({
      stabilityEnvelopePx: 3,
      acquisitionDelayMs: 150,
      releaseDistancePx: 12,
      releaseVelocityPxPerMs: 0.45,
      sustainedEscapeFrames: 2,
      minimumEscapeStepPx: 2
    });
  }

  it("acquires after a stable envelope and freezes stationary pointer jitter", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 102, y: 101 }, 90);
    const acquired = restLock.process({ x: 101, y: 102 }, 160);

    expect(acquired).toMatchObject({ position: { x: 100, y: 100 }, isLocked: true });
    expect(restLock.process({ x: 102, y: 99 }, 240)).toMatchObject({
      position: { x: 100, y: 100 },
      isLocked: true
    });
  });

  it("uses a larger release boundary and sustained movement to escape", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 100, y: 100 }, 160);

    expect(restLock.process({ x: 108, y: 100 }, 220)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 115, y: 100 }, 260)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 130, y: 100 }, 280)).toMatchObject({
      position: { x: 130, y: 100 },
      isLocked: false,
      released: true
    });
  });

  it("does not release for an isolated outlier", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 100, y: 100 }, 160);

    expect(restLock.process({ x: 124, y: 100 }, 200)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 101, y: 100 }, 220)).toMatchObject({
      position: { x: 100, y: 100 },
      isLocked: true,
      released: false
    });
  });

  it("clears state when tracking resets", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 100, y: 100 }, 160);
    restLock.reset();

    expect(restLock.isLocked).toBe(false);
    expect(restLock.process({ x: 100, y: 100 }, 200)).toMatchObject({ isLocked: false });
  });
});
