import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { AksaError, NextAction } from "@/lib/contracts/errors";
import type { ResourceState } from "@/lib/contracts/resource-state";
import { emptyReasonCopy, errorCopy, errorShortCopy, nextActionCopy } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";

/**
 * One presentation for loading, empty, blocked, and partial.
 *
 * Surfaces render this instead of inventing their own state copy, so no view can
 * report a failure without also offering a way forward.
 */

const toneForCategory: Record<string, StatusTone> = {
  not_configured: "blocked",
  connection_required: "attention",
  scope_required: "attention",
  authentication_required: "attention",
  session_expired: "attention",
  permission_denied: "blocked",
  not_found: "neutral",
  unsupported: "neutral",
  unavailable: "blocked",
  rate_limited: "pending",
  timeout: "attention",
  validation_failed: "attention",
  verification_failed: "attention",
  partial_failure: "attention",
  cancelled: "neutral",
  undo_unavailable: "neutral",
  internal_error: "blocked"
};

/** Recovery routes for the actions that resolve to a destination in Aksa. */
const actionRoutes: Partial<Record<NextAction, "/sign-in" | "/workspace/settings" | "/workspace/accessibility">> = {
  sign_in: "/sign-in",
  connect_google: "/workspace/settings",
  grant_capability: "/workspace/settings",
  narrow_scope: "/workspace/settings",
  configure_deployment: "/workspace/settings",
  use_keyboard: "/workspace/accessibility"
};

export function StatePanel({
  tone,
  statusLabel,
  body,
  actions,
  children
}: {
  tone: StatusTone;
  statusLabel: string;
  body: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="aksa-state-panel" data-tone={tone}>
      <StatusChip tone={tone} value={statusLabel} />
      <p className="aksa-state-panel__body">{body}</p>
      {children}
      {actions ? <div className="aksa-state-panel__actions">{actions}</div> : null}
    </div>
  );
}

export function ErrorActions({ error, locale }: { error: AksaError; locale: Locale }) {
  const options = { locale };
  const entries: Array<{ action: NextAction; label: string; route?: string }> = [];

  for (const action of error.nextActions) {
    if (action === "configure_deployment") {
      entries.push({ action, label: m.action_go_home({}, options), route: "/workspace" });
    } else {
      const label = nextActionCopy(action, locale);
      if (label !== null) {
        entries.push({ action, label, route: actionRoutes[action] });
      }
    }
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map((entry) => {
        const route = entry.route ?? actionRoutes[entry.action];
        if (route) {
          return (
            <Link className="aksa-button aksa-button--secondary" href={route as never} key={entry.action}>
              {entry.label}
            </Link>
          );
        }

        return (
          <span className="aksa-state-panel__hint" key={entry.action}>
            {entry.label}
          </span>
        );
      })}
    </>
  );
}

export function BlockedState({ error, locale }: { error: AksaError; locale: Locale }) {
  const tone = toneForCategory[error.category] ?? "blocked";
  const isDev = process.env.NODE_ENV === "development";

  return (
    <StatePanel
      actions={<ErrorActions error={error} locale={locale} />}
      body={errorCopy(error.category, locale)}
      statusLabel={errorShortCopy(error.category, locale)}
      tone={tone}
    >
      {isDev ? (
        <details className="aksa-developer-details">
          <summary className="aksa-developer-details__summary">Developer details</summary>
          <code className="aksa-developer-details__code">{error.debugReference}</code>
        </details>
      ) : null}
    </StatePanel>
  );
}

export function LoadingState({ locale }: { locale: Locale }) {
  return (
    <div className="aksa-state-panel" data-tone="pending" role="status">
      <span className="aksa-chip aksa-chip--pending">
        <Loader2 aria-hidden="true" className="aksa-icon aksa-icon--sm aksa-icon--spin" />
        <span className="aksa-chip__value">{m.state_loading({}, { locale })}</span>
      </span>
      <p className="aksa-state-panel__body">{m.state_loading_announce({}, { locale })}</p>
    </div>
  );
}

/**
 * Renders the non-ready branches of a `ResourceState` and hands `ready` and
 * `partial` back to the caller so a surface only writes its data path once.
 */
export function SurfaceState<TData>({
  state,
  locale,
  children,
  emptyActions
}: {
  state: ResourceState<TData>;
  locale: Locale;
  children: (data: TData) => ReactNode;
  emptyActions?: ReactNode;
}) {
  if (state.status === "loading") {
    return <LoadingState locale={locale} />;
  }

  if (state.status === "blocked") {
    return <BlockedState error={state.error} locale={locale} />;
  }

  if (state.status === "empty") {
    return (
      <StatePanel
        actions={emptyActions}
        body={emptyReasonCopy(state.reason, locale)}
        statusLabel={m.status_empty({}, { locale })}
        tone="neutral"
      />
    );
  }

  if (state.status === "partial") {
    return (
      <>
        <StatePanel
          actions={<ErrorActions error={state.error} locale={locale} />}
          body={errorCopy(state.error.category, locale)}
          statusLabel={m.state_partial_heading({}, { locale })}
          tone="attention"
        />
        {children(state.data)}
      </>
    );
  }

  return <>{children(state.data)}</>;
}
