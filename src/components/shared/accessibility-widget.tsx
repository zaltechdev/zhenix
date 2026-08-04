"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Check, Eye, Type, X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function AccessibilityWidget({ locale = "en" }: { locale?: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const messageOptions = { locale };

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
    const next = !highContrast;
    setHighContrast(next);
    document.documentElement.classList.toggle("high-contrast", next);
  }

  function toggleLargeText() {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.classList.toggle("large-text", next);
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
              aria-pressed={highContrast}
              className={`landing-a11y-option ${highContrast ? "landing-a11y-option--active" : ""}`}
              onClick={toggleHighContrast}
              type="button"
            >
              <div className="landing-a11y-option__info">
                <Eye aria-hidden="true" className="landing-icon" />
                <span>{m.accessibility_high_contrast({}, messageOptions)}</span>
              </div>
              {highContrast ? <Check aria-hidden="true" className="landing-icon landing-icon--check" /> : null}
            </button>

            <button
              aria-pressed={largeText}
              className={`landing-a11y-option ${largeText ? "landing-a11y-option--active" : ""}`}
              onClick={toggleLargeText}
              type="button"
            >
              <div className="landing-a11y-option__info">
                <Type aria-hidden="true" className="landing-icon" />
                <span>{m.accessibility_large_text({}, messageOptions)}</span>
              </div>
              {largeText ? <Check aria-hidden="true" className="landing-icon landing-icon--check" /> : null}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
