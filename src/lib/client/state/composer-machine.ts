import { COMMAND_TEXT_MAX_LENGTH, type CommandResult, type CommandSource, type CommandUnderstanding } from "@/lib/contracts/command";
import type { AksaError } from "@/lib/contracts/errors";
import type { CancellationResult, Task, TaskState } from "@/lib/contracts/task";
import type { AksaIntent } from "@/lib/contracts/voice-intent";

/**
 * Composer state machine.
 *
 * Pure so the honesty rules are testable: nothing in here can produce a task, a
 * completed state, or an Undo affordance that the server did not return.
 */

export type VoiceStatus = "unknown" | "supported" | "unsupported" | "denied" | "failed";

export type ComposerStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "submitting"
  | "unavailable"
  | "rejected"
  | "tracking"
  | "cancel_requested"
  | "cancel_reported";

export type ComposerAnnouncement =
  | { kind: "task_state"; state: TaskState }
  | { kind: "command_unavailable" }
  | { kind: "intent_result"; outcome: "executed" | "unknown" }
  | { kind: "cancellation"; outcome: CancellationResult["outcome"] }
  | null;

export type LocalIntentResult =
  | { outcome: "executed"; intent: AksaIntent; source: "deterministic" | "semantic" }
  | { outcome: "unknown"; source: "unknown" };

export type ComposerState = {
  status: ComposerStatus;
  /** The text that will be submitted. Always editable. */
  text: string;
  /** The raw recognized words, kept so a recoverable failure does not lose them. */
  transcript: string | null;
  source: CommandSource;
  understanding: CommandUnderstanding | null;
  error: AksaError | null;
  /** Only ever set from a server-returned task. */
  task: Task | null;
  /** A local allowlisted command result, never a server task. */
  localIntent: LocalIntentResult | null;
  cancellationOutcome: CancellationResult["outcome"] | null;
  voice: VoiceStatus;
  announcement: ComposerAnnouncement;
};

export const initialComposerState: ComposerState = {
  status: "idle",
  text: "",
  transcript: null,
  source: "text",
  understanding: null,
  error: null,
  task: null,
  localIntent: null,
  cancellationOutcome: null,
  voice: "unknown",
  announcement: null
};

export type ComposerAction =
  | { type: "set_text"; text: string }
  | { type: "insert_example"; text: string }
  | { type: "clear" }
  | { type: "voice_capability"; supported: boolean }
  | { type: "listening_started" }
  | { type: "transcript_updated"; transcript: string }
  | { type: "listening_stopped" }
  | { type: "voice_denied" }
  | { type: "voice_failed" }
  | { type: "submit_started" }
  | { type: "local_intent_result"; intent: AksaIntent; source: "deterministic" | "semantic" }
  | { type: "local_intent_unknown" }
  | { type: "submit_result"; result: CommandResult }
  | { type: "dismiss_result" }
  | { type: "cancel_requested" }
  | { type: "cancel_result"; result: CancellationResult };

function trim(text: string): string {
  return text.slice(0, COMMAND_TEXT_MAX_LENGTH);
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "set_text":
      return {
        ...state,
        text: trim(action.text),
        localIntent: null,
        status: state.status === "idle" ? "idle" : state.status
      };

    case "insert_example":
      /** An example fills the box only. It never submits and never runs. */
      return {
        ...initialComposerState,
        voice: state.voice,
        text: trim(action.text),
        source: "text"
      };

    case "clear":
      return { ...initialComposerState, voice: state.voice };

    case "voice_capability":
      return { ...state, voice: action.supported ? "supported" : "unsupported" };

    case "listening_started":
      return {
        ...state,
        status: "listening",
        source: "voice",
        transcript: null,
        error: null,
        understanding: null,
        localIntent: null,
        announcement: { kind: "task_state", state: "listening" }
      };

    case "transcript_updated":
      return {
        ...state,
        status: "transcribing",
        source: "voice",
        transcript: trim(action.transcript),
        text: trim(action.transcript),
        localIntent: null,
        announcement: { kind: "task_state", state: "transcribing" }
      };

    case "listening_stopped":
      return {
        ...state,
        status: "idle",
        announcement: null
      };

    case "voice_denied":
      /** The words already captured survive, and typing stays available. */
      return { ...state, status: "idle", voice: "denied", announcement: null };

    case "voice_failed":
      return { ...state, status: "idle", voice: "failed", announcement: null };

    case "submit_started":
      return {
        ...state,
        status: "submitting",
        error: null,
        understanding: null,
        task: null,
        localIntent: null,
        cancellationOutcome: null,
        announcement: { kind: "task_state", state: "understanding" }
      };

    case "local_intent_result":
      return {
        ...state,
        status: "idle",
        understanding: null,
        error: null,
        task: null,
        localIntent: {
          outcome: "executed",
          intent: action.intent,
          source: action.source
        },
        announcement: { kind: "intent_result", outcome: "executed" }
      };

    case "local_intent_unknown":
      return {
        ...state,
        status: "idle",
        understanding: null,
        error: null,
        task: null,
        localIntent: { outcome: "unknown", source: "unknown" },
        announcement: { kind: "intent_result", outcome: "unknown" }
      };

    case "submit_result": {
      if (action.result.outcome === "accepted") {
        return {
          ...state,
          status: "tracking",
          task: action.result.task,
          understanding: null,
          error: action.result.task.error,
          announcement: { kind: "task_state", state: action.result.task.state }
        };
      }

      if (action.result.outcome === "unavailable") {
        /**
         * No task exists, so no task state is shown. The interface reports what
         * arrived and why it cannot run.
         */
        return {
          ...state,
          status: "unavailable",
          understanding: action.result.understanding,
          error: action.result.error,
          task: null,
          announcement: { kind: "command_unavailable" }
        };
      }

      return {
        ...state,
        status: "rejected",
        understanding: null,
        error: action.result.error,
        task: null,
        announcement: { kind: "command_unavailable" }
      };
    }

    case "dismiss_result":
      return {
        ...state,
        status: "idle",
        understanding: null,
        error: null,
        task: null,
        localIntent: null,
        cancellationOutcome: null,
        announcement: null
      };

    case "cancel_requested":
      return {
        ...state,
        status: "cancel_requested",
        cancellationOutcome: "requested",
        announcement: { kind: "cancellation", outcome: "requested" }
      };

    case "cancel_result": {
      const result = action.result;
      const announcement = { kind: "cancellation" as const, outcome: result.outcome };

      if (result.outcome === "unable_to_cancel") {
        return {
          ...state,
          status: "cancel_reported",
          cancellationOutcome: result.outcome,
          error: result.error,
          announcement
        };
      }

      if (result.outcome === "requested") {
        /** Requested is not accepted. The task keeps running until the server agrees. */
        return {
          ...state,
          status: "cancel_requested",
          cancellationOutcome: result.outcome,
          announcement
        };
      }

      return {
        ...state,
        status: "cancel_reported",
        task: result.task,
        cancellationOutcome: result.outcome,
        announcement
      };
    }
  }
}

/**
 * The task state the interface should display.
 *
 * Returns `idle` when no server task exists, because a command that could not run
 * created no task and must not borrow a task state.
 */
export function displayedTaskState(state: ComposerState): TaskState {
  if (state.task !== null) {
    return state.task.state;
  }

  switch (state.status) {
    case "listening":
      return "listening";
    case "transcribing":
      return "transcribing";
    case "submitting":
      return "understanding";
    default:
      return "idle";
  }
}

export function canSubmit(state: ComposerState): boolean {
  return state.text.trim().length > 0 && state.status !== "submitting";
}

export function isCancellable(state: ComposerState): boolean {
  return state.task !== null && state.task.cancellationAvailable;
}

/** A microphone control is offered only when the browser can honour it. */
export function shouldOfferVoiceControl(state: ComposerState): boolean {
  return state.voice === "supported" || state.voice === "failed";
}
