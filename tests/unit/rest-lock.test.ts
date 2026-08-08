import { describe, expect, it } from "vitest";
import { RestLockController } from "@/lib/client/vision/rest-lock";

describe("RestLockController", () => {
  function createRestLock() {
    return new RestLockController({
      stabilityEnvelopePx: 3,
      acquisitionDelayMs: 150,
      restEnterMotionDegrees: 0.3,
      restExitMotionDegrees: 0.8,
      releaseDistancePx: 12,
      releaseVelocityPxPerMs: 0.45,
      sustainedEscapeFrames: 3,
      minimumEscapeStepPx: 2
    });
  }

  it("acquires after a stable envelope and freezes stationary pointer jitter", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 102, y: 101 }, 90);
    const acquired = restLock.process({ x: 101, y: 102 }, 160);

    expect(acquired).toMatchObject({ state: "RESTING", isLocked: true });
    expect(restLock.process({ x: 102, y: 99 }, 240)).toMatchObject({
      position: acquired.position,
      isLocked: true
    });
  });

  it("uses a larger release boundary and sustained movement to escape", () => {
    const restLock = createRestLock();
    restLock.process({ x: 100, y: 100 }, 0);
    restLock.process({ x: 100, y: 100 }, 160);

    expect(restLock.process({ x: 108, y: 100 }, 220)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 115, y: 100 }, 260)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 130, y: 100 }, 280)).toMatchObject({ isLocked: true });
    expect(restLock.process({ x: 145, y: 100 }, 300)).toMatchObject({
      position: { x: 145, y: 100 },
      state: "MOVING",
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

  it("uses physical-motion hysteresis so mapped noise cannot accumulate", () => {
    const restLock = createRestLock();

    expect(restLock.process({ x: 100, y: 100 }, 0, 0.1).state).toBe("REST_CANDIDATE");
    expect(restLock.process({ x: 108, y: 94 }, 160, 0.2)).toMatchObject({
      state: "RESTING",
      isLocked: true
    });
    const frozen = restLock.process({ x: 130, y: 70 }, 200, 0.2);
    expect(frozen).toMatchObject({ state: "RESTING", isLocked: true });

    restLock.process({ x: 145, y: 70 }, 216, 1.1);
    restLock.process({ x: 160, y: 70 }, 232, 1.0);
    expect(restLock.process({ x: 175, y: 70 }, 248, 0.9)).toMatchObject({
      state: "MOVING",
      released: true
    });
  });
});
