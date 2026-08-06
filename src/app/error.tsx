"use client";

import { m } from "@/paraglide/messages.js";
import { baseLocale, toLocale } from "@/paraglide/runtime.js";

/**
 * Route error boundary.
 *
 * The digest is shown as a correlation reference so a user can quote it. No stack
 * trace, provider payload, or internal identifier is displayed.
 */
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale =
    typeof document === "undefined"
      ? baseLocale
      : (toLocale(
          document.cookie
            .split("; ")
            .find((entry) => entry.startsWith("PARAGLIDE_LOCALE="))
            ?.split("=")[1]
        ) ?? baseLocale);

  const options = { locale };

  return (
    <main className="aksa-auth-shell">
      <div className="aksa-auth-main">
        <section className="aksa-auth-card">
          <h1 className="aksa-auth-card__heading">{m.error_boundary_heading({}, options)}</h1>
          <p className="aksa-auth-card__intro">{m.error_boundary_body({}, options)}</p>
          {error.digest === undefined ? null : (
            <p className="aksa-hint">
              {m.error_boundary_reference({ reference: error.digest }, options)}
            </p>
          )}
          <button className="aksa-button aksa-button--primary" onClick={reset} type="button">
            {m.error_boundary_action({}, options)}
          </button>
        </section>
      </div>
    </main>
  );
}
