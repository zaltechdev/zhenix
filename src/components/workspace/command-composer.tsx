"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AudioLines, Eraser, Mic, MicOff, Send, Square, X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { CommandResult } from "@/lib/contracts/command";
import { createCommandId, commandResultSchema } from "@/lib/contracts/command";
import { confirmationOutcomeSchema, type ConfirmationDecision } from "@/lib/contracts/confirmation";
import { cancellationResultSchema } from "@/lib/contracts/task";
import { matchAksaIntent, resolveAksaIntent } from "@/lib/voice/intent-router";
import { createAksaError } from "@/lib/contracts/errors";
import { takePendingCommand } from "@/lib/client/state/pending-command";
import { displayedTaskState, isCancellable } from "@/lib/client/state/composer-machine";
import { errorCopy, taskStateCopy } from "@/lib/i18n/copy";
import { useCommandContext } from "@/components/workspace/command-context";
import { useOptionalAksaActions } from "@/components/workspace/aksa-action-context";
import { StatusChip } from "@/components/workspace/status-chip";
import { ConfirmationDialog } from "@/components/workspace/confirmation-dialog";
import {
  defaultVoiceControlSettings,
  recognitionLocale,
  useOptionalVoiceControls
} from "@/components/workspace/voice-control-context";
import {
  createRecognition,
  finalTranscriptAlternativesFromEvent,
  isSpeechRecognitionSupported,
  transcriptFromEvent,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike
} from "@/lib/client/voice/speech-recognition";

function announcementCopy(
  announcement: ReturnType<typeof useCommandContext>["state"]["announcement"],
  locale: Locale
): string {
  const options = { locale };
  if (announcement === null) {
    return "";
  }
  if (announcement.kind === "command_unavailable") {
    return m.composer_voice_unsupported({}, options);
  }
  if (announcement.kind === "intent_result") {
    return announcement.outcome === "executed"
      ? m.voice_command_executed({}, options)
      : m.voice_unknown_command({}, options);
  }
  if (announcement.kind === "cancellation") {
    return m.cancel_requested({}, options);
  }
  if (announcement.kind === "task_state") {
    return taskStateAnnouncement(announcement.state, locale) ?? "";
  }
  return "";
}

function taskStateAnnouncement(
  state: ReturnType<typeof displayedTaskState>,
  locale: Locale
): string | null {
  const options = { locale };
  switch (state) {
    case "executing":
      return m.announce_executing({}, options);
    case "waiting_for_confirmation":
      return m.confirmation_heading({}, options);
    case "completed":
      return m.announce_completed({}, options);
    case "partially_completed":
      return m.announce_partially_completed({}, options);
    case "failed":
      return m.announce_failed({}, options);
    case "idle":
    case "listening":
    case "transcribing":
    case "understanding":
    case "cancelled":
    case "undo_available":
      return null;
  }
}

function isAssertiveState(state: ReturnType<typeof displayedTaskState>): boolean {
  return state === "waiting_for_confirmation" || state === "failed";
}

function shouldOfferVoiceControl(state: ReturnType<typeof useCommandContext>["state"], enabled: boolean): boolean {
  return enabled && state.voice !== "unsupported";
}

function canSubmit(state: ReturnType<typeof useCommandContext>["state"]): boolean {
  return (
    state.text.trim().length > 0 &&
    state.status !== "submitting"
  );
}

/**
 * The persistent command composer with dual-mode support (Welcome mode inline vs Working mode sticky dock).
 */
export function CommandComposer({
  locale,
  inflow = false,
  mode = "welcome",
  onSubmit,
  preview = false,
  inputLabel
}: {
  locale: Locale;
  inflow?: boolean;
  mode?: "welcome" | "docked";
  onSubmit?: (text: string, transcript: string | null) => Promise<void>;
  preview?: boolean;
  inputLabel?: string;
}) {
  const { state, dispatch } = useCommandContext();
  const aksaActions = useOptionalAksaActions();
  const voiceControls = useOptionalVoiceControls();
  const voiceSettings = voiceControls?.settings ?? defaultVoiceControlSettings;
  const inputId = useId();
  const hintId = useId();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionModeRef = useRef<"dictation" | "command" | null>(null);
  const [recognitionMode, setRecognitionMode] = useState<"dictation" | "command" | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const processedVoiceResultsRef = useRef(new Set<string>());
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);
  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const liveCandidateRef = useRef<{ text: string; alternatives: string[] } | null>(null);
  const options = { locale };

  useEffect(() => {
    dispatch({ type: "voice_capability", supported: isSpeechRecognitionSupported() });

    const pending = takePendingCommand();
    if (pending !== null) {
      dispatch({ type: "insert_example", text: pending });
    }
  }, [dispatch]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!voiceSettings.enabled) recognitionRef.current?.abort();
  }, [voiceSettings.enabled]);

  const announcement = announcementCopy(state.announcement, locale);

  const submitCustom = useCallback(
    async (text: string, transcript: string | null) => {
      dispatch({ type: "submit_started" });
      try {
        if (!preview) {
          await onSubmit?.(text.trim(), transcript);
        }
      } finally {
        dispatch({ type: "submission_finished" });
      }
    },
    [dispatch, onSubmit, preview]
  );

  const submitCommandPayload = useCallback(
    async (rawText: string, transcript: string | null = null, source: "text" | "voice" = "text") => {
      const text = rawText.trim();
      if (!text) return;

      if (onSubmit || preview) {
        await submitCustom(text, transcript);
        return;
      }

      dispatch({ type: "submit_started" });

      const commandLocale = locale === "id" ? "id" : "en";
      const deterministicIntent = matchAksaIntent(text, commandLocale);
      if (aksaActions && deterministicIntent !== null) {
        aksaActions.executeAksaIntent(deterministicIntent);
        dispatch({
          type: "local_intent_result",
          intent: deterministicIntent,
          source: "deterministic"
        });
        return;
      }

      const searchMatch = text.match(/^(?:search(?:\s+the\s+web)?(?:\s+(?:for|about))?|cari(?:\s+di\s+web)?(?:\s+(?:tentang|info))?|gugling)\s+(.+)$/i);
      if (searchMatch?.[1]?.trim()) {
        const q = encodeURIComponent(searchMatch[1].trim());
        dispatch({ type: "clear" });
        router.push(`/workspace/search?q=${q}`);
        return;
      }

      if (pathname.startsWith("/workspace/search")) {
        const q = encodeURIComponent(text);
        dispatch({ type: "clear" });
        router.push(`/workspace/search?q=${q}`);
        return;
      }

      try {
        const contextDocumentId = state.result?.documentId ?? (typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("id"));
        const response = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commandId: createCommandId(),
            text,
            transcript: transcript ?? text,
            contextDocumentId,
            locale: locale === "id" ? "id" : "en",
            source,
            submittedAt: Date.now()
          })
        });

        const payload: unknown = await response.json();
        const parsed = commandResultSchema.safeParse(payload);
        const result: CommandResult = parsed.success
          ? parsed.data
          : { outcome: "rejected", error: createAksaError("internal_error") };

        dispatch({ type: "submit_result", result });
      } catch {
        dispatch({
          type: "submit_result",
          result: { outcome: "rejected", error: createAksaError("unavailable") }
        });
      }
    },
    [aksaActions, dispatch, locale, onSubmit, pathname, preview, router, state.result, submitCustom]
  );

  const executeVoiceIntent = useCallback(
    async (transcript: string, alternatives: readonly string[] = []) => {
      const commandLocale = recognitionLocale(voiceSettings, locale);
      for (const candidate of [transcript, ...alternatives]) {
        const deterministic = matchAksaIntent(candidate, commandLocale);
        if (deterministic !== null) {
          if (aksaActions) {
            aksaActions.executeAksaIntent(deterministic);
          }
          dispatch({
            type: "local_intent_result",
            intent: deterministic,
            source: "deterministic"
          });
          return;
        }
      }

      const resolution = await resolveAksaIntent({
        locale: commandLocale,
        transcript
      });
      if (resolution.intent !== "UNKNOWN" && aksaActions) {
        aksaActions.executeAksaIntent(resolution.intent);
        dispatch({
          type: "local_intent_result",
          intent: resolution.intent,
          source: resolution.source === "semantic" ? "semantic" : "deterministic"
        });
        return;
      }

      // Automatically execute as Agent Command if not a local UI intent
      await submitCommandPayload(transcript, transcript, "voice");
    },
    [aksaActions, dispatch, locale, submitCommandPayload, voiceSettings]
  );

  const startListeningRef = useRef<(mode: "dictation" | "command") => void>(() => {});

  const startListening = useCallback((mode: "dictation" | "command") => {
    if (recognitionRef.current !== null) return;

    const recognition = createRecognition(
      recognitionLocale(voiceSettings, locale),
      mode === "command"
    );
    if (recognition === null) {
      dispatch({ type: "voice_capability", supported: false });
      return;
    }

    recognitionModeRef.current = mode;
    setRecognitionMode(mode);
    processedVoiceResultsRef.current.clear();
    recognition.onstart = () => dispatch({ type: "listening_started" });
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = transcriptFromEvent(event);
      if (transcript !== "") {
        dispatch({ type: "transcript_updated", transcript });
        const finalCandidates = finalTranscriptAlternativesFromEvent(event);
        if (mode === "command" && finalCandidates.length > 0) {
          const resultKey = `${event.resultIndex}:${finalCandidates.join("\u0000")}`;
          if (processedVoiceResultsRef.current.has(resultKey)) return;
          processedVoiceResultsRef.current.add(resultKey);

          const commandLocale = recognitionLocale(voiceSettings, locale);
          const hasLocalIntent = finalCandidates.some(
            (c) => matchAksaIntent(c, commandLocale) !== null
          );

          if (hasLocalIntent) {
            if (onSubmit || preview) {
              void submitCustom(finalCandidates[0], finalCandidates[0]);
            } else {
              dispatch({ type: "submit_started" });
              void executeVoiceIntent(finalCandidates[0], finalCandidates.slice(1));
            }
            return;
          }

          liveCandidateRef.current = {
            text: finalCandidates[0],
            alternatives: finalCandidates.slice(1)
          };

          if (liveTimerRef.current) {
            clearInterval(liveTimerRef.current);
          }

          setLiveCountdown(3);
          let remaining = 3;
          liveTimerRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              if (liveTimerRef.current) {
                clearInterval(liveTimerRef.current);
                liveTimerRef.current = null;
              }
              setLiveCountdown(null);
              const candidate = liveCandidateRef.current;
              if (candidate) {
                if (onSubmit || preview) {
                  void submitCustom(candidate.text, candidate.text);
                } else {
                  dispatch({ type: "submit_started" });
                  void executeVoiceIntent(candidate.text, candidate.alternatives);
                }
              }
            } else {
              setLiveCountdown(remaining);
            }
          }, 1000);
        }
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
          recognitionModeRef.current = null;
          setRecognitionMode(null);
        }
        dispatch({ type: "voice_denied" });
        return;
      }
      if (event.error !== "no-speech") {
        dispatch({ type: "voice_failed" });
      }
    };
    recognition.onend = () => {
      if (recognitionModeRef.current === "command" && recognitionRef.current === recognition) {
        try {
          recognition.start();
          return;
        } catch {
          // Restart instance if browser invalidated
          recognitionRef.current = null;
          setTimeout(() => {
            if (recognitionModeRef.current === "command") {
              startListeningRef.current("command");
            }
          }, 100);
          return;
        }
      }
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      recognitionModeRef.current = null;
      setRecognitionMode(null);
      dispatch({ type: "listening_stopped" });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        recognitionModeRef.current = null;
        setRecognitionMode(null);
      }
      dispatch({ type: "voice_failed" });
    }
  }, [dispatch, executeVoiceIntent, locale, onSubmit, preview, submitCustom, voiceSettings]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveCountdown(null);
    recognitionRef.current?.stop();
  }, []);

  const decideConfirmation = useCallback(async (decision: ConfirmationDecision) => {
    if (!state.confirmation || confirmationPending) return;
    setConfirmationPending(true);
    try {
      const response = await fetch("/api/commands/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId: state.confirmation.id, decision })
      });
      const payload: unknown = await response.json();
      const result = confirmationOutcomeSchema.safeParse(payload);
      dispatch({
        type: "confirmation_result",
        result: result.success
          ? result.data
          : { outcome: "unavailable", error: createAksaError("unavailable") }
      });
    } catch {
      dispatch({
        type: "confirmation_result",
        result: { outcome: "unavailable", error: createAksaError("unavailable") }
      });
    } finally {
      setConfirmationPending(false);
    }
  }, [confirmationPending, dispatch, state.confirmation]);

  const cancelCurrentTask = useCallback(async () => {
    if (!state.task || !isCancellable(state) || state.status === "cancel_requested") return;
    dispatch({ type: "cancel_requested" });
    try {
      const response = await fetch("/api/commands/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: state.task.id })
      });
      const payload: unknown = await response.json();
      const result = cancellationResultSchema.safeParse(payload);
      dispatch({
        type: "cancel_result",
        result: result.success
          ? result.data
          : { outcome: "unable_to_cancel", error: createAksaError("unavailable") }
      });
    } catch {
      dispatch({
        type: "cancel_result",
        result: { outcome: "unable_to_cancel", error: createAksaError("unavailable") }
      });
    }
  }, [dispatch, state]);

  const submit = useCallback(async () => {
    if (!canSubmit(state)) {
      return;
    }
    await submitCommandPayload(state.text, state.transcript, state.source);
  }, [state, submitCommandPayload]);

  const taskState = displayedTaskState(state);
  const listening = recognitionMode !== null;
  const listeningMode = recognitionMode;
  const submitting = state.status === "submitting";
  const offerVoice = shouldOfferVoiceControl(state, voiceSettings.enabled);
  const hasContent =
    state.text !== "" ||
    state.understanding !== null ||
    state.error !== null ||
    state.result !== null ||
    state.localIntent !== null;
  const isNonIdle = taskState !== "idle";

  let placeholder = m.composer_placeholder({}, options);
  if (pathname.includes("/slides")) {
    placeholder = m.composer_placeholder_slides({}, options);
  } else if (pathname.includes("/documents")) {
    placeholder = m.composer_placeholder_docs({}, options);
  } else if (pathname.includes("/sheets")) {
    placeholder = m.composer_placeholder_sheets({}, options);
  } else if (pathname.includes("/files")) {
    placeholder = m.composer_placeholder_drive({}, options);
  } else if (pathname.includes("/mail")) {
    placeholder = m.composer_placeholder_mail({}, options);
  } else if (pathname.includes("/search")) {
    placeholder = m.composer_placeholder_search({}, options);
  }

  const isDocked = mode === "docked";
  const isWelcome = mode === "welcome" || inflow;

  const modeClass = isDocked
    ? " aksa-composer--docked"
    : isWelcome
      ? " aksa-composer--welcome aksa-composer--inflow"
      : "";

  return (
    <section
      aria-label={m.composer_region_label({}, options)}
      className={`aksa-composer${modeClass}`}
      id="command-composer"
    >
      <div
        aria-atomic="true"
        aria-live={isAssertiveState(taskState) ? "assertive" : "polite"}
        className="sr-only"
      >
        {announcement}
      </div>

      {isNonIdle ? (
        <div className="aksa-composer__status">
          <StatusChip
            label={m.task_state_label({}, options)}
            tone="pending"
            value={taskStateCopy(
              {
                state: taskState,
                title: state.task?.title,
                completed: state.task?.itemsCompleted ?? 0,
                remaining:
                  (state.task?.itemsTotal ?? 0) - (state.task?.itemsCompleted ?? 0)
              },
              locale
            )}
          />
        </div>
      ) : null}

      <div className="aksa-composer__field">
        {mode === "welcome" || inflow ? (
          <label className="sr-only" htmlFor={inputId}>
            {inputLabel ?? m.home_welcome_title({}, options)}
          </label>
        ) : (
          <label className="aksa-label" htmlFor={inputId}>
            {m.composer_input_label({}, options)}
          </label>
        )}
        <textarea
          aria-labelledby={mode === "welcome" || inflow ? (inputLabel ? undefined : "home-welcome-title") : undefined}
          aria-describedby={listening || !offerVoice ? hintId : undefined}
          className="aksa-textarea aksa-textarea--flat"
          id={inputId}
          onChange={(event) => dispatch({ type: "set_text", text: event.target.value })}
          placeholder={placeholder}
          rows={1}
          value={state.text}
        />
        {listening || !offerVoice ? (
          <p className="aksa-hint" id={hintId}>
            {offerVoice
              ? listening
                ? m.composer_voice_disclosure({}, options)
                : null
              : m.composer_voice_unsupported({}, options)}
          </p>
        ) : null}
      </div>

      <div className="aksa-composer__controls">
        {offerVoice ? (
          <>
            {voiceSettings.mode !== "commands" ? (
              <button
                aria-pressed={listeningMode === "dictation"}
                className="aksa-button aksa-button--secondary"
                disabled={listening && listeningMode !== "dictation"}
                onClick={() =>
                  listeningMode === "dictation" ? stopListening() : startListening("dictation")
                }
                type="button"
              >
                {listeningMode === "dictation" ? (
                  <Square aria-hidden="true" className="aksa-icon" />
                ) : (
                  <Mic aria-hidden="true" className="aksa-icon" />
                )}
                <span>
                  {listeningMode === "dictation"
                    ? m.composer_stop_dictation({}, options)
                    : m.composer_dictate_action({}, options)}
                </span>
              </button>
            ) : null}
            {voiceSettings.mode !== "dictation" ? (
              <button
                aria-pressed={listeningMode === "command"}
                className="aksa-button aksa-button--secondary"
                disabled={listening && listeningMode !== "command"}
                onClick={() =>
                  listeningMode === "command" ? stopListening() : startListening("command")
                }
                type="button"
              >
                {listeningMode === "command" ? (
                  <Square aria-hidden="true" className="aksa-icon" />
                ) : (
                  <AudioLines aria-hidden="true" className="aksa-icon" />
                )}
                <span>
                  {listeningMode === "command"
                    ? m.composer_stop_voice_commands({}, options)
                    : m.composer_live_voice_action({}, options)}
                </span>
              </button>
            ) : null}
          </>
        ) : null}

        {hasContent ? (
          <button
            aria-label={m.composer_clear({}, options)}
            className="aksa-button aksa-button--quiet aksa-composer__clear"
            onClick={() => dispatch({ type: "clear" })}
            title={m.composer_clear({}, options)}
            type="button"
          >
            <Eraser aria-hidden="true" className="aksa-icon" />
            <span className="sr-only">{m.composer_clear({}, options)}</span>
          </button>
        ) : null}

        {isCancellable(state) ? (
          <button
            aria-label={m.composer_cancel_task({}, options)}
            className="aksa-button aksa-button--quiet aksa-composer__cancel"
            onClick={() => void cancelCurrentTask()}
            title={m.composer_cancel_task({}, options)}
            type="button"
          >
            <X aria-hidden="true" className="aksa-icon" />
            <span className="sr-only">{m.composer_cancel_task({}, options)}</span>
          </button>
        ) : null}

        <button
          aria-label={submitting ? m.composer_working({}, options) : m.composer_submit({}, options)}
          className="aksa-button aksa-button--primary aksa-composer__submit"
          disabled={!canSubmit(state)}
          onClick={() => void submit()}
          title={submitting ? m.composer_working({}, options) : m.composer_submit({}, options)}
          type="button"
        >
          <Send aria-hidden="true" className="aksa-icon" />
          <span className="sr-only">
            {submitting ? m.composer_working({}, options) : m.composer_submit({}, options)}
          </span>
        </button>
      </div>

      <p className="aksa-composer__caption">
        {m.composer_ai_notice({}, options)}
      </p>

      {listening && listeningMode ? (
        <p aria-live="polite" className="aksa-composer__voice-state" role="status">
          {listeningMode === "dictation"
            ? m.composer_dictation_listening({}, options)
            : liveCountdown !== null
              ? `⚡ Auto-executing in ${liveCountdown}s...`
              : m.composer_live_voice_listening({}, options)}
        </p>
      ) : null}

      {state.understanding !== null ? (
        <div className="aksa-composer__understanding">
          <h3 className="aksa-heading-sm">
            {m.composer_understanding_heading({}, options)}
          </h3>
          <p className="aksa-received-text">{state.understanding.receivedText}</p>
          {state.error !== null ? (
            <p className="aksa-notice" role="alert">
              {errorCopy(state.error.category, locale)}
            </p>
          ) : null}
          <p className="aksa-hint">
            {m.composer_understanding_note({}, options)}
          </p>
        </div>
      ) : state.result !== null ? (
        <div className="aksa-composer__understanding">
          <p className="aksa-received-text">
            {state.result.text || m.documents_empty_content({}, options)}
          </p>
        </div>
      ) : state.error !== null ? (
        <p className="aksa-notice" role="alert">
          {errorCopy(state.error.category, locale)}
        </p>
      ) : state.localIntent !== null ? (
        <p className="aksa-notice" role="status">
          {state.localIntent.outcome === "executed"
            ? m.voice_command_executed({}, options)
            : m.voice_unknown_command({}, options)}
        </p>
      ) : null}

      {state.voice === "denied" && !preview ? (
        <p className="aksa-inline-note">
          <MicOff aria-hidden="true" className="aksa-icon aksa-icon--sm" />
          <span>{m.composer_voice_denied({}, options)}</span>
        </p>
      ) : null}

      {state.confirmation ? (
        <ConfirmationDialog
          confirmation={{
            ...state.confirmation,
            canApprove: !confirmationPending && (state.confirmation.canApprove ?? true),
            canCancel: !confirmationPending && (state.confirmation.canCancel ?? true),
            canEdit: !confirmationPending && (state.confirmation.canEdit ?? true)
          }}
          locale={locale}
          onClose={() => void decideConfirmation("cancel")}
          onDecision={(decision) => void decideConfirmation(decision)}
        />
      ) : null}
    </section>
  );
}
