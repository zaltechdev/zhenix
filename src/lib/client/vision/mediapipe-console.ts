const XNNPACK_INFORMATION = "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";

/**
 * MediaPipe emits one XNNPACK startup notice through stderr, which Chromium
 * reports as a console error. Preserve the notice at its real informational
 * level while forwarding every other error unchanged.
 */
export async function runWithMediaPipeConsoleRouting<T>(
  task: () => Promise<T>
): Promise<T> {
  const previousError = console.error;
  const routedError = (...args: unknown[]) => {
    if (args.length === 1 && args[0] === XNNPACK_INFORMATION) {
      console.info(...args);
      return;
    }
    previousError(...args);
  };

  console.error = routedError;
  try {
    return await task();
  } finally {
    if (console.error === routedError) {
      console.error = previousError;
    }
  }
}
