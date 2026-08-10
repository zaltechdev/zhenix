"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import {
  accessibilityProfileSaveResultSchema,
  accessibilityProfileSchema,
  provisionalAccessibilityProfile,
  type AccessibilityProfile
} from "@/lib/contracts/auth";
import { setCachedProfile } from "@/lib/client/vision/profile-cache";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";
import { useHeadControl } from "@/lib/client/vision/head-control-context";
import { useOptionalAksaActions } from "@/components/workspace/aksa-action-context";
import {
  recognitionLocale,
  useVoiceControls,
  type VoiceMode
} from "@/components/workspace/voice-control-context";
import {
  createRecognition,
  finalTranscriptAlternativesFromEvent,
  isSpeechRecognitionSupported,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike
} from "@/lib/client/voice/speech-recognition";
import { matchAksaIntent } from "@/lib/voice/intent-router";

const PROFILE_AUTOSAVE_DELAY_MS = 450;
const HEAD_PRESET_STORAGE_PREFIX = "aksa-head-preset";

type HeadPreset = "auto" | "standard" | "low_light" | "custom";
type MicrophoneState = "ready" | "permission_needed" | "blocked" | "unavailable";
type VoiceTestState = "idle" | "listening" | "passed" | "no_command" | "failed";

const HEAD_PRESETS: Record<Exclude<HeadPreset, "custom">, Partial<AccessibilityProfile>> = {
  auto: {
    pointerSensitivity: 50,
    deadZone: 22,
    smoothing: 46,
    dwellDurationMs: 1300
  },
  standard: {
    pointerSensitivity: 50,
    deadZone: 20,
    smoothing: 40,
    dwellDurationMs: 1200
  },
  low_light: {
    pointerSensitivity: 56,
    deadZone: 32,
    smoothing: 60,
    dwellDurationMs: 1500
  }
};

function useProfileSettings(initialProfile: AccessibilityProfile | null) {
  const headControl = useHeadControl();
  const [profileOverride, setProfileOverride] = useState<AccessibilityProfile | null>(null);
  const profile =
    profileOverride ??
    (headControl.hasPendingAnonymousProfile
      ? headControl.profile
      : initialProfile ?? headControl.profile ?? provisionalAccessibilityProfile);
  const [saveFailed, setSaveFailed] = useState(false);
  const profileRef = useRef(profile);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      requestRef.current?.abort();
    };
  }, []);

  const persistLatest = useCallback(
    (nextProfile: AccessibilityProfile, generation: number) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      requestRef.current?.abort();

      timerRef.current = setTimeout(() => {
        const parsed = accessibilityProfileSchema.safeParse(nextProfile);
        if (!parsed.success) {
          if (mountedRef.current && generation === generationRef.current) setSaveFailed(true);
          return;
        }

        if (!headControl.userId) {
          if (mountedRef.current && generation === generationRef.current) setSaveFailed(false);
          return;
        }

        const controller = new AbortController();
        requestRef.current = controller;
        void fetch("/api/accessibility-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
          signal: controller.signal
        })
          .then(async (response) => {
            const payload: unknown = await response.json();
            const result = accessibilityProfileSaveResultSchema.safeParse(payload);
            if (!response.ok || !result.success || result.data.outcome !== "saved") {
              throw new Error("profile_save_failed");
            }
            if (generation !== generationRef.current) return;
            if (headControl.userId) await setCachedProfile(result.data.profile, headControl.userId);
            if (mountedRef.current) setSaveFailed(false);
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (mountedRef.current && generation === generationRef.current) setSaveFailed(true);
          });
      }, PROFILE_AUTOSAVE_DELAY_MS);
    },
    [headControl.userId]
  );

  const applyProfile = useCallback(
    (nextProfile: AccessibilityProfile) => {
      profileRef.current = nextProfile;
      setProfileOverride(nextProfile);
      headControl.updateProfile(nextProfile);
      setSaveFailed(false);
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      persistLatest(nextProfile, generation);
    },
    [headControl, persistLatest]
  );

  const update = useCallback(
    <TKey extends keyof AccessibilityProfile>(key: TKey, value: AccessibilityProfile[TKey]) => {
      applyProfile({ ...profileRef.current, [key]: value });
    },
    [applyProfile]
  );

  return { profile, profileRef, saveFailed, applyProfile, update };
}

function presetStorageKey(userId: string | null): string {
  return `${HEAD_PRESET_STORAGE_PREFIX}:${userId ?? "anonymous"}`;
}

function useHeadPreset(
  userId: string | null,
  sharedPreset: HeadPreset | undefined,
  updateSharedPreset: ((preset: HeadPreset) => void) | undefined
): [HeadPreset, (preset: HeadPreset) => void] {
  const [preset, setPresetState] = useState<HeadPreset>(() => {
    if (typeof window === "undefined") return "auto";
    try {
      const stored = window.localStorage.getItem(presetStorageKey(userId));
      return stored === "auto" || stored === "standard" || stored === "low_light" || stored === "custom"
        ? stored
        : "auto";
    } catch {
      return "auto";
    }
  });

  const setPreset = useCallback(
    (nextPreset: HeadPreset) => {
      setPresetState(nextPreset);
      updateSharedPreset?.(nextPreset);
      try {
        window.localStorage.setItem(presetStorageKey(userId), nextPreset);
      } catch {
        // Preset metadata is optional. The active profile still uses server autosave.
      }
    },
    [updateSharedPreset, userId]
  );

  return [sharedPreset ?? preset, setPreset];
}

function matchesPreset(profile: AccessibilityProfile, preset: Partial<AccessibilityProfile>): boolean {
  return Object.entries(preset).every(([key, value]) => profile[key as keyof AccessibilityProfile] === value);
}

function cameraStatusCopy(
  lifecycleState: ReturnType<typeof useHeadControl>["lifecycleState"],
  locale: Locale
): string {
  const options = { locale };
  switch (lifecycleState) {
    case "active":
      return m.controls_camera_ready({}, options);
    case "initializing":
      return m.controls_camera_starting({}, options);
    case "paused":
      return m.controls_camera_paused({}, options);
    case "tracking_lost":
      return m.controls_camera_lost({}, options);
    case "idle":
    case "disabled":
    case "error":
      return m.controls_camera_off({}, options);
  }
}

function SwitchField({
  checked,
  id,
  label,
  onChange
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="aksa-switch" htmlFor={id}>
      <input
        checked={checked}
        className="aksa-switch__input"
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="aksa-switch__track">
        <span className="aksa-switch__thumb" />
      </span>
      <span className="aksa-switch__label">{label}</span>
    </label>
  );
}

function RangeField({
  description,
  id,
  label,
  max,
  min = 0,
  onChange,
  step = 1,
  value
}: {
  description: string;
  id: string;
  label: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const descriptionId = `${id}-description`;
  return (
    <div className="aksa-field">
      <label className="aksa-label" htmlFor={id}>
        {label}
      </label>
      <div className="aksa-field--row">
        <input
          aria-describedby={descriptionId}
          className="aksa-range"
          id={id}
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="range"
          value={value}
        />
        <output className="aksa-output" htmlFor={id}>
          {value}
        </output>
      </div>
      <p className="aksa-field__description" id={descriptionId}>
        {description}
      </p>
    </div>
  );
}

export function AccessibilityPreferences({
  initialProfile,
  locale
}: {
  initialProfile: AccessibilityProfile | null;
  locale: Locale;
}) {
  const { profile, saveFailed, update } = useProfileSettings(initialProfile);
  const appPreferences = useOptionalAppPreferences();
  const options = { locale };

  return (
    <div className="aksa-controls">
      <SwitchField
        checked={appPreferences?.preferences.highContrast ?? false}
        id="high-contrast"
        label={m.accessibility_high_contrast({}, options)}
        onChange={(checked) => appPreferences?.updatePreferences({ highContrast: checked })}
      />
      <div className="aksa-field">
        <label className="aksa-label" htmlFor="a11y-text-size">
          {m.accessibility_text_size_label({}, options)}
        </label>
        <select
          className="aksa-select"
          id="a11y-text-size"
          onChange={(event) =>
            appPreferences?.updatePreferences({
              textSize: event.target.value as "default" | "large" | "extra_large"
            })
          }
          value={appPreferences?.preferences.textSize ?? "default"}
        >
          <option value="default">{m.accessibility_text_size_default({}, options)}</option>
          <option value="large">{m.accessibility_text_size_large({}, options)}</option>
          <option value="extra_large">{m.accessibility_text_size_extra_large({}, options)}</option>
        </select>
      </div>
      <SwitchField
        checked={appPreferences?.preferences.reducedMotion ?? profile.reducedMotion}
        id="reduced-motion"
        label={m.a11y_reduced_motion_label({}, options)}
        onChange={(checked) => {
          appPreferences?.updatePreferences({ reducedMotion: checked });
          update("reducedMotion", checked);
        }}
      />
      {saveFailed ? (
        <p className="aksa-controls__save-status" role="status">
          {m.a11y_profile_save_failed({}, options)}
        </p>
      ) : null}
    </div>
  );
}

export function HeadControlSettings({
  initialProfile,
  locale
}: {
  initialProfile: AccessibilityProfile | null;
  locale: Locale;
}) {
  const headControl = useHeadControl();
  const actions = useOptionalAksaActions();
  const appPreferences = useOptionalAppPreferences();
  const { profile, profileRef, saveFailed, applyProfile, update } = useProfileSettings(initialProfile);
  const [preset, setPreset] = useHeadPreset(
    headControl.userId,
    appPreferences?.preferences.headPreset,
    (nextPreset) => appPreferences?.updatePreferences({ headPreset: nextPreset })
  );
  const options = { locale };
  const isHeadOn = !["idle", "disabled", "error"].includes(headControl.lifecycleState);
  const usesDwell = profile.selectionMode === "dwell" || profile.selectionMode === "both";
  const usesGesture = profile.selectionMode === "gesture" || profile.selectionMode === "both";

  const selectPreset = useCallback(
    (nextPreset: HeadPreset) => {
      setPreset(nextPreset);
      if (nextPreset === "custom") return;
      applyProfile({ ...profileRef.current, ...HEAD_PRESETS[nextPreset] });
    },
    [applyProfile, profileRef, setPreset]
  );

  useEffect(() => {
    if (preset !== "auto") return;
    const unstable = headControl.lifecycleState === "tracking_lost";
    const nextPreset = unstable ? HEAD_PRESETS.low_light : HEAD_PRESETS.standard;
    const waitMs = unstable ? 1500 : 7000;
    const timer = setTimeout(() => {
      if (!matchesPreset(profileRef.current, nextPreset)) {
        applyProfile({ ...profileRef.current, ...nextPreset });
      }
    }, waitMs);
    return () => clearTimeout(timer);
  }, [applyProfile, headControl.lifecycleState, preset, profileRef]);

  const selectionModes: {
    value: AccessibilityProfile["selectionMode"];
    label: string;
    description: string;
  }[] = [
    {
      value: "dwell",
      label: m.onboarding_selection_dwell({}, options),
      description: m.controls_selection_dwell_description({}, options)
    },
    {
      value: "gesture",
      label: m.onboarding_selection_gesture({}, options),
      description: m.controls_selection_gesture_description({}, options)
    },
    {
      value: "both",
      label: m.onboarding_selection_both({}, options),
      description: m.controls_selection_both_description({}, options)
    },
    {
      value: "off",
      label: m.onboarding_selection_off({}, options),
      description: m.controls_selection_off_description({}, options)
    }
  ];

  return (
    <div className="aksa-controls aksa-controls--dedicated">
      <div className="aksa-controls__status-row">
        <SwitchField
          checked={isHeadOn}
          id="head-control-enabled"
          label={
            isHeadOn
              ? m.controls_head_enabled({}, options)
              : m.controls_head_disabled({}, options)
          }
          onChange={(checked) => {
            appPreferences?.updatePreferences({ headControlEnabled: checked });
            if (checked) {
              void headControl.startHeadControl();
            } else {
              headControl.disableControl();
            }
          }}
        />
        <p className="aksa-inline-note">
          <strong>{m.controls_camera_status({}, options)}:</strong> {cameraStatusCopy(headControl.lifecycleState, locale)}
        </p>
      </div>

      <div className="aksa-controls__actions">
        <button
          className="aksa-button aksa-button--secondary"
          onClick={() => actions?.executeAksaIntent("HEAD_CALIBRATE")}
          type="button"
        >
          {m.controls_calibrate({}, options)}
        </button>
      </div>

      <section aria-labelledby="head-preset-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="head-preset-heading">
          {m.controls_preset_label({}, options)}
        </h3>
        <div className="aksa-choice-grid" role="radiogroup">
          {(["auto", "standard", "low_light", "custom"] as const).map((option) => {
            const label =
              option === "auto"
                ? m.controls_preset_auto({}, options)
                : option === "standard"
                  ? m.controls_preset_standard({}, options)
                  : option === "low_light"
                    ? m.controls_preset_low_light({}, options)
                    : m.controls_preset_custom({}, options);
            const description =
              option === "auto"
                ? m.controls_preset_auto_description({}, options)
                : option === "standard"
                  ? m.controls_preset_standard_description({}, options)
                  : option === "low_light"
                    ? m.controls_preset_low_light_description({}, options)
                    : m.controls_preset_custom_description({}, options);
            return (
              <label className="aksa-choice" key={option}>
                <input
                  checked={preset === option}
                  name="head-preset"
                  onChange={() => selectPreset(option)}
                  type="radio"
                  value={option}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {preset === "custom" ? (
        <section aria-labelledby="head-manual-heading" className="aksa-controls__group">
          <h3 className="aksa-controls__group-title" id="head-manual-heading">
            {m.controls_manual_heading({}, options)}
          </h3>
          <p className="aksa-hint">{m.controls_manual_intro({}, options)}</p>
          <div className="aksa-controls__grid">
            <RangeField
              description={m.controls_pointer_reach_description({}, options)}
              id="pointer-sensitivity"
              label={m.onboarding_sensitivity_label({}, options)}
              max={100}
              onChange={(value) => update("pointerSensitivity", value)}
              value={profile.pointerSensitivity}
            />
            <RangeField
              description={m.controls_ignore_motion_description({}, options)}
              id="dead-zone"
              label={m.onboarding_dead_zone_label({}, options)}
              max={100}
              onChange={(value) => update("deadZone", value)}
              value={profile.deadZone}
            />
            <RangeField
              description={m.controls_steadiness_description({}, options)}
              id="smoothing"
              label={m.onboarding_smoothing_label({}, options)}
              max={100}
              onChange={(value) => update("smoothing", value)}
              value={profile.smoothing}
            />
            {usesDwell ? (
              <RangeField
                description={m.controls_hold_time_description({}, options)}
                id="dwell-duration"
                label={m.onboarding_dwell_duration_label({}, options)}
                max={5000}
                min={300}
                onChange={(value) => update("dwellDurationMs", value)}
                step={100}
                value={profile.dwellDurationMs ?? 1200}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="head-reacquisition-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="head-reacquisition-heading">
          {m.controls_reacquisition_heading({}, options)}
        </h3>
        <p className="aksa-hint">{m.controls_reacquisition_helper({}, options)}</p>
        <div
          aria-labelledby="head-reacquisition-heading"
          className="aksa-choice-grid"
          role="radiogroup"
        >
          <label className="aksa-choice">
            <input
              checked={profile.reacquisitionPointerBehavior === "keep_position"}
              name="reacquisition-pointer-behavior"
              onChange={() => update("reacquisitionPointerBehavior", "keep_position")}
              type="radio"
              value="keep_position"
            />
            <span>
              <strong>{m.controls_reacquisition_keep({}, options)}</strong>
            </span>
          </label>
          <label className="aksa-choice">
            <input
              checked={profile.reacquisitionPointerBehavior === "reset_center"}
              name="reacquisition-pointer-behavior"
              onChange={() => update("reacquisitionPointerBehavior", "reset_center")}
              type="radio"
              value="reset_center"
            />
            <span>
              <strong>{m.controls_reacquisition_center({}, options)}</strong>
            </span>
          </label>
        </div>
      </section>

      <section aria-labelledby="head-selection-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="head-selection-heading">
          {m.controls_selection_heading({}, options)}
        </h3>
        <p className="aksa-hint">{m.controls_selection_intro({}, options)}</p>
        <div className="aksa-choice-grid" role="radiogroup">
          {selectionModes.map((mode) => (
            <label className="aksa-choice" key={mode.value}>
              <input
                checked={profile.selectionMode === mode.value}
                name="selection-mode"
                onChange={() => update("selectionMode", mode.value)}
                type="radio"
                value={mode.value}
              />
              <span>
                <strong>{mode.label}</strong>
                <small>{mode.description}</small>
              </span>
            </label>
          ))}
        </div>
        {usesGesture ? (
          <div className="aksa-controls__grid">
            <div className="aksa-field">
              <label className="aksa-label" htmlFor="gesture-type">
                {m.onboarding_gesture_type_label({}, options)}
              </label>
              <select
                className="aksa-select"
                id="gesture-type"
                onChange={(event) =>
                  update("gestureType", event.target.value as AccessibilityProfile["gestureType"])
                }
                value={profile.gestureType ?? "mouth_open"}
              >
                <option value="mouth_open">{m.onboarding_gesture_mouth_open({}, options)}</option>
                <option value="brow_raise">{m.onboarding_gesture_brow_raise({}, options)}</option>
                <option value="eye_blink_long">{m.onboarding_gesture_eye_blink_long({}, options)}</option>
                <option value="smile">{m.onboarding_gesture_smile({}, options)}</option>
              </select>
            </div>
            <RangeField
              description={m.onboarding_selection_gesture_note({}, options)}
              id="gesture-threshold"
              label={m.onboarding_gesture_threshold_label({}, options)}
              max={100}
              onChange={(value) => update("gestureThreshold", value)}
              value={profile.gestureThreshold ?? 50}
            />
          </div>
        ) : null}
      </section>

      <div className="aksa-controls__footer-row">
        <button
          className="aksa-button aksa-button--quiet"
          onClick={() => {
            setPreset("auto");
            applyProfile(provisionalAccessibilityProfile);
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="aksa-icon" />
          <span>{m.onboarding_reset_defaults({}, options)}</span>
        </button>
        {saveFailed ? (
          <p className="aksa-controls__save-status" role="status">
            {m.a11y_profile_save_failed({}, options)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function microphoneCopy(state: MicrophoneState, locale: Locale): string {
  const options = { locale };
  switch (state) {
    case "ready":
      return m.controls_microphone_ready({}, options);
    case "permission_needed":
      return m.controls_microphone_permission_needed({}, options);
    case "blocked":
      return m.controls_microphone_blocked({}, options);
    case "unavailable":
      return m.controls_microphone_unavailable({}, options);
  }
}

function VoiceModeChoice({
  checked,
  description,
  label,
  onChange,
  value
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: VoiceMode) => void;
  value: VoiceMode;
}) {
  return (
    <label className="aksa-choice">
      <input
        checked={checked}
        name="voice-mode"
        onChange={() => onChange(value)}
        type="radio"
        value={value}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

export function VoiceControlSettings({ locale }: { locale: Locale }) {
  const { settings, updateSettings, saveFailed } = useVoiceControls();
  const [microphone, setMicrophone] = useState<MicrophoneState>(() =>
    isSpeechRecognitionSupported() ? "permission_needed" : "unavailable"
  );
  const [testState, setTestState] = useState<VoiceTestState>("idle");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const options = { locale };

  useEffect(() => {
    if (!isSpeechRecognitionSupported() || !navigator.permissions?.query) return;

    let active = true;
    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((permission) => {
        if (!active) return;
        setMicrophone(
          permission.state === "granted"
            ? "ready"
            : permission.state === "denied"
              ? "blocked"
              : "permission_needed"
        );
      })
      .catch(() => {
        if (active) setMicrophone("permission_needed");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const startVoiceTest = useCallback(() => {
    if (recognitionRef.current) return;
    const commandLocale = recognitionLocale(settings, locale);
    const recognition = createRecognition(commandLocale);
    if (!recognition) {
      setMicrophone("unavailable");
      setTestState("failed");
      return;
    }

    setTestState("listening");
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const candidates = finalTranscriptAlternativesFromEvent(event);
      if (candidates.length === 0) return;
      const matchesCommand = candidates.some(
        (candidate) => matchAksaIntent(candidate, commandLocale) !== null
      );
      setTestState(matchesCommand ? "passed" : "no_command");
      recognition.stop();
    };
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicrophone("blocked");
      }
      setTestState("failed");
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setTestState("failed");
    }
  }, [locale, settings]);

  const testMessage =
    testState === "listening"
      ? m.controls_voice_test_listening({}, options)
      : testState === "passed"
        ? m.controls_voice_test_passed({}, options)
        : testState === "no_command"
          ? m.controls_voice_test_no_command({}, options)
          : testState === "failed"
            ? m.controls_voice_test_failed({}, options)
            : null;

  return (
    <div className="aksa-controls aksa-controls--dedicated">
      <SwitchField
        checked={settings.enabled}
        id="voice-control-enabled"
        label={
          settings.enabled
            ? m.controls_voice_enabled({}, options)
            : m.controls_voice_disabled({}, options)
        }
        onChange={(enabled) => updateSettings({ enabled })}
      />

      <section aria-labelledby="voice-language-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="voice-language-heading">
          {m.controls_voice_language({}, options)}
        </h3>
        <label className="aksa-label" htmlFor="voice-language">
          {m.controls_voice_language({}, options)}
        </label>
        <select
          className="aksa-select"
          id="voice-language"
          onChange={(event) =>
            updateSettings({ language: event.target.value as "follow" | "id" | "en" })
          }
          value={settings.language}
        >
          <option value="follow">{m.controls_voice_language_follow({}, options)}</option>
          <option value="id">{m.controls_voice_language_id({}, options)}</option>
          <option value="en">{m.controls_voice_language_en({}, options)}</option>
        </select>
      </section>

      <section aria-labelledby="voice-mode-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="voice-mode-heading">
          {m.controls_voice_mode({}, options)}
        </h3>
        <div className="aksa-choice-grid" role="radiogroup">
          <VoiceModeChoice
            checked={settings.mode === "dictation"}
            description={m.controls_voice_mode_dictation_description({}, options)}
            label={m.controls_voice_mode_dictation({}, options)}
            onChange={(mode) => updateSettings({ mode })}
            value="dictation"
          />
          <VoiceModeChoice
            checked={settings.mode === "commands"}
            description={m.controls_voice_mode_commands_description({}, options)}
            label={m.controls_voice_mode_commands({}, options)}
            onChange={(mode) => updateSettings({ mode })}
            value="commands"
          />
          <VoiceModeChoice
            checked={settings.mode === "both"}
            description={m.controls_voice_mode_both_description({}, options)}
            label={m.controls_voice_mode_both({}, options)}
            onChange={(mode) => updateSettings({ mode })}
            value="both"
          />
        </div>
      </section>

      <section aria-labelledby="microphone-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="microphone-heading">
          {m.controls_microphone_heading({}, options)}
        </h3>
        <p className="aksa-inline-note">{microphoneCopy(microphone, locale)}</p>
        <button
          className="aksa-button aksa-button--secondary"
          disabled={testState === "listening" || microphone === "unavailable"}
          onClick={startVoiceTest}
          type="button"
        >
          {m.controls_test_voice({}, options)}
        </button>
        {testMessage ? <p className="aksa-hint" role="status">{testMessage}</p> : null}
      </section>

      {saveFailed ? (
        <p className="aksa-controls__save-status" role="status">
          {m.controls_save_failed({}, options)}
        </p>
      ) : null}
    </div>
  );
}
