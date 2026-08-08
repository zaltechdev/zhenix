"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AudioLines, Eraser, Mic, MicOff, Send, Square, X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { CommandResult } from "@/lib/contracts/command";
import { createCommandId, commandResultSchema } from "@/lib/contracts/command";
import { matchAksaIntent, resolveAksaIntent } from "@/lib/voice/intent-router";
import { createAksaError } from "@/lib/contracts/errors";
import { takePendingCommand } from "@/lib/client/state/pending-command";
import { displayedTaskState, isCancellable } from "@/lib/client/state/composer-machine";
import { errorCopy, taskStateCopy } from "@/lib/i18n/copy";
import { useCommandContext } from "@/components/workspace/command-context";
import { useOptionalAksaActions } from "@/components/workspace/aksa-action-context";
import { StatusChip } from "@/components/workspace/status-chip";
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
  mode = "welcome"
}: {
  locale: Locale;
  inflow?: boolean;
  mode?: "welcome" | "docked";
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
  const voiceSubmissionRef = useRef(false);
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

  const executeVoiceIntent = useCallback(
    async (transcript: string, alternatives: readonly string[] = []) => {
      if (!aksaActions) return;

      const commandLocale = recognitionLocale(voiceSettings, locale);
      for (const candidate of [transcript, ...alternatives]) {
        const deterministic = matchAksaIntent(candidate, commandLocale);
        if (deterministic !== null) {
          aksaActions.executeAksaIntent(deterministic);
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
      if (resolution.intent === "UNKNOWN") {
        dispatch({ type: "local_intent_unknown" });
        return;
      }

      aksaActions.executeAksaIntent(resolution.intent);
      dispatch({
        type: "local_intent_result",
        intent: resolution.intent,
        source: resolution.source === "semantic" ? "semantic" : "deterministic"
      });
    },
    [aksaActions, dispatch, locale, voiceSettings]
  );

  const startListening = useCallback((mode: "dictation" | "command") => {
    if (recognitionRef.current !== null) return;

    const recognition = createRecognition(recognitionLocale(voiceSettings, locale));
    if (recognition === null) {
      dispatch({ type: "voice_capability", supported: false });
      return;
    }

    recognitionModeRef.current = mode;
    setRecognitionMode(mode);
    voiceSubmissionRef.current = false;
    recognition.onstart = () => dispatch({ type: "listening_started" });
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = transcriptFromEvent(event);
      if (transcript !== "") {
        dispatch({ type: "transcript_updated", transcript });
        const finalCandidates = finalTranscriptAlternativesFromEvent(event);
        if (
          mode === "command" &&
          finalCandidates.length > 0 &&
          !voiceSubmissionRef.current &&
          aksaActions
        ) {
          voiceSubmissionRef.current = true;
          dispatch({ type: "submit_started" });
          void executeVoiceIntent(finalCandidates[0], finalCandidates.slice(1));
        }
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        recognitionModeRef.current = null;
        setRecognitionMode(null);
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        dispatch({ type: "voice_denied" });
        return;
      }
      dispatch({ type: "voice_failed" });
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      const submitted = voiceSubmissionRef.current;
      recognitionRef.current = null;
      recognitionModeRef.current = null;
      setRecognitionMode(null);
      if (!submitted) dispatch({ type: "listening_stopped" });
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
  }, [aksaActions, dispatch, executeVoiceIntent, locale, voiceSettings]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit(state)) {
      return;
    }

    dispatch({ type: "submit_started" });

    const commandLocale = locale === "id" ? "id" : "en";
    const deterministicIntent = matchAksaIntent(state.text, commandLocale);
    if (aksaActions && deterministicIntent !== null) {
      aksaActions.executeAksaIntent(deterministicIntent);
      dispatch({
        type: "local_intent_result",
        intent: deterministicIntent,
        source: "deterministic"
      });
      return;
    }

    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: createCommandId(),
          text: state.text.trim(),
          transcript: state.transcript,
          locale: locale === "id" ? "id" : "en",
          source: state.source,
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
  }, [aksaActions, dispatch, locale, state]);

  const taskState = displayedTaskState(state);
  const listening = state.status === "listening" || state.status === "transcribing";
  const listeningMode = recognitionMode;
  const submitting = state.status === "submitting";
  const offerVoice = shouldOfferVoiceControl(state, voiceSettings.enabled);
  const hasContent =
    state.text !== "" ||
    state.understanding !== null ||
    state.error !== null ||
    state.localIntent !== null;
  const isNonIdle = taskState !== "idle";

  const pathname = usePathname();
  let placeholder = m.composer_placeholder({}, options);
  if (pathname.includes("/documents")) {
    placeholder = (locale === "id" ? "Tanyakan tentang dokumen ini" : "Ask about this document") as typeof placeholder;
  } else if (pathname.includes("/sheets")) {
    placeholder = (locale === "id" ? "Tanyakan tentang lembar kerja ini" : "Ask about this spreadsheet") as typeof placeholder;
  } else if (pathname.includes("/files")) {
    placeholder = (locale === "id" ? "Cari file atau folder" : "Search files or folders") as typeof placeholder;
  } else if (pathname.includes("/mail")) {
    placeholder = (locale === "id" ? "Tanyakan tentang surel terbaru" : "Ask about recent mail") as typeof placeholder;
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
            {m.home_welcome_title({}, options)}
          </label>
        ) : (
          <label className="aksa-label" htmlFor={inputId}>
            {m.composer_input_label({}, options)}
          </label>
        )}
        <textarea
          aria-labelledby={mode === "welcome" || inflow ? "home-welcome-title" : undefined}
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
            {voiceSettings.mode !== "commands" ? <button
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
            </button> : null}
            {voiceSettings.mode !== "dictation" ? <button
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
            </button> : null}
          </>
        ) : null}

        {hasContent ? (
          <button
            className="aksa-button aksa-button--quiet"
            onClick={() => dispatch({ type: "clear" })}
            type="button"
          >
            <Eraser aria-hidden="true" className="aksa-icon" />
            <span>{m.composer_clear({}, options)}</span>
          </button>
        ) : null}

        {isCancellable(state) ? (
          <button
            className="aksa-button aksa-button--secondary"
            onClick={() => dispatch({ type: "cancel_requested" })}
            type="button"
          >
            <X aria-hidden="true" className="aksa-icon" />
            <span>{m.composer_cancel_task({}, options)}</span>
          </button>
        ) : null}

        <button
          className="aksa-button aksa-button--primary aksa-composer__submit"
          disabled={!canSubmit(state)}
          onClick={() => void submit()}
          type="button"
        >
          <Send aria-hidden="true" className="aksa-icon" />
          <span>{submitting ? m.composer_working({}, options) : m.composer_submit({}, options)}</span>
        </button>
      </div>

      {listening && listeningMode ? (
        <p aria-live="polite" className="aksa-composer__voice-state" role="status">
          {listeningMode === "dictation"
            ? m.composer_dictation_listening({}, options)
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

      {state.voice === "denied" ? (
        <p className="aksa-inline-note">
          <MicOff aria-hidden="true" className="aksa-icon aksa-icon--sm" />
          <span>{m.composer_voice_denied({}, options)}</span>
        </p>
      ) : null}
    </section>
  );
}
