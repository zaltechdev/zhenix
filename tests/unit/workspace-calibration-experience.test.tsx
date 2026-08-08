import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import {
  HeadControlProvider,
  useHeadControl,
  type HeadControlEngineFactory
} from "@/lib/client/vision/head-control-context";
import type { VisionEngineCallbacks, VisionFrameData } from "@/lib/client/vision/vision-engine";
import { WorkspaceCalibrationExperience } from "@/components/workspace/calibration-experience";

function createStream() {
  const track = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    stop: vi.fn()
  } as unknown as MediaStreamTrack;
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    track
  };
}

function createEngine() {
  let callbacks: VisionEngineCallbacks | null = null;
  const factory = vi.fn<HeadControlEngineFactory>((nextCallbacks) => {
    callbacks = nextCallbacks;
    return {
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn(() => callbacks?.onStateChange?.("active", null)),
      pause: vi.fn(),
      resume: vi.fn(() => callbacks?.onStateChange?.("active", null)),
      disable: vi.fn(),
      setNeutralBaseline: vi.fn()
    };
  });

  return {
    factory,
    emit(frame: VisionFrameData) {
      callbacks?.onFrame?.(frame);
    }
  };
}

function frame(timestampMs: number): VisionFrameData {
  return {
    lifecycleState: "active",
    faceDetected: true,
    pose: { yaw: 2, pitch: 3, roll: 0 },
    poseDelta: { yaw: 2, pitch: 3, roll: 0 },
    blendshapes: [],
    timestampMs,
    failureCategory: null
  };
}

function RuntimeHarness({
  stream,
  onClose
}: {
  stream: MediaStream;
  onClose: () => void;
}) {
  const headControl = useHeadControl();
  const startedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void headControl.startCamera(videoRef.current, stream).then(setReady);
  }, [headControl, stream]);

  return ready ? <WorkspaceCalibrationExperience locale="en" onClose={onClose} /> : null;
}

describe("workspace calibration experience", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reuses the active stream and engine without reacquiring the camera", async () => {
    const engine = createEngine();
    const { stream } = createStream();
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    const onClose = vi.fn();

    render(
      <HeadControlProvider engineFactory={engine.factory} userId="test-user">
        <RuntimeHarness onClose={onClose} stream={stream} />
      </HeadControlProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    act(() => {
      for (let index = 1; index <= 6; index += 1) {
        engine.emit(frame(index * 100));
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(engine.factory).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(m.onboarding_camera_preview_label({}, { locale: "en" }))).toHaveProperty(
      "srcObject",
      stream
    );

    const poses = [
      { yaw: 2, pitch: 3, roll: 0 },
      { yaw: 6, pitch: 3, roll: 0 },
      { yaw: -8, pitch: 3, roll: 0 },
      { yaw: 2, pitch: 9, roll: 0 },
      { yaw: 2, pitch: -3, roll: 0 },
      { yaw: 2, pitch: 3, roll: 0 }
    ];
    let timestamp = 700;
    act(() => {
      for (const pose of poses) {
        for (let index = 0; index < 12; index += 1) {
          engine.emit({ ...frame(timestamp++), pose, poseDelta: pose });
        }
      }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: m.onboarding_calibration_done({}, { locale: "en" }) })
      ).toBeInTheDocument();
    });
    expect(engine.factory).toHaveBeenCalledOnce();

    act(() => {
      screen
        .getByRole("button", { name: m.onboarding_calibration_done({}, { locale: "en" }) })
        .click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
