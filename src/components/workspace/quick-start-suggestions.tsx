"use client";

import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { exampleCommandKeys } from "@/lib/contracts/command";
import { exampleCommandCopy } from "@/lib/i18n/copy";
import { useOptionalCommandContext } from "@/components/workspace/command-context";

/**
 * Quick-start suggestions under the primary command composer.
 * Populates the composer via the real command flow.
 */
export function QuickStartSuggestions({ locale }: { locale: Locale }) {
  const context = useOptionalCommandContext();
  const options = { locale };

  return (
    <nav aria-label={m.composer_examples_label({}, options)} className="aksa-quick-suggestions">
      <ul className="aksa-quick-suggestions__list">
        {exampleCommandKeys.map((key) => {
          const text = exampleCommandCopy(key, locale);
          return (
            <li key={key}>
              <button
                className="aksa-button aksa-button--secondary aksa-quick-suggestions__chip"
                onClick={() => context?.dispatch({ type: "insert_example", text })}
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
