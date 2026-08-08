"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { ID, US } from "country-flag-icons/react/3x2";
import { m } from "@/paraglide/messages.js";
import { setLocale } from "@/paraglide/runtime.js";
import type { Locale } from "@/paraglide/runtime.js";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";

export function LocaleSwitcher({ locale = "en" }: { locale?: Locale } = {}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const appPreferences = useOptionalAppPreferences();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messageOptions = { locale };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  function handleSwitch(newLocale: Locale) {
    setIsOpen(false);
    if (newLocale === locale) return;
    appPreferences?.updatePreferences({ language: newLocale });
    // eslint-disable-next-line
    document.cookie = `PARAGLIDE_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(newLocale, { reload: false });
    router.refresh();
  }

  const options: { code: Locale; label: string }[] = [
    { code: "id", label: m.language_indonesian({}, messageOptions) },
    { code: "en", label: m.language_english({}, messageOptions) }
  ];


  return (
    <div className="landing-locale-switcher" ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={m.language_switcher_label({}, messageOptions)}
        className="landing-locale-switcher__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        {locale === "id" ? (
          <ID aria-hidden="true" style={{ width: "20px", height: "auto", borderRadius: "2px", border: "1px solid var(--color-aksa-line)" }} />
        ) : (
          <US aria-hidden="true" style={{ width: "20px", height: "auto", borderRadius: "2px" }} />
        )}
        <ChevronDown
          aria-hidden="true"
          className={`landing-icon landing-icon--chevron ${isOpen ? "landing-icon--open" : ""}`}
        />
      </button>

      {isOpen ? (
        <div
          aria-label={m.language_switcher_label({}, messageOptions)}
          className="landing-locale-switcher__dropdown"
          role="menu"
        >
          {options.map((opt) => (
            <button
              className={`landing-locale-switcher__option-item ${
                opt.code === locale ? "landing-locale-switcher__option-item--active" : ""
              }`}
              key={opt.code}
              onClick={() => handleSwitch(opt.code)}
              role="menuitem"
              type="button"
            >
              <span>{opt.label}</span>
              {opt.code === locale ? (
                <Check aria-hidden="true" className="landing-icon landing-icon--check" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
