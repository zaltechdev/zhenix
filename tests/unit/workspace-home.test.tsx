import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import WorkspaceHomePage from "@/app/workspace/page";

vi.mock("@/lib/i18n/request", () => ({
  getRequestLocale: async () => "en"
}));

vi.mock("@/lib/server/tasks/service", () => ({
  readTaskHistory: async () => ({ status: "ready", data: { tasks: [] } })
}));

vi.mock("@/lib/server/workspace/service", () => ({
  readWorkspaceContext: async () => ({
    session: { status: "anonymous" },
    capabilities: {},
    connection: { state: "not_connected", accountEmail: null, grantedCapabilities: [], checkedAt: 0 },
    activeTask: { status: "ready", data: null },
    limits: {},
    accessibilityProfile: null,
    preferences: null
  })
}));

vi.mock("@/components/workspace/command-composer", () => ({
  CommandComposer: () => <div data-testid="home-composer" />
}));

vi.mock("@/components/workspace/compact-setup-state", () => ({
  CompactSetupState: () => null
}));
vi.mock("@/components/workspace/welcome-header", () => ({
  WelcomeHeader: () => null
}));
vi.mock("@/components/workspace/quick-start-suggestions", () => ({
  QuickStartSuggestions: () => null
}));
vi.mock("@/components/workspace/recent-work-column", () => ({
  RecentWorkColumn: () => null
}));
vi.mock("@/components/workspace/google-workspace-launchpad", () => ({
  GoogleWorkspaceLaunchpad: () => null
}));

afterEach(() => cleanup());

describe("workspace home composer", () => {
  it("places the AI disclaimer below the home composer", async () => {
    const view = render(await WorkspaceHomePage());
    const composer = screen.getByTestId("home-composer");
    const disclaimer = screen.getByText(m.workspace_ai_disclaimer({}, { locale: "en" }));

    expect(composer.compareDocumentPosition(disclaimer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.container.querySelector(".aksa-ai-disclaimer")).toBe(disclaimer);
  });
});
