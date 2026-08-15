import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("renders the home composer cleanly", async () => {
    render(await WorkspaceHomePage());
    const composer = screen.getByTestId("home-composer");
    expect(composer).toBeInTheDocument();
  });
});
