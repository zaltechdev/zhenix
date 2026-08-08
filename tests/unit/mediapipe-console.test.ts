import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithMediaPipeConsoleRouting } from "@/lib/client/vision/mediapipe-console";

afterEach(() => vi.restoreAllMocks());

describe("MediaPipe console routing", () => {
  it("reports the XNNPACK startup notice as information", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runWithMediaPipeConsoleRouting(async () => {
      console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
    });

    expect(info).toHaveBeenCalledWith(
      "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("forwards unrelated errors and restores the original console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runWithMediaPipeConsoleRouting(async () => {
      console.error("real failure");
    });
    console.error("after routing");

    expect(error).toHaveBeenNthCalledWith(1, "real failure");
    expect(error).toHaveBeenNthCalledWith(2, "after routing");
  });
});
