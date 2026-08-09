"use client";

import { usePathname } from "next/navigation";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

type WorkspaceSkeletonKind = "home" | "editor" | "grid" | "list" | "settings" | "search";

function workspaceSkeletonKind(pathname: string): WorkspaceSkeletonKind {
  if (pathname === "/workspace" || pathname === "/workspace/") return "home";
  if (pathname.startsWith("/workspace/documents")) return "editor";
  if (pathname.startsWith("/workspace/sheets")) return "grid";
  if (pathname.startsWith("/workspace/search")) return "search";
  if (
    pathname.startsWith("/workspace/settings") ||
    pathname.startsWith("/workspace/account") ||
    pathname.startsWith("/workspace/accessibility") ||
    pathname.startsWith("/workspace/controls")
  ) {
    return "settings";
  }
  return "list";
}

function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`aksa-loading-skeleton ${className}`.trim()} />;
}

function WorkspaceMainSkeleton({ kind }: { kind: WorkspaceSkeletonKind }) {
  if (kind === "home") {
    return (
      <div className="aksa-workspace-loading__home" data-skeleton-kind="home">
        <div className="aksa-workspace-loading__welcome">
          <Skeleton className="aksa-workspace-loading__title" />
          <Skeleton className="aksa-workspace-loading__copy" />
        </div>
        <Skeleton className="aksa-workspace-loading__composer" />
        <div className="aksa-workspace-loading__pills">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
        <div className="aksa-workspace-loading__cards">
          <Skeleton className="aksa-workspace-loading__card aksa-workspace-loading__card--wide" />
          <Skeleton className="aksa-workspace-loading__card" />
        </div>
      </div>
    );
  }

  return (
    <div className="aksa-workspace-loading__surface" data-skeleton-kind={kind}>
      <div className="aksa-workspace-loading__surface-header">
        <div>
          <Skeleton className="aksa-workspace-loading__title" />
          <Skeleton className="aksa-workspace-loading__copy" />
        </div>
        <Skeleton className="aksa-workspace-loading__action" />
      </div>
      {kind === "settings" ? (
        <div className="aksa-workspace-loading__settings">
          <Skeleton className="aksa-workspace-loading__settings-nav" />
          <div className="aksa-workspace-loading__settings-fields">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        </div>
      ) : kind === "editor" ? (
        <div className="aksa-workspace-loading__editor">
          <Skeleton className="aksa-workspace-loading__toolbar" />
          <Skeleton className="aksa-workspace-loading__document" />
        </div>
      ) : kind === "grid" ? (
        <div className="aksa-workspace-loading__grid" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => <Skeleton key={index} />)}
        </div>
      ) : kind === "search" ? (
        <div className="aksa-workspace-loading__search">
          <Skeleton className="aksa-workspace-loading__search-field" />
          <Skeleton className="aksa-workspace-loading__result" />
          <Skeleton className="aksa-workspace-loading__result" />
        </div>
      ) : (
        <div className="aksa-workspace-loading__list">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}
        </div>
      )}
    </div>
  );
}

function WorkspaceLoading({ locale, pathname }: { locale: Locale; pathname: string }) {
  return (
    <main aria-busy="true" className="aksa-workspace-loading">
      <span aria-live="polite" className="sr-only" role="status">
        {m.state_loading({}, { locale })}
      </span>
      <aside className="aksa-workspace-loading__sidebar">
        <Skeleton className="aksa-workspace-loading__brand" />
        <Skeleton className="aksa-workspace-loading__nav-heading" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton className="aksa-workspace-loading__nav-item" key={index} />
        ))}
      </aside>
      <section className="aksa-workspace-loading__column">
        <header className="aksa-workspace-loading__header">
          <Skeleton className="aksa-workspace-loading__header-title" />
          <div className="aksa-workspace-loading__header-actions"><Skeleton /><Skeleton /></div>
        </header>
        <div className="aksa-workspace-loading__main">
          <WorkspaceMainSkeleton kind={workspaceSkeletonKind(pathname)} />
        </div>
      </section>
    </main>
  );
}

function PublicLoading({ locale }: { locale: Locale }) {
  return (
    <main aria-busy="true" className="aksa-loading-shell bg-paper px-5 text-ink">
      <span aria-live="polite" className="sr-only" role="status">
        {m.state_loading({}, { locale })}
      </span>
      <div className="aksa-loading-shell__header">
        <Skeleton className="aksa-loading-skeleton--brand" />
        <Skeleton className="aksa-loading-skeleton--control" />
      </div>
      <section className="aksa-loading-shell__card">
        <Skeleton className="aksa-loading-skeleton--eyebrow" />
        <Skeleton className="aksa-loading-skeleton--heading" />
        <Skeleton className="aksa-loading-skeleton--copy" />
        <Skeleton className="aksa-loading-skeleton--copy aksa-loading-skeleton--copy-short" />
        <div className="aksa-loading-shell__fields">
          <Skeleton className="aksa-loading-skeleton--field" />
          <Skeleton className="aksa-loading-skeleton--field" />
        </div>
      </section>
    </main>
  );
}

export function RouteLoading({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "/";
  return pathname.startsWith("/workspace")
    ? <WorkspaceLoading locale={locale} pathname={pathname} />
    : <PublicLoading locale={locale} />;
}
