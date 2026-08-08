"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import {
  groupedNavigationItems,
  isCurrentRoute,
  secondaryNavigationItems,
  type NavigationItem
} from "@/components/workspace/navigation-items";
import { useOptionalAksaActions } from "@/components/workspace/aksa-action-context";
import DefaultLogo from "../../../logo/Default.svg";
import AksaIcon from "../../../logo/Icon.png";

/**
 * Workspace navigation.
 *
 * Expanded links show labels; collapsed links retain names, tooltips, and `aria-current`.
 */
function NavigationList({
  items,
  pathname,
  groupLabel,
  onNavigate,
  collapsed
}: {
  items: NavigationItem[];
  pathname: string;
  groupLabel?: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  return (
    <div className="aksa-nav__group">
      {groupLabel && <h2 className="aksa-nav__group-heading">{groupLabel}</h2>}
      <ul className="aksa-nav__list">
        {items.map((item) => {
          const current = isCurrentRoute(item.href, pathname);
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  className="aksa-nav__link aksa-nav__link--disabled"
                  data-tooltip={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon aria-hidden="true" className="aksa-icon" />
                  <span className="aksa-nav__label">{item.label}</span>
                  {item.badge && <span className="aksa-nav__badge aksa-nav__badge--nowrap">{item.badge}</span>}
                </span>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                aria-label={item.label}
                aria-current={current ? "page" : undefined}
                className="aksa-nav__link"
                data-tooltip={collapsed ? item.label : undefined}
                href={item.href as Route}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
              >
                <Icon aria-hidden="true" className="aksa-icon" />
                <span className="aksa-nav__label">{item.label}</span>
                {item.badge && <span className="aksa-nav__badge aksa-nav__badge--nowrap">{item.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WorkspaceSidebar({
  locale,
  pathname,
  onNavigate,
  collapsed,
  showCollapseControl = true
}: {
  locale: Locale;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  showCollapseControl?: boolean;
}) {
  const options = { locale };
  const groups = groupedNavigationItems(locale);
  const actions = useOptionalAksaActions();
  const isCollapsed = collapsed ?? actions?.sidebarCollapsed ?? false;

  return (
    <div className="aksa-nav__inner">
      <div className="aksa-nav__brand-row">
        {isCollapsed && showCollapseControl ? (
          <button
            aria-controls="workspace-desktop-sidebar"
            aria-expanded="false"
            aria-label={m.workspace_sidebar_expand({}, options)}
            className="aksa-nav__brand aksa-nav__brand--expand"
            onClick={() => actions?.executeAksaIntent("SIDEBAR_EXPAND")}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="aksa-nav__brand-icon"
              height={32}
              priority
              src={AksaIcon}
              width={32}
            />
            <span className="sr-only">{m.workspace_sidebar_expand({}, options)}</span>
          </button>
        ) : (
          <Link className="aksa-nav__brand" href="/workspace" onClick={onNavigate}>
            <Image
              alt={m.workspace_nav_home_label({}, options)}
              className="aksa-nav__brand-wordmark"
              height={28}
              priority
              src={DefaultLogo}
              width={88}
            />
          </Link>
        )}

        {showCollapseControl && !isCollapsed ? (
          <button
            aria-controls="workspace-desktop-sidebar"
            aria-expanded="true"
            aria-label={m.workspace_sidebar_collapse({}, options)}
            className="aksa-nav__collapse"
            onClick={() => actions?.executeAksaIntent("SIDEBAR_COLLAPSE")}
            type="button"
          >
            <PanelLeftClose aria-hidden="true" className="aksa-icon" />
            <span className="sr-only">{m.workspace_sidebar_collapse({}, options)}</span>
          </button>
        ) : null}
      </div>

      {groups.map((group) => (
        <NavigationList
          collapsed={isCollapsed}
          groupLabel={group.label}
          items={group.items}
          key={group.id}
          onNavigate={onNavigate}
          pathname={pathname}
        />
      ))}

      <NavigationList
        collapsed={isCollapsed}
        groupLabel={m.workspace_nav_secondary_group({}, options)}
        items={secondaryNavigationItems(locale)}
        onNavigate={onNavigate}
        pathname={pathname}
      />
    </div>
  );
}
