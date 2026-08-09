"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { exampleCommandCopy } from "@/lib/i18n/copy";
import { useOptionalCommandContext } from "@/components/workspace/command-context";

/**
 * Quick-start suggestions under the primary command composer.
 * Real Docs prompts populate the composer. Preview-only prompts open their clearly
 * labelled work surface without claiming any backend execution.
 */
export function QuickStartSuggestions({ locale }: { locale: Locale }) {
  const context = useOptionalCommandContext();
  const router = useRouter();
  const options = { locale };
  const suggestions: Array<{ key: string; route: Route | null; text: string }> = [
    { key: "summarize_document" as const, route: null, text: exampleCommandCopy("summarize_document", locale) },
    { key: "find_project_files" as const, route: "/workspace/files", text: exampleCommandCopy("find_project_files", locale) },
    { key: "read_sheet_range" as const, route: "/workspace/sheets", text: exampleCommandCopy("read_sheet_range", locale) },
    { key: "mail_preview" as const, route: "/workspace/mail", text: m.home_gmail_desc({}, options) },
    { key: "search_with_sources" as const, route: "/workspace/search", text: exampleCommandCopy("search_with_sources", locale) }
  ];

  return (
    <nav aria-label={m.composer_examples_label({}, options)} className="aksa-quick-suggestions">
      <ul className="aksa-quick-suggestions__list">
        {suggestions.map(({ key, route, text }) => {
          return (
            <li key={key}>
              <button
                className="aksa-button aksa-button--secondary aksa-quick-suggestions__chip"
                onClick={() => {
                  if (route !== null) {
                    router.push(route);
                    return;
                  }
                  context?.dispatch({ type: "insert_example", text });
                }}
                type="button"
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
