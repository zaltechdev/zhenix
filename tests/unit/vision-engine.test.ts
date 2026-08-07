import { beforeEach, describe, expect, it, vi } from "vitest";

const mediaPipe = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  detectForVideo: vi.fn(),
  close: vi.fn(),
  forVisionTasks: vi.fn()
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.forVisionTasks },
  FaceLandmarker: { createFromOptions: mediaPipe.createFromOptions }
}));

import { VisionEngine } from "@/lib/client/vision/vision-engine";

function createStream() {
  let ended: (() => void) | null = null;
  const stop = vi.fn();
  const track = {
    stop,
    addEventListener: vi.fn((event: string, callback: () => void) => {
      if (event === "ended") ended = callback;
    }),
    removeEventListener: vi.fn()
  } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { end: () => ended?.(), stop, stream };
}

describe("VisionEngine lifecycle", () => {
  let scheduledFrame: FrameRequestCallback | null;
  const cancelAnimationFrame = vi.fn();

  beforeEach(() => {
    scheduledFrame = null;
    mediaPipe.createFromOptions.mockReset();
    mediaPipe.detectForVideo.mockReset();
    mediaPipe.close.mockReset();
    mediaPipe.forVisionTasks.mockReset().mockResolvedValue({});
    mediaPipe.createFromOptions.mockResolvedValue({
      detectForVideo: mediaPipe.detectForVideo,
      close: mediaPipe.close
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 17;
    }));
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
  });

  it("reports model initialization failure without raw exception text", async () => {
    mediaPipe.createFromOptions.mockRejectedValue(new Error("private provider detail"));
    const onStateChange = vi.fn();
    const engine = new VisionEngine({ onStateChange });

    await expect(engine.initialize()).resolves.toBe(false);

    expect(engine.getState()).toBe("error");
    expect(onStateChange).toHaveBeenLastCalledWith("error", "model_load_failed");
    expect(JSON.stringify(onStateChange.mock.calls)).not.toContain("private provider detail");
  });

  it("stops every track, clears video, and cancels inference when the stream ends", async () => {
    const { end, stop, stream } = createStream();
    const video = document.createElement("video");
    const onStateChange = vi.fn();
    const engine = new VisionEngine({ onStateChange });
    expect(await engine.initialize()).toBe(true);

    video.srcObject = stream;
    engine.start(video, stream);
    end();

    expect(stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(engine.getState()).toBe("error");
    expect(onStateChange).toHaveBeenLastCalledWith("error", "stream_ended");
  });

  it("surfaces inference failure and releases the camera instead of swallowing it", async () => {
    const { stop, stream } = createStream();
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", { configurable: true, value: 2 });
    mediaPipe.detectForVideo.mockImplementation(() => {
      throw new Error("inference failed");
    });
    vi.spyOn(performance, "now").mockReturnValue(1_000);
    const onStateChange = vi.fn();
    const engine = new VisionEngine({ onStateChange });
    expect(await engine.initialize()).toBe(true);

    video.srcObject = stream;
    engine.start(video, stream);
    expect(scheduledFrame).not.toBeNull();
    scheduledFrame?.(1_000);

    expect(stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(engine.getState()).toBe("error");
    expect(onStateChange).toHaveBeenLastCalledWith("error", "model_load_failed");
  });
});
