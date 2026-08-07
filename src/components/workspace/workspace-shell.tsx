"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";
import { CommandProvider } from "@/components/workspace/command-context";
import { CommandComposer } from "@/components/workspace/command-composer";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";

/**
 * Workspace application shell.
 *
 * Three regions: navigation, the Aksa-owned work surface, and the persistent
 * composer. The composer is last in DOM reading order on every viewport, and the
 * mobile drawer traps focus while open and restores it to its trigger on close.
 */
const WORK_SURFACES = [
  "/workspace/documents",
  "/workspace/sheets",
  "/workspace/files",
  "/workspace/mail",
  "/workspace/search",
  "/workspace/slides"
];

import { HeadControlProvider } from "@/lib/client/vision/head-control-context";

export function WorkspaceShell({
  locale,
  session,
  connection,
  children
}: {
  locale: Locale;
  session: SessionState;
  connection: GoogleConnection;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/workspace" || pathname === "/workspace/";
  const isWorkSurface = WORK_SURFACES.some((surface) => pathname.startsWith(surface));
  const isSlidesPage = pathname.startsWith("/workspace/slides");
  const isUsable = session.status === "authenticated" && connection.state === "connected";
  const shouldRenderBottomComposer = isWorkSurface && isUsable && !isSlidesPage;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const options = { locale };

  const userId = session.status === "authenticated" ? session.session.userId : null;

  const openDrawer = useCallback(() => {
    triggerRef.current = document.activeElement;
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    const trigger = triggerRef.current;
    if (trigger instanceof HTMLElement) {
      trigger.focus();
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable || focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDrawer, drawerOpen]);

  return (
    <HeadControlProvider userId={userId}>
      <CommandProvider>
        <div className="aksa-shell" data-drawer-open={drawerOpen}>
        <a className="aksa-skip-link" href="#main-content">
          {m.skip_to_content({}, options)}
        </a>
        <a className="aksa-skip-link" href="#command-composer">
          {m.workspace_skip_to_composer({}, options)}
        </a>

        <aside aria-label={m.workspace_nav_label({}, options)} className="aksa-nav aksa-nav--desktop">
          <WorkspaceSidebar locale={locale} pathname={pathname} />
        </aside>

        {drawerOpen ? (
          <div className="aksa-drawer" ref={drawerRef}>
            <div
              aria-labelledby="workspace-drawer-title"
              aria-modal="true"
              className="aksa-drawer__panel"
              id="workspace-navigation-drawer"
              role="dialog"
            >
              <div className="aksa-drawer__header">
                <h2 className="aksa-drawer__title" id="workspace-drawer-title">
                  {m.workspace_nav_label({}, options)}
                </h2>
                <button
                  className="aksa-icon-button"
                  onClick={closeDrawer}
                  ref={closeButtonRef}
                  type="button"
                >
                  <X aria-hidden="true" className="aksa-icon" />
                  <span className="sr-only">{m.workspace_nav_close({}, options)}</span>
                </button>
              </div>
              <nav aria-label={m.workspace_nav_label({}, options)} className="aksa-nav aksa-nav--drawer">
                <WorkspaceSidebar locale={locale} onNavigate={closeDrawer} pathname={pathname} />
              </nav>
            </div>
          </div>
        ) : null}

        <div className="aksa-column">
          <WorkspaceHeader
            connection={connection}
            locale={locale}
            onOpenNavigation={openDrawer}
            session={session}
          />

          <main className="aksa-main" id="main-content">
            {!isHome && session.status !== "authenticated" ? (
              <p className="aksa-notice" role="note">
                {m.workspace_preview_notice({}, options)}
              </p>
            ) : null}
            {children}
          </main>

          {shouldRenderBottomComposer ? (
            <footer className="aksa-composer-footer">
              <CommandComposer locale={locale} />
            </footer>
          ) : null}
        </div>
      </div>
    </CommandProvider>
  </HeadControlProvider>
  );
}
