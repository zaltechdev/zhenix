"use client";

import { Check } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { UserPreferences } from "@/lib/contracts/auth";
import { useAppPreferences } from "@/lib/client/preferences/preference-context";

const themes: UserPreferences["theme"][] = ["system", "light", "dark"];

function themeLabel(theme: UserPreferences["theme"], locale: Locale): string {
  const options = { locale };
  if (theme === "system") return m.appearance_theme_system({}, options);
  return theme === "light" ? m.theme_light({}, options) : m.theme_dark({}, options);
}

export function AppearanceSettings({ locale }: { locale: Locale }) {
  const { accountUserId, preferences, saveFailed, updatePreferences } = useAppPreferences();
  const options = { locale };
  const accountReady = Boolean(accountUserId);

  return (
    <div aria-busy={!accountReady} className="aksa-appearance">
      <div>
        <h3 className="aksa-appearance__heading">{m.appearance_theme_heading({}, options)}</h3>
        <p className="aksa-hint">{m.appearance_theme_intro({}, options)}</p>
      </div>

      <div aria-label={m.appearance_theme_heading({}, options)} className="aksa-theme-options" role="radiogroup">
        {themes.map((theme) => {
          const selected = preferences.theme === theme;
          return (
            <button
              aria-checked={selected}
              className="aksa-theme-card"
              data-selected={selected || undefined}
              data-theme-preview={theme}
              disabled={!accountReady}
              key={theme}
              onClick={() => updatePreferences({ theme })}
              role="radio"
              type="button"
            >
              <span aria-hidden="true" className="aksa-theme-card__preview">
                <span className="aksa-theme-card__sidebar" />
                <span className="aksa-theme-card__surface">
                  <span className="aksa-theme-card__line aksa-theme-card__line--strong" />
                  <span className="aksa-theme-card__line" />
                  <span className="aksa-theme-card__accent" />
                </span>
              </span>
              <span className="aksa-theme-card__label">
                {themeLabel(theme, locale)}
                {selected ? <Check aria-hidden="true" className="aksa-icon aksa-icon--sm" /> : null}
              </span>
              {theme === "system" ? (
                <span className="aksa-theme-card__description">{m.appearance_theme_system_desc({}, options)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <fieldset className="aksa-contrast-options">
        <legend className="aksa-appearance__heading">{m.appearance_contrast_heading({}, options)}</legend>
        <label className="aksa-contrast-option">
          <input
            checked={!preferences.highContrast}
            disabled={!accountReady}
            name="appearance-contrast"
            onChange={() => updatePreferences({ highContrast: false })}
            type="radio"
          />
          <span>{m.appearance_contrast_standard({}, options)}</span>
        </label>
        <label className="aksa-contrast-option">
          <input
            checked={preferences.highContrast}
            disabled={!accountReady}
            name="appearance-contrast"
            onChange={() => updatePreferences({ highContrast: true })}
            type="radio"
          />
          <span>{m.appearance_contrast_increased({}, options)}</span>
        </label>
      </fieldset>

      {saveFailed ? <p className="aksa-hint" role="status">{m.controls_save_failed({}, options)}</p> : null}
    </div>
  );
}
