"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Accessibility, Menu, UserRound } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";
import { googleConnectionCopy } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";
import { navigationLabelForPath } from "@/components/workspace/navigation-items";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Quiet, compact workspace header.
 *
 * It reports location, account state, and Google connection. It is deliberately not
 * styled as a browser toolbar and recreates no browser chrome.
 */



export function WorkspaceHeader({
  locale,
  session,
  connection,
  onOpenNavigation
}: {
  locale: Locale;
  session?: SessionState;
  connection: GoogleConnection;
  onOpenNavigation: () => void;
}) {
  const pathname = usePathname();
  const options = { locale };
  const isAuthenticated = session?.status === "authenticated";
  const isGoogleConnected = connection.state === "connected";
  const title = navigationLabelForPath(pathname, locale);

  return (
    <header aria-label={m.workspace_header_label({}, options)} className="aksa-header">
      <div className="aksa-header__leading">
        <button
          aria-controls="workspace-navigation-drawer"
          className="aksa-icon-button aksa-header__menu"
          onClick={onOpenNavigation}
          type="button"
        >
          <Menu aria-hidden="true" className="aksa-icon" />
          <span className="sr-only">{m.workspace_nav_open({}, options)}</span>
        </button>
        <span className="aksa-header__title-mobile">{title}</span>
      </div>

      <div className="aksa-header__actions">
        {!isAuthenticated ? (
          <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/sign-in">
            {m.action_sign_in({}, options)}
          </Link>
        ) : !isGoogleConnected ? (
          <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/settings">
            {connection.state === "needs_reconnect" ? "Reconnect Google" : m.action_connect_google({}, options)}
          </Link>
        ) : (
          <StatusChip
            label={m.google_connection_label({}, options)}
            tone="ready"
            value={googleConnectionCopy(connection.state, locale)}
          />
        )}

        <ThemeToggle locale={locale} />
        <Link className="aksa-icon-button" href="/workspace/accessibility">
          <Accessibility aria-hidden="true" className="aksa-icon" />
          <span className="sr-only">{m.nav_accessibility({}, options)}</span>
        </Link>
        <Link className="aksa-icon-button" href="/workspace/account">
          <UserRound aria-hidden="true" className="aksa-icon" />
          <span className="sr-only">{m.nav_account({}, options)}</span>
        </Link>
      </div>
    </header>
  );
}
