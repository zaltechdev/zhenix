"use client";

import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { exampleCommandKeys } from "@/lib/contracts/command";
import { exampleCommandCopy } from "@/lib/i18n/copy";
import { useOptionalCommandContext } from "@/components/workspace/command-context";

/**
 * Safe example commands.
 *
 * Selecting one fills the composer. It never submits, never runs, and never claims
 * a result.
 */
export function ExampleCommands({ locale }: { locale: Locale }) {
  const context = useOptionalCommandContext();
  const options = { locale };

  return (
    <div className="aksa-examples">
      <ul aria-label={m.composer_examples_label({}, options)} className="aksa-examples__list">
        {exampleCommandKeys.map((key) => {
          const text = exampleCommandCopy(key, locale);
          return (
            <li key={key}>
              <button
                className="aksa-button aksa-button--quiet aksa-examples__item"
                onClick={() => context?.dispatch({ type: "insert_example", text })}
                type="button"
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="aksa-hint">{m.composer_example_hint({}, options)}</p>
    </div>
  );
}
