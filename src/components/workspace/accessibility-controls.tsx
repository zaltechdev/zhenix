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
import { useHeadControl } from "@/lib/client/vision/head-control-context";

export const ACCESSIBILITY_PROFILE_AUTOSAVE_DELAY_MS = 450;

/**
 * The controlled form is the profile authority while this view is open. Every change
 * immediately reaches the runtime, then one debounced latest-wins request persists it.
 */
export function AccessibilityControls({
  locale,
  initialProfile
}: {
  locale: Locale;
  initialProfile: AccessibilityProfile | null;
}) {
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
  const options = { locale };

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const persistLatest = useCallback(
    (nextProfile: AccessibilityProfile, generation: number) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
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
            if (headControl.userId) {
              await setCachedProfile(result.data.profile, headControl.userId);
            }
            if (mountedRef.current) setSaveFailed(false);
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (mountedRef.current && generation === generationRef.current) setSaveFailed(true);
          });
      }, ACCESSIBILITY_PROFILE_AUTOSAVE_DELAY_MS);
    },
    [headControl.userId]
  );

  useEffect(() => {
    return () => {
      // Let a just-edited onboarding profile reach the server after navigation.
      mountedRef.current = false;
    };
  }, []);

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

  const usesDwell = profile.selectionMode === "dwell" || profile.selectionMode === "both";
  const usesGesture = profile.selectionMode === "gesture" || profile.selectionMode === "both";

  return (
    <div className="aksa-controls">
      <section aria-labelledby="pointer-feel-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="pointer-feel-heading">
          {m.a11y_pointer_heading({}, options)}
        </h3>
        <div className="aksa-controls__grid">
          <RangeField
            id="pointer-sensitivity"
            label={m.onboarding_sensitivity_label({}, options)}
            max={100}
            onChange={(value) => update("pointerSensitivity", value)}
            value={profile.pointerSensitivity}
          />
          <RangeField
            description={m.onboarding_dead_zone_helper({}, options)}
            id="dead-zone"
            label={m.onboarding_dead_zone_label({}, options)}
            max={100}
            onChange={(value) => update("deadZone", value)}
            value={profile.deadZone}
          />
          <RangeField
            id="smoothing"
            label={m.onboarding_smoothing_label({}, options)}
            max={100}
            onChange={(value) => update("smoothing", value)}
            value={profile.smoothing}
          />
          {usesDwell ? (
            <RangeField
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

      <section aria-labelledby="selection-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="selection-heading">
          {m.a11y_selection_heading({}, options)}
        </h3>
        <div className="aksa-controls__grid">
          <div className="aksa-field">
            <label className="aksa-label" htmlFor="selection-mode">
              {m.onboarding_selection_mode_label({}, options)}
            </label>
            <select
              className="aksa-select"
              id="selection-mode"
              onChange={(event) =>
                update("selectionMode", event.target.value as AccessibilityProfile["selectionMode"])
              }
              value={profile.selectionMode}
            >
              <option value="dwell">{m.onboarding_selection_dwell({}, options)}</option>
              <option value="gesture">{m.onboarding_selection_gesture({}, options)}</option>
              <option value="both">{m.onboarding_selection_both({}, options)}</option>
              <option value="off">{m.onboarding_selection_off({}, options)}</option>
            </select>
          </div>
          {usesGesture ? (
            <>
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
                id="gesture-threshold"
                label={m.onboarding_gesture_threshold_label({}, options)}
                max={100}
                onChange={(value) => update("gestureThreshold", value)}
                value={profile.gestureThreshold ?? 50}
              />
            </>
          ) : null}
        </div>
        {usesGesture ? (
          <p className="aksa-inline-note">{m.onboarding_selection_gesture_note({}, options)}</p>
        ) : null}
      </section>

      <section aria-labelledby="motion-heading" className="aksa-controls__group">
        <h3 className="aksa-controls__group-title" id="motion-heading">
          {m.a11y_motion_heading({}, options)}
        </h3>
        <div className="aksa-controls__option-row">
          <input
            checked={profile.reducedMotion}
            className="aksa-checkbox"
            id="reduced-motion"
            onChange={(event) => update("reducedMotion", event.target.checked)}
            type="checkbox"
          />
          <label className="aksa-label" htmlFor="reduced-motion">
            {m.a11y_reduced_motion_label({}, options)}
          </label>
        </div>
      </section>

      <div className="aksa-controls__footer-row">
        <button
          className="aksa-button aksa-button--quiet"
          onClick={() => applyProfile(provisionalAccessibilityProfile)}
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
  description?: string;
  id: string;
  label: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
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
      {description ? (
        <p className="aksa-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
