import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";
import { createAksaError } from "@/lib/contracts/errors";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { isCurrentRoute, primaryNavigationItems } from "@/components/workspace/navigation-items";

const pathname = vi.hoisted(() => ({ current: "/workspace" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

const session: SessionState = { status: "unavailable", error: createAksaError("not_configured") };

const connection: GoogleConnection = {
  state: "not_connected",
  accountEmail: null,
  grantedCapabilities: [],
  checkedAt: 0
};

const authSession: SessionState = {
  status: "authenticated",
  session: {
    userId: "u1",
    email: "user@example.com",
    displayName: "User",
    workspaceId: "w1",
    locale: "en",
    expiresAt: Date.now() + 3600000
  }
};

const connectedGoogle: GoogleConnection = {
  state: "connected",
  accountEmail: "user@example.com",
  grantedCapabilities: ["drive_read", "drive_write", "docs_read", "docs_write", "gmail_read"],
  checkedAt: Date.now()
};

function renderShell(
  locale: "en" | "id" = "en",
  sess = authSession,
  conn = connectedGoogle
) {
  return render(
    <WorkspaceShell connection={conn} locale={locale} session={sess}>
      <h1>Surface content</h1>
    </WorkspaceShell>
  );
}

beforeEach(() => {
  pathname.current = "/workspace/files";
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => cleanup());

describe("workspace shell", () => {
  it("exposes the three regions and skip links", () => {
    renderShell();

    expect(
      screen.getByRole("complementary", { name: m.workspace_nav_label({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: m.composer_region_label({}, { locale: "en" }) })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: m.skip_to_content({}, { locale: "en" }) })
    ).toHaveAttribute("href", "#main-content");
    expect(
      screen.getByRole("link", { name: m.workspace_skip_to_composer({}, { locale: "en" }) })
    ).toHaveAttribute("href", "#command-composer");
  });

  it("puts the composer last in reading order so it stays reachable on mobile", () => {
    const { container } = renderShell();

    const main = container.querySelector("#main-content");
    const composer = container.querySelector("#command-composer");
    expect(main).not.toBeNull();
    expect(composer).not.toBeNull();
    expect(main!.compareDocumentPosition(composer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lists every primary work surface with a visible label", () => {
    renderShell();

    const nav = screen.getByRole("complementary", {
      name: m.workspace_nav_label({}, { locale: "en" })
    });

    for (const item of primaryNavigationItems("en")) {
      if (item.disabled) {
        expect(within(nav).getByText(new RegExp(item.label))).toBeInTheDocument();
      } else {
        expect(within(nav).getByRole("link", { name: new RegExp(item.label) })).toHaveAttribute(
          "href",
          item.href
        );
      }
    }
  });

  it("marks the current route with aria-current and no other route", () => {
    pathname.current = "/workspace/files";
    renderShell();

    const nav = screen.getByRole("complementary", {
      name: m.workspace_nav_label({}, { locale: "en" })
    });

    expect(
      within(nav).getByRole("link", { name: new RegExp(m.nav_files({}, { locale: "en" })) })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: new RegExp(m.nav_home({}, { locale: "en" })) })
    ).not.toHaveAttribute("aria-current");
  });

  it("reports the account and contextual action honestly in the header", () => {
    renderShell("en", session, connection);

    expect(
      screen.getByRole("link", { name: m.action_sign_in({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.workspace_preview_notice({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: m.nav_account({}, { locale: "en" }) }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(m.workspace_ai_disclaimer({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      document.querySelector(".aksa-header")?.querySelector('a[href="/workspace/account"]')
    ).toBeNull();
    expect(
      document.querySelector(".aksa-header")?.querySelector('a[href="/workspace/accessibility"]')
    ).toBeNull();
  });

  it("renders Indonesian navigation labels", () => {
    renderShell("id");

    const nav = screen.getByRole("complementary", {
      name: m.workspace_nav_label({}, { locale: "id" })
    });

    expect(within(nav).getByRole("link", { name: m.nav_search({}, { locale: "id" }) })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: m.nav_history({}, { locale: "id" }) })).toBeInTheDocument();
  });

  it("collapses and expands the desktop sidebar without losing route state", () => {
    renderShell();

    const shell = document.querySelector(".aksa-shell");
    const collapse = screen.getByRole("button", {
      name: m.workspace_sidebar_collapse({}, { locale: "en" })
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(collapse.querySelector("svg")).not.toBeNull();
    expect(document.querySelector(".aksa-nav__inner > .aksa-nav__collapse")).toBeNull();

    fireEvent.click(collapse);

    const expand = screen.getByRole("button", {
      name: m.workspace_sidebar_expand({}, { locale: "en" })
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveClass("aksa-nav__brand--expand");
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(
      screen.getByRole("link", { name: m.nav_files({}, { locale: "en" }) })
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: m.nav_files({}, { locale: "en" }) })
    ).toHaveAttribute("title", m.nav_files({}, { locale: "en" }));

    fireEvent.click(expand);
    expect(
      screen.getByRole("button", { name: m.workspace_sidebar_collapse({}, { locale: "en" }) })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("persists the collapsed preference", async () => {
    window.localStorage.setItem("aksa-sidebar-collapsed", "true");
    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: m.workspace_sidebar_expand({}, { locale: "en" }) })
      ).toHaveAttribute("aria-expanded", "false");
    });
    expect(window.localStorage.getItem("aksa-sidebar-collapsed")).toBe("true");
  });
});

describe("mobile navigation drawer", () => {
  it("opens as a named dialog, traps focus, and restores focus to the trigger", async () => {
    renderShell();

    const trigger = screen.getByRole("button", { name: m.workspace_nav_open({}, { locale: "en" }) });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: m.workspace_nav_label({}, { locale: "en" })
    });
    expect(dialog).toBeInTheDocument();

    const close = within(dialog).getByRole("button", {
      name: m.workspace_nav_close({}, { locale: "en" })
    });
    await waitFor(() => expect(document.activeElement).toBe(close));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: m.workspace_nav_label({}, { locale: "en" }) })
      ).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the drawer when a destination is chosen", async () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: m.workspace_nav_open({}, { locale: "en" }) }));
    const dialog = await screen.findByRole("dialog", {
      name: m.workspace_nav_label({}, { locale: "en" })
    });

    fireEvent.click(within(dialog).getByRole("link", { name: m.nav_sheets({}, { locale: "en" }) }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: m.workspace_nav_label({}, { locale: "en" }) })
      ).not.toBeInTheDocument();
    });
  });
});

describe("current route matching", () => {
  it("keeps the workspace root current only on an exact match", () => {
    expect(isCurrentRoute("/workspace", "/workspace")).toBe(true);
    expect(isCurrentRoute("/workspace", "/workspace/files")).toBe(false);
  });

  it("treats a nested path as current for its section", () => {
    expect(isCurrentRoute("/workspace/documents", "/workspace/documents")).toBe(true);
    expect(isCurrentRoute("/workspace/documents", "/workspace/documents/abc")).toBe(true);
    expect(isCurrentRoute("/workspace/documents", "/workspace/files")).toBe(false);
  });
});
