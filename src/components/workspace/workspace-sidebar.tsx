"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import {
  groupedNavigationItems,
  isCurrentRoute,
  secondaryNavigationItems,
  type NavigationItem
} from "@/components/workspace/navigation-items";
import DefaultLogo from "../../../logo/Default.svg";

/**
 * Workspace navigation.
 *
 * Labels are always visible text, never icon only, and the current route is exposed
 * with `aria-current` so it is not signalled by styling alone.
 */
function NavigationList({
  items,
  pathname,
  groupLabel,
  onNavigate
}: {
  items: NavigationItem[];
  pathname: string;
  groupLabel?: string;
  onNavigate?: () => void;
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
                aria-current={current ? "page" : undefined}
                className="aksa-nav__link"
                href={item.href as Route}
                onClick={onNavigate}
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
  onNavigate
}: {
  locale: Locale;
  pathname: string;
  onNavigate?: () => void;
}) {
  const options = { locale };
  const groups = groupedNavigationItems(locale);

  return (
    <div className="aksa-nav__inner">
      <Link className="aksa-nav__brand" href="/workspace" onClick={onNavigate}>
        <Image
          alt={m.workspace_nav_home_label({}, options)}
          height={28}
          priority
          src={DefaultLogo}
          width={88}
        />
      </Link>

      {groups.map((group) => (
        <NavigationList
          groupLabel={group.label}
          items={group.items}
          key={group.id}
          onNavigate={onNavigate}
          pathname={pathname}
        />
      ))}

      <NavigationList
        groupLabel={m.workspace_nav_secondary_group({}, options)}
        items={secondaryNavigationItems(locale)}
        onNavigate={onNavigate}
        pathname={pathname}
      />
    </div>
  );
}
