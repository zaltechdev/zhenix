import { describe, expect, it } from "vitest";
import {
  canSubmit,
  composerReducer,
  displayedTaskState,
  initialComposerState,
  isCancellable,
  shouldOfferVoiceControl,
  type ComposerState
} from "@/lib/client/state/composer-machine";
import { createAksaError } from "@/lib/contracts/errors";
import type { CommandResult } from "@/lib/contracts/command";
import type { CancellationResult, Task } from "@/lib/contracts/task";

function reduce(actions: Parameters<typeof composerReducer>[1][]): ComposerState {
  return actions.reduce(composerReducer, initialComposerState);
}

const understanding = {
  commandId: "command-12345678",
  receivedText: "Find the files for this project",
  source: "text" as const,
  locale: "en" as const,
  receivedAt: 1,
  intentResolved: false as const
};

const runningTask: Task = {
  id: "task-1",
  title: "Move 12 files",
  intentCategory: "organize_files",
  state: "executing",
  createdAt: 1,
  updatedAt: 2,
  affectedItems: [],
  artifactIds: [],
  confirmationId: null,
  undoId: null,
  cancellationAvailable: true,
  itemsTotal: 12,
  itemsCompleted: 2,
  resultSummaryKey: null,
  error: null
};

describe("composer input", () => {
  it("starts idle with nothing to submit", () => {
    expect(initialComposerState.status).toBe("idle");
    expect(canSubmit(initialComposerState)).toBe(false);
    expect(displayedTaskState(initialComposerState)).toBe("idle");
  });

  it("fills the box from an example without submitting or creating a task", () => {
    const state = reduce([{ type: "insert_example", text: "Summarize a document" }]);

    expect(state.text).toBe("Summarize a document");
    expect(state.status).toBe("idle");
    expect(state.task).toBeNull();
    expect(state.understanding).toBeNull();
    expect(canSubmit(state)).toBe(true);
  });

  it("keeps the recognized words editable and separate from the submitted text", () => {
    const state = reduce([
      { type: "listening_started" },
      { type: "transcript_updated", transcript: "open my ltest assignment" },
      { type: "set_text", text: "Open my latest assignment" }
    ]);

    expect(state.transcript).toBe("open my ltest assignment");
    expect(state.text).toBe("Open my latest assignment");
    expect(state.source).toBe("voice");
  });

  it("clears everything back to the starting point but keeps the voice probe", () => {
    const state = reduce([
      { type: "voice_capability", supported: true },
      { type: "insert_example", text: "Read a sheet range" },
      { type: "clear" }
    ]);

    expect(state.text).toBe("");
    expect(state.voice).toBe("supported");
  });
});

describe("voice states", () => {
  it("offers no microphone control before the probe answers", () => {
    expect(shouldOfferVoiceControl(initialComposerState)).toBe(false);
  });

  it("offers no microphone control when the browser cannot honour it", () => {
    const state = reduce([{ type: "voice_capability", supported: false }]);
    expect(state.voice).toBe("unsupported");
    expect(shouldOfferVoiceControl(state)).toBe(false);
  });

  it("keeps captured words after a refused microphone", () => {
    const state = reduce([
      { type: "voice_capability", supported: true },
      { type: "listening_started" },
      { type: "transcript_updated", transcript: "find the files" },
      { type: "voice_denied" }
    ]);

    expect(state.voice).toBe("denied");
    expect(state.text).toBe("find the files");
    expect(state.status).toBe("idle");
    expect(shouldOfferVoiceControl(state)).toBe(false);
  });

  it("keeps captured words after a recognition failure and still offers retry", () => {
    const state = reduce([
      { type: "voice_capability", supported: true },
      { type: "transcript_updated", transcript: "read a sheet range" },
      { type: "voice_failed" }
    ]);

    expect(state.voice).toBe("failed");
    expect(state.text).toBe("read a sheet range");
    expect(shouldOfferVoiceControl(state)).toBe(true);
  });

  it("reports listening and transcribing as client-only input states", () => {
    expect(displayedTaskState(reduce([{ type: "listening_started" }]))).toBe("listening");
    expect(
      displayedTaskState(reduce([{ type: "transcript_updated", transcript: "hello" }]))
    ).toBe("transcribing");
  });
});

describe("submission honesty", () => {
  const nonAcceptedResults: CommandResult[] = [
    { outcome: "unavailable", understanding, error: createAksaError("not_configured") },
    { outcome: "unavailable", understanding, error: createAksaError("unavailable") },
    { outcome: "rejected", error: createAksaError("validation_failed") },
    { outcome: "rejected", error: createAksaError("internal_error") }
  ];

  it("never invents a task or a completed state from a non-accepted result", () => {
    for (const result of nonAcceptedResults) {
      const state = reduce([
        { type: "set_text", text: "Move my files" },
        { type: "submit_started" },
        { type: "submit_result", result }
      ]);

      expect(state.task).toBeNull();
      /** No task means no task state is borrowed. */
      expect(displayedTaskState(state)).toBe("idle");
      expect(isCancellable(state)).toBe(false);
      expect(state.error).not.toBeNull();
    }
  });

  it("echoes what arrived when execution is unavailable", () => {
    const state = reduce([
      { type: "set_text", text: "Find the files for this project" },
      { type: "submit_started" },
      {
        type: "submit_result",
        result: { outcome: "unavailable", understanding, error: createAksaError("not_configured") }
      }
    ]);

    expect(state.status).toBe("unavailable");
    expect(state.understanding?.receivedText).toBe("Find the files for this project");
    expect(state.understanding?.intentResolved).toBe(false);
    expect(state.announcement).toEqual({ kind: "command_unavailable" });
  });

  it("shows no understanding echo for a rejected submission", () => {
    const state = reduce([
      { type: "set_text", text: "x" },
      { type: "submit_started" },
      { type: "submit_result", result: { outcome: "rejected", error: createAksaError("validation_failed") } }
    ]);

    expect(state.status).toBe("rejected");
    expect(state.understanding).toBeNull();
  });

  it("tracks a real server task and offers cancel only when the server allows it", () => {
    const state = reduce([
      { type: "submit_started" },
      { type: "submit_result", result: { outcome: "accepted", task: runningTask } }
    ]);

    expect(state.status).toBe("tracking");
    expect(displayedTaskState(state)).toBe("executing");
    expect(isCancellable(state)).toBe(true);

    const notCancellable = composerReducer(state, {
      type: "submit_result",
      result: { outcome: "accepted", task: { ...runningTask, cancellationAvailable: false } }
    });
    expect(isCancellable(notCancellable)).toBe(false);
  });
});

describe("cancellation", () => {
  const tracking = reduce([
    { type: "submit_started" },
    { type: "submit_result", result: { outcome: "accepted", task: runningTask } }
  ]);

  it("treats a request as a request, not as a cancelled task", () => {
    const state = composerReducer(tracking, { type: "cancel_requested" });

    expect(state.cancellationOutcome).toBe("requested");
    /** The task keeps running until the server accepts the cancellation. */
    expect(displayedTaskState(state)).toBe("executing");
  });

  it("does not report a cancellation as accepted when the server only acknowledged it", () => {
    const result: CancellationResult = { outcome: "requested", taskId: "task-1" };
    const state = composerReducer(tracking, { type: "cancel_result", result });

    expect(state.status).toBe("cancel_requested");
    expect(displayedTaskState(state)).toBe("executing");
  });

  it("reports the cancelled task the server returned", () => {
    const result: CancellationResult = {
      outcome: "accepted",
      task: { ...runningTask, state: "cancelled", cancellationAvailable: false }
    };
    const state = composerReducer(tracking, { type: "cancel_result", result });

    expect(displayedTaskState(state)).toBe("cancelled");
    expect(state.cancellationOutcome).toBe("accepted");
  });

  it("reports partial cancellation with the task the server returned", () => {
    const result: CancellationResult = {
      outcome: "partial",
      task: { ...runningTask, state: "partially_completed", itemsCompleted: 2, itemsTotal: 12 },
      preservedProgress: {
        completedCount: 2,
        remainingCount: 10,
        completedItemNames: ["Week 1 report"],
        remainingItemNames: ["Week 3 report"]
      }
    };
    const state = composerReducer(tracking, { type: "cancel_result", result });

    expect(displayedTaskState(state)).toBe("partially_completed");
  });

  it("keeps the running task when cancellation is refused", () => {
    const result: CancellationResult = {
      outcome: "unable_to_cancel",
      error: createAksaError("not_found")
    };
    const state = composerReducer(tracking, { type: "cancel_result", result });

    expect(state.task).toEqual(runningTask);
    expect(state.error?.category).toBe("not_found");
  });
});
