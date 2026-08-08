import { describe, expect, it, vi } from "vitest";
import { executeAksaIntent, type AksaActionDependencies } from "@/lib/client/actions/aksa-action-dispatcher";

function dependencies(): AksaActionDependencies {
  return {
    navigate: vi.fn(),
    pauseHeadControl: vi.fn(),
    resumeHeadControl: vi.fn(),
    openHeadCalibration: vi.fn(),
    setSidebarCollapsed: vi.fn()
  };
}

describe("Aksa shared action dispatcher", () => {
  it.each([
    ["NAV_HOME", "/workspace"],
    ["NAV_DOCS", "/workspace/documents"],
    ["NAV_SHEETS", "/workspace/sheets"],
    ["NAV_DRIVE", "/workspace/files"],
    ["NAV_GMAIL", "/workspace/mail"],
    ["NAV_WEB_SEARCH", "/workspace/search"],
    ["NAV_HISTORY", "/workspace/history"],
    ["NAV_ACTIVITY", "/workspace/activity"],
    ["NAV_ACCESSIBILITY", "/workspace/accessibility"],
    ["NAV_CONTROLS", "/workspace/controls"],
    ["NAV_SETTINGS", "/workspace/settings"],
    ["NAV_ACCOUNT", "/workspace/account"]
  ] as const)("routes %s through the workspace map", (intent, route) => {
    const deps = dependencies();
    executeAksaIntent(intent, deps);
    expect(deps.navigate).toHaveBeenCalledWith(route);
  });

  it("converges head-control buttons and voice intents on shared controls", () => {
    const deps = dependencies();

    executeAksaIntent("HEAD_PAUSE", deps);
    executeAksaIntent("HEAD_RESUME", deps);
    executeAksaIntent("HEAD_CALIBRATE", deps);

    expect(deps.pauseHeadControl).toHaveBeenCalledOnce();
    expect(deps.resumeHeadControl).toHaveBeenCalledOnce();
    expect(deps.openHeadCalibration).toHaveBeenCalledOnce();
  });

  it("uses one sidebar state controller", () => {
    const deps = dependencies();

    executeAksaIntent("SIDEBAR_COLLAPSE", deps);
    executeAksaIntent("SIDEBAR_EXPAND", deps);

    expect(deps.setSidebarCollapsed).toHaveBeenNthCalledWith(1, true);
    expect(deps.setSidebarCollapsed).toHaveBeenNthCalledWith(2, false);
  });
});
