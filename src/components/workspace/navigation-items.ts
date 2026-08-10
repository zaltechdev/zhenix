import {
  Accessibility,
  Activity,
  FileText,
  FolderOpen,
  Globe,
  History,
  House,
  Mail,
  Presentation,
  SlidersHorizontal,
  Table2,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

/**
 * Workspace route map.
 *
 * A closed union keeps every navigation target a real route, which typed routes
 * then verify at build time.
 */
export type WorkspaceRoute =
  | "/workspace"
  | "/workspace/documents"
  | "/workspace/sheets"
  | "/workspace/slides"
  | "/workspace/files"
  | "/workspace/mail"
  | "/workspace/search"
  | "/workspace/history"
  | "/workspace/activity"
  | "/workspace/accessibility"
  | "/workspace/controls"
  | "/workspace/settings"
  | "/workspace/account";

export type NavigationItem = {
  href: WorkspaceRoute;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

export type NavigationGroup = {
  id: string;
  label?: string;
  collapsible?: boolean;
  items: NavigationItem[];
};

export function googleWorkspaceNavigationItems(locale: Locale): NavigationItem[] {
  const options = { locale };
  return [
    { href: "/workspace/documents", label: m.nav_documents({}, options), icon: FileText },
    { href: "/workspace/sheets", label: m.nav_sheets({}, options), icon: Table2 },
    {
      href: "/workspace/slides",
      label: m.nav_slides({}, options),
      icon: Presentation
    },
    { href: "/workspace/files", label: m.nav_files({}, options), icon: FolderOpen },
    { href: "/workspace/mail", label: m.nav_mail({}, options), icon: Mail }
  ];
}

export function primaryNavigationItems(locale: Locale): NavigationItem[] {
  const options = { locale };
  return [
    { href: "/workspace", label: m.nav_home({}, options), icon: House },
    ...googleWorkspaceNavigationItems(locale),
    { href: "/workspace/search", label: m.nav_search({}, options), icon: Globe },
    { href: "/workspace/history", label: m.nav_history({}, options), icon: History },
    { href: "/workspace/activity", label: m.nav_activity({}, options), icon: Activity }
  ];
}

export function groupedNavigationItems(locale: Locale): NavigationGroup[] {
  const options = { locale };
  return [
    {
      id: "home",
      items: [{ href: "/workspace", label: m.nav_home({}, options), icon: House }]
    },
    {
      id: "google-workspace",
      label: m.nav_google_workspace_group({}, options),
      collapsible: true,
      items: googleWorkspaceNavigationItems(locale)
    },
    {
      id: "search-and-activity",
      label: m.nav_search_activity_group({}, options),
      items: [
        { href: "/workspace/search", label: m.nav_search({}, options), icon: Globe },
        { href: "/workspace/history", label: m.nav_history({}, options), icon: History },
        { href: "/workspace/activity", label: m.nav_activity({}, options), icon: Activity }
      ]
    }
  ];
}

export function secondaryNavigationItems(locale: Locale): NavigationItem[] {
  const options = { locale };
  return [
    {
      href: "/workspace/accessibility",
      label: m.nav_accessibility({}, options),
      icon: Accessibility
    },
    { href: "/workspace/controls", label: m.nav_controls({}, options), icon: SlidersHorizontal },
    { href: "/workspace/account", label: m.nav_account({}, options), icon: UserRound }
  ];
}

export function navigationLabelForPath(path: string, locale: Locale): string {
  if (path === "/workspace/settings") {
    return m.settings_heading({}, { locale });
  }
  const items = [...primaryNavigationItems(locale), ...secondaryNavigationItems(locale)];
  const match = items.find((item) => item.href === path);
  return match?.label ?? m.nav_home({}, { locale });
}

/**
 * Exact match for the workspace root, prefix match elsewhere, so `/workspace`
 * does not stay current while a child route is open.
 */
export function isCurrentRoute(itemHref: WorkspaceRoute, pathname: string): boolean {
  if (itemHref === "/workspace") {
    return pathname === "/workspace";
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
