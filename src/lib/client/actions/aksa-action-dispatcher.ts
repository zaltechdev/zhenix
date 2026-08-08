import type { AksaIntent } from "@/lib/contracts/voice-intent";
import type { WorkspaceRoute } from "@/components/workspace/navigation-items";

export type AksaActionDependencies = {
  navigate: (route: WorkspaceRoute) => void;
  pauseHeadControl: () => void;
  resumeHeadControl: () => void;
  openHeadCalibration: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const navigationRoutes: Partial<Record<AksaIntent, WorkspaceRoute>> = {
  NAV_HOME: "/workspace",
  NAV_DOCS: "/workspace/documents",
  NAV_SHEETS: "/workspace/sheets",
  NAV_DRIVE: "/workspace/files",
  NAV_GMAIL: "/workspace/mail",
  NAV_WEB_SEARCH: "/workspace/search",
  NAV_HISTORY: "/workspace/history",
  NAV_ACTIVITY: "/workspace/activity",
  NAV_ACCESSIBILITY: "/workspace/accessibility",
  NAV_SETTINGS: "/workspace/settings",
  NAV_ACCOUNT: "/workspace/account"
};

export function executeAksaIntent(
  intent: AksaIntent,
  dependencies: AksaActionDependencies
): AksaIntent {
  const route = navigationRoutes[intent];
  if (route) {
    dependencies.navigate(route);
    return intent;
  }

  switch (intent) {
    case "HEAD_PAUSE":
      dependencies.pauseHeadControl();
      break;
    case "HEAD_RESUME":
      dependencies.resumeHeadControl();
      break;
    case "HEAD_CALIBRATE":
      dependencies.openHeadCalibration();
      break;
    case "SIDEBAR_COLLAPSE":
      dependencies.setSidebarCollapsed(true);
      break;
    case "SIDEBAR_EXPAND":
      dependencies.setSidebarCollapsed(false);
      break;
  }

  return intent;
}
