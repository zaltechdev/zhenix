"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Check, Eye, Type, X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";
import type { UserPreferences } from "@/lib/contracts/auth";
import { useOptionalHeadControl } from "@/lib/client/vision/head-control-context";

export function AccessibilityWidget({ locale = "en" }: { locale?: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [textSize, setTextSize] = useState<UserPreferences["textSize"]>("default");
  const [reducedMotion, setReducedMotion] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const messageOptions = { locale };
  const appPreferences = useOptionalAppPreferences();
  const headControl = useOptionalHeadControl();
  const activeHighContrast = appPreferences?.preferences.highContrast ?? highContrast;
  const activeTextSize = appPreferences?.preferences.textSize ?? textSize;
  const activeReducedMotion = appPreferences?.preferences.reducedMotion ?? reducedMotion;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleHighContrast() {
    const next = !activeHighContrast;
    setHighContrast(next);
    appPreferences?.updatePreferences({ highContrast: next });
    if (!appPreferences) document.documentElement.classList.toggle("high-contrast", next);
  }

  function changeTextSize(next: UserPreferences["textSize"]) {
    setTextSize(next);
    appPreferences?.updatePreferences({ textSize: next });
    if (!appPreferences) {
      document.documentElement.classList.toggle("text-size-large", next === "large");
      document.documentElement.classList.toggle("text-size-extra-large", next === "extra_large");
      document.documentElement.classList.toggle("large-text", next !== "default");
    }
  }

  function toggleReducedMotion() {
    const next = !activeReducedMotion;
    setReducedMotion(next);
    appPreferences?.updatePreferences({ reducedMotion: next });
    if (headControl) headControl.updateProfile({ ...headControl.profile, reducedMotion: next });
    if (!appPreferences) document.documentElement.classList.toggle("reduce-motion", next);
  }

  return (
    <div className="landing-a11y-widget" ref={widgetRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={m.accessibility_widget_title({}, messageOptions)}
        className="landing-a11y-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        title={m.accessibility_widget_title({}, messageOptions)}
      >
        <Accessibility aria-hidden="true" className="landing-icon" />
        <span className="landing-a11y-trigger__label">
          {m.accessibility_widget_label({}, messageOptions)}
        </span>
      </button>

      {isOpen ? (
        <div
          aria-label={m.accessibility_widget_title({}, messageOptions)}
          className="landing-a11y-menu"
          role="dialog"
        >
          <div className="landing-a11y-menu__header">
            <span className="landing-a11y-menu__title">
              {m.accessibility_widget_title({}, messageOptions)}
            </span>
            <button
              aria-label={m.accessibility_close({}, messageOptions)}
              className="landing-a11y-menu__close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="landing-icon landing-icon--sm" />
            </button>
          </div>

          <div className="landing-a11y-menu__options">
            <button
              aria-pressed={activeHighContrast}
              className={`landing-a11y-option ${activeHighContrast ? "landing-a11y-option--active" : ""}`}
              onClick={toggleHighContrast}
              type="button"
            >
              <div className="landing-a11y-option__info">
                <Eye aria-hidden="true" className="landing-icon" />
                <span>{m.accessibility_high_contrast({}, messageOptions)}</span>
              </div>
              {activeHighContrast ? <Check aria-hidden="true" className="landing-icon landing-icon--check" /> : null}
            </button>

            <label className="landing-a11y-option landing-a11y-option--field">
              <div className="landing-a11y-option__info">
                <Type aria-hidden="true" className="landing-icon" />
                <span>{m.accessibility_text_size_label({}, messageOptions)}</span>
              </div>
              <select
                aria-label={m.accessibility_text_size_label({}, messageOptions)}
                className="landing-a11y-option__select"
                onChange={(event) => changeTextSize(event.target.value as UserPreferences["textSize"])}
                value={activeTextSize}
              >
                <option value="default">{m.accessibility_text_size_default({}, messageOptions)}</option>
                <option value="large">{m.accessibility_text_size_large({}, messageOptions)}</option>
                <option value="extra_large">
                  {m.accessibility_text_size_extra_large({}, messageOptions)}
                </option>
              </select>
            </label>

            <button
              aria-pressed={activeReducedMotion}
              className={`landing-a11y-option ${activeReducedMotion ? "landing-a11y-option--active" : ""}`}
              onClick={toggleReducedMotion}
              type="button"
            >
              <div className="landing-a11y-option__info">
                <span aria-hidden="true" className="landing-a11y-option__motion-icon">≈</span>
                <span>{m.accessibility_reduce_motion({}, messageOptions)}</span>
              </div>
              {activeReducedMotion ? <Check aria-hidden="true" className="landing-icon landing-icon--check" /> : null}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
