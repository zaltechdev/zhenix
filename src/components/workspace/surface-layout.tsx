import type { ReactNode } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { WorkspaceSurfaceMode } from "@/lib/contracts/workspace-surface";

/**
 * Shared surface scaffolding.
 *
 * Each work surface gets exactly one H1 and a short introduction, then its content
 * in H2 sections, so heading order stays valid across every route.
 */
export function SurfaceHeader({
  heading,
  intro,
  actions,
  locale,
  mode = "live"
}: {
  heading: string;
  intro: string;
  actions?: ReactNode;
  locale?: Locale;
  mode?: WorkspaceSurfaceMode;
}) {
  const preview = mode === "preview" && locale !== undefined;

  return (
    <div className="aksa-surface-header">
      <div className="aksa-surface-header__text">
        <div className="aksa-surface-header__title-row">
          <h1 className="aksa-surface-header__heading">{heading}</h1>
          {preview ? <span className="aksa-badge">{m.illustrative_label({}, { locale })}</span> : null}
        </div>
        <p className="aksa-surface-header__intro">{intro}</p>
        {preview ? <p className="aksa-hint">{m.illustrative_note({}, { locale })}</p> : null}
      </div>
      {actions ? <div className="aksa-surface-header__actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  heading,
  description,
  headingLevel = "h2",
  children,
  illustrative = false,
  locale
}: {
  heading: string;
  description?: string;
  headingLevel?: "h2" | "h3";
  children: ReactNode;
  /** Labels the panel as an interface preview rather than real user data. */
  illustrative?: boolean;
  locale: Locale;
}) {
  const Heading = headingLevel;

  return (
    <section className="aksa-panel" data-illustrative={illustrative || undefined}>
      <div className="aksa-panel__header">
        <Heading className="aksa-panel__heading">{heading}</Heading>
        {illustrative ? (
          <span className="aksa-badge">{m.illustrative_label({}, { locale })}</span>
        ) : null}
      </div>
      {description ? <p className="aksa-panel__description">{description}</p> : null}
      {illustrative ? <p className="aksa-hint">{m.illustrative_note({}, { locale })}</p> : null}
      {children}
    </section>
  );
}

export function SurfaceNote({ children }: { children: ReactNode }) {
  return <p className="aksa-inline-note">{children}</p>;
}
