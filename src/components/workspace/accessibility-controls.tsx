"use client";

import { useCallback, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import {
  accessibilityProfileSaveResultSchema,
  accessibilityProfileSchema,
  provisionalAccessibilityProfile,
  type AccessibilityProfile,
  type AccessibilityProfileSaveResult
} from "@/lib/contracts/auth";
import { createAksaError } from "@/lib/contracts/errors";
import { BlockedState } from "@/components/workspace/state-panel";

/**
 * Pointer and selection controls.
 *
 * Values change with a live preview and a reset is always reachable by keyboard, so a
 * setting can never leave the user unable to continue. Saving goes to the real server
 * boundary and reports whatever it returns.
 */
export function AccessibilityControls({
  locale,
  initialProfile
}: {
  locale: Locale;
  initialProfile: AccessibilityProfile | null;
}) {
  const [profile, setProfile] = useState<AccessibilityProfile>(
    initialProfile ?? provisionalAccessibilityProfile
  );
  const [result, setResult] = useState<AccessibilityProfileSaveResult | null>(null);
  const [saving, setSaving] = useState(false);
  const options = { locale };

  const update = useCallback(<TKey extends keyof AccessibilityProfile>(
    key: TKey,
    value: AccessibilityProfile[TKey]
  ) => {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setResult(null);
  }, []);

  const save = useCallback(async () => {
    const parsed = accessibilityProfileSchema.safeParse(profile);
    if (!parsed.success) {
      setResult({ outcome: "invalid_input", error: createAksaError("validation_failed") });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/accessibility-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data)
      });

      const payload: unknown = await response.json();
      const outcome = accessibilityProfileSaveResultSchema.safeParse(payload);
      setResult(
        outcome.success
          ? outcome.data
          : { outcome: "unavailable", error: createAksaError("internal_error") }
      );
    } catch {
      setResult({ outcome: "unavailable", error: createAksaError("unavailable") });
    } finally {
      setSaving(false);
    }
  }, [profile]);

  return (
    <div className="aksa-controls">
      <div className="aksa-controls__grid">
        <div className="aksa-field">
          <label className="aksa-label" htmlFor="pointer-sensitivity">
            {m.onboarding_sensitivity_label({}, options)}
          </label>
          <div className="aksa-field--row">
            <input
              className="aksa-range"
              id="pointer-sensitivity"
              max={100}
              min={0}
              onChange={(event) => update("pointerSensitivity", Number(event.target.value))}
              type="range"
              value={profile.pointerSensitivity}
            />
            <output className="aksa-output" htmlFor="pointer-sensitivity">
              {profile.pointerSensitivity}
            </output>
          </div>
        </div>

        <div className="aksa-field">
          <label className="aksa-label" htmlFor="dead-zone">
            {m.onboarding_dead_zone_label({}, options)}
          </label>
          <div className="aksa-field--row">
            <input
              aria-describedby="dead-zone-desc"
              className="aksa-range"
              id="dead-zone"
              max={100}
              min={0}
              onChange={(event) => update("deadZone", Number(event.target.value))}
              type="range"
              value={profile.deadZone}
            />
            <output className="aksa-output" htmlFor="dead-zone">
              {profile.deadZone}
            </output>
          </div>
          <p className="aksa-field__description" id="dead-zone-desc">
            {m.onboarding_dead_zone_helper({}, options)}
          </p>
        </div>

        <div className="aksa-field">
          <label className="aksa-label" htmlFor="smoothing">
            {m.onboarding_smoothing_label({}, options)}
          </label>
          <div className="aksa-field--row">
            <input
              className="aksa-range"
              id="smoothing"
              max={100}
              min={0}
              onChange={(event) => update("smoothing", Number(event.target.value))}
              type="range"
              value={profile.smoothing}
            />
            <output className="aksa-output" htmlFor="smoothing">
              {profile.smoothing}
            </output>
          </div>
        </div>

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

        {profile.selectionMode === "dwell" || profile.selectionMode === "both" ? (
          <div className="aksa-field">
            <label className="aksa-label" htmlFor="dwell-duration">
              {m.onboarding_dwell_duration_label({}, options)}
            </label>
            <div className="aksa-field--row">
              <input
                className="aksa-range"
                id="dwell-duration"
                max={5000}
                min={300}
                onChange={(event) => update("dwellDurationMs", Number(event.target.value))}
                step={100}
                type="range"
                value={profile.dwellDurationMs ?? 1200}
              />
              <output className="aksa-output" htmlFor="dwell-duration">
                {profile.dwellDurationMs ?? 1200}
              </output>
            </div>
          </div>
        ) : null}
      </div>

      {profile.selectionMode === "gesture" || profile.selectionMode === "both" ? (
        <p className="aksa-inline-note">{m.onboarding_selection_gesture_note({}, options)}</p>
      ) : null}

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

      <div className="aksa-controls__footer-row">
        <button
          className="aksa-button aksa-button--quiet"
          onClick={() => {
            setProfile(provisionalAccessibilityProfile);
            setResult(null);
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="aksa-icon" />
          <span>{m.onboarding_reset_defaults({}, options)}</span>
        </button>
        <button
          className="aksa-button aksa-button--secondary"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          <Save aria-hidden="true" className="aksa-icon" />
          <span>{m.a11y_save({}, options)}</span>
        </button>
      </div>

      {result !== null && result.outcome !== "saved" ? (
        <BlockedState error={result.error} locale={locale} />
      ) : null}
    </div>
  );
}
