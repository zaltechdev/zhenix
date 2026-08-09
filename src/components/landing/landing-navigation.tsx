"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ButtonLink } from "@/components/shared/button";
import { IconButton } from "@/components/shared/icon-button";
import DefaultLogo from "../../../logo/Default.svg";

import { Menu, X } from "lucide-react";

type NavigationLink = {
  href: string;
  label: string;
};

function MenuIcon({ close = false }: { close?: boolean }) {
  return close ? (
    <X aria-hidden="true" className="landing-icon" />
  ) : (
    <Menu aria-hidden="true" className="landing-icon" />
  );
}

function NavigationLinks({
  links,
  activeHref,
  onNavigate
}: {
  links: NavigationLink[];
  activeHref?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {links.map((link) => {
        const isActive = activeHref === link.href;
        return (
          <a
            aria-current={isActive ? "location" : undefined}
            className={`landing-navigation__link ${isActive ? "is-active" : ""}`}
            href={link.href}
            key={link.label}
            onClick={onNavigate}
          >
            {link.label}
          </a>
        );
      })}
    </>
  );
}

export function MarketingHeader({ locale }: { locale: Locale }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("");
  const navigationRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navigationInnerRef = useRef<HTMLDivElement>(null);
  const messageOptions = { locale };
  const links: NavigationLink[] = [
    { href: "#features", label: m.navigation_features({}, messageOptions) },
    { href: "#how-it-works", label: m.navigation_how_it_works({}, messageOptions) },
    { href: "#faq", label: m.navigation_faq({}, messageOptions) }
  ];

  useEffect(() => {
    let frameId: number | null = null;
    let targetProgress = 0;
    let displayedProgress = 0;
    const smoothingFactor = 0.12;

    function updateNavigation(progress: number) {
      frameId = null;

      const inner = navigationInnerRef.current;
      if (!inner) {
        return;
      }

      const availableWidth = Math.max(0, document.documentElement.clientWidth - 32);
      const wideWidth = Math.min(1472, availableWidth);
      const floatingWidth = Math.min(960, availableWidth);
      const widePadding = window.innerWidth >= 1024 ? 48 : window.innerWidth >= 768 ? 32 : 24;
      const surfaceProgress = progress * progress * progress * progress;
      const filterProgress = surfaceProgress * surfaceProgress;
      const interpolate = (from: number, to: number) => from + (to - from) * progress;

      navigationRef.current?.style.setProperty("--landing-navigation-top-offset", `${interpolate(0, 12)}px`);
      inner.style.setProperty("--landing-navigation-progress", progress.toFixed(4));
      inner.style.setProperty("--landing-navigation-surface-progress", surfaceProgress.toFixed(4));
      inner.style.setProperty("--landing-navigation-filter-progress", filterProgress.toFixed(4));
      inner.style.setProperty("--landing-navigation-width", `${interpolate(wideWidth, floatingWidth)}px`);
      inner.style.setProperty("--landing-navigation-padding-block", `${interpolate(8, 6)}px`);
      inner.style.setProperty("--landing-navigation-padding-inline", `${interpolate(widePadding, 28)}px`);
      inner.style.setProperty("--landing-navigation-radius", `${interpolate(0, 24)}px`);
      inner.style.setProperty("--landing-navigation-min-height", `${interpolate(72, 68)}px`);

      const sectionIds = ["features", "how-it-works", "faq"];
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180 && rect.bottom >= 180) {
            current = `#${id}`;
            break;
          }
        }
      }
      setActiveHref((prev) => (prev !== current ? current : prev));
    }

    function animateNavigation() {
      frameId = null;
      displayedProgress += (targetProgress - displayedProgress) * smoothingFactor;

      if (Math.abs(targetProgress - displayedProgress) < 0.001) {
        displayedProgress = targetProgress;
      }

      updateNavigation(displayedProgress);

      if (displayedProgress !== targetProgress) {
        frameId = window.requestAnimationFrame(animateNavigation);
      }
    }

    function requestNavigationUpdate() {
      targetProgress = Math.min(1, Math.max(0, window.scrollY / 80));

      if (frameId === null) {
        frameId = window.requestAnimationFrame(animateNavigation);
      }
    }

    requestNavigationUpdate();
    window.addEventListener("scroll", requestNavigationUpdate, { passive: true });
    window.addEventListener("resize", requestNavigationUpdate);
    return () => {
      window.removeEventListener("scroll", requestNavigationUpdate);
      window.removeEventListener("resize", requestNavigationUpdate);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const menu = document.getElementById("mobile-navigation");
      const focusableElements = menu?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])",
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="landing-navigation" ref={navigationRef}>
      <div className="landing-navigation__inner" ref={navigationInnerRef}>
        <a className="landing-navigation__brand" href="#top">
          <Image
            alt={m.navigation_home_label({}, messageOptions)}
            height={32}
            priority
            src={DefaultLogo}
            width={100}
          />
        </a>

        <nav aria-label={m.navigation_label({}, messageOptions)} className="landing-navigation__desktop-links">
          <NavigationLinks activeHref={activeHref} links={links} />
        </nav>

        <div className="landing-navigation__utilities">
          <LocaleSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
          <ButtonLink className="landing-navigation__cta" href="/sign-in" size="sm" variant="primary">
            {m.navigation_try_aksa({}, messageOptions)}
          </ButtonLink>
        </div>

        <IconButton
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={
            isMenuOpen
              ? m.navigation_close_menu({}, messageOptions)
              : m.navigation_open_menu({}, messageOptions)
          }
          className="landing-navigation__menu-button"
          onClick={() => setIsMenuOpen((open) => !open)}
          ref={menuButtonRef}
        >
          <MenuIcon close={isMenuOpen} />
        </IconButton>
      </div>

      {isMenuOpen ? (
        <div
          aria-labelledby="mobile-navigation-title"
          aria-modal="true"
          className="landing-navigation__mobile-panel"
          id="mobile-navigation"
          role="dialog"
        >
          <div className="landing-navigation__mobile-panel-header">
            <h2 id="mobile-navigation-title">{m.navigation_label({}, messageOptions)}</h2>
            <IconButton
              aria-label={m.navigation_close_menu({}, messageOptions)}
              className="landing-navigation__menu-button"
              data-mobile-focusable="true"
              onClick={closeMenu}
              ref={closeButtonRef}
            >
              <MenuIcon close />
            </IconButton>
          </div>
          <nav aria-label={m.navigation_label({}, messageOptions)} className="landing-navigation__mobile-links">
            <NavigationLinks links={links} onNavigate={closeMenu} />
          </nav>
          <div className="landing-navigation__mobile-controls">
            <LocaleSwitcher locale={locale} />
            <ThemeToggle locale={locale} />
          </div>
          <ButtonLink
            className="landing-navigation__mobile-cta"
            href="/sign-in"
            onClick={closeMenu}
            size="md"
            variant="primary"
          >
            {m.navigation_try_aksa({}, messageOptions)}
          </ButtonLink>
        </div>
      ) : null}
    </header>
  );
}

export const LandingNavigation = MarketingHeader;
