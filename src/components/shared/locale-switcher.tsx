"use client";

import { m } from "@/paraglide/messages.js";
import { getLocale, locales, setLocale } from "@/paraglide/runtime.js";

const languageLabels: Record<(typeof locales)[number], string> = {
  en: m.language_english(),
  id: m.language_indonesian()
};

export function LocaleSwitcher() {
  const currentLocale = getLocale();

  return (
    <div aria-label={m.language_switcher_label()} className="flex gap-2" role="group">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={locale === currentLocale}
          className="min-h-11 rounded-control border border-line bg-cloud px-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-teal hover:bg-teal-soft disabled:cursor-default disabled:opacity-60"
          disabled={locale === currentLocale}
          onClick={() => setLocale(locale)}
        >
          {languageLabels[locale]}
        </button>
      ))}
    </div>
  );
}
