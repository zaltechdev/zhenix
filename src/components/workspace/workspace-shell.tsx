"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { AccessibilityProfile, UserPreferences } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";
import { CommandProvider } from "@/components/workspace/command-context";
import { CommandComposer } from "@/components/workspace/command-composer";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceActionProvider, useAksaActions } from "@/components/workspace/aksa-action-context";
import { WorkspaceCalibrationExperience } from "@/components/workspace/calibration-experience";
import { HeadControlRuntimeBoundary } from "@/lib/client/vision/head-control-context";
import { VoiceControlProvider } from "@/components/workspace/voice-control-context";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";

export function WorkspaceShell({
  locale,
  session,
  connection,
  initialProfile,
  initialPreferences,
  children
}: {
  locale: Locale;
  session: SessionState;
  connection: GoogleConnection;
  initialProfile?: AccessibilityProfile | null;
  initialPreferences?: UserPreferences | null;
  children: ReactNode;
}) {
  const userId = session.status === "authenticated" ? session.session.userId : null;
  const reconcileAccountPreferences = useOptionalAppPreferences()?.reconcileAccountPreferences;

  useEffect(() => {
    if (!reconcileAccountPreferences) return;
    void reconcileAccountPreferences(userId, initialPreferences ?? null);
  }, [initialPreferences, reconcileAccountPreferences, userId]);

  return (
    <HeadControlRuntimeBoundary initialProfile={initialProfile} userId={userId}>
      <VoiceControlProvider userId={userId}>
        <WorkspaceActionProvider>
          <WorkspaceShellContent
            connection={connection}
            locale={locale}
            session={session}
          >
            {children}
          </WorkspaceShellContent>
        </WorkspaceActionProvider>
      </VoiceControlProvider>
    </HeadControlRuntimeBoundary>
  );
}

function WorkspaceShellContent({
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
  const isSlidesPage = pathname.startsWith("/workspace/slides");
  const shouldRenderBottomComposer = !isHome && !isSlidesPage;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const { sidebarCollapsed, calibrationOpen, closeCalibration } = useAksaActions();
  const options = { locale };

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
    if (!drawerOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

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
    <CommandProvider>
      <div
        className="aksa-shell"
        data-drawer-open={drawerOpen}
        data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      >
        <a className="aksa-skip-link" href="#main-content">
          {m.skip_to_content({}, options)}
        </a>
        <a className="aksa-skip-link" href="#command-composer">
          {m.workspace_skip_to_composer({}, options)}
        </a>

        <aside
          aria-label={m.workspace_nav_label({}, options)}
          className="aksa-nav aksa-nav--desktop"
          id="workspace-desktop-sidebar"
        >
          <WorkspaceSidebar
            collapsed={sidebarCollapsed}
            locale={locale}
            pathname={pathname}
          />
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
                  aria-label={m.workspace_nav_close({}, options)}
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
                <WorkspaceSidebar
                  collapsed={false}
                  locale={locale}
                  onNavigate={closeDrawer}
                  pathname={pathname}
                  showCollapseControl={false}
                />
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
              <p className="aksa-ai-disclaimer" role="note">
                {m.workspace_ai_disclaimer({}, options)}
              </p>
            </footer>
          ) : null}
        </div>

        {calibrationOpen ? (
          <WorkspaceCalibrationExperience locale={locale} onClose={closeCalibration} />
        ) : null}
      </div>
    </CommandProvider>
  );
}
