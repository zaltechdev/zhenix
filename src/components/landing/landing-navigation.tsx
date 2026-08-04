"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import DefaultLogo from "../../../logo/Default.svg";

import { Menu, Moon, Sun, X } from "lucide-react";

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

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <Moon aria-hidden="true" className="landing-icon" />
  ) : (
    <Sun aria-hidden="true" className="landing-icon" />
  );
}

function ThemeToggle({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
    const storedTheme = window.localStorage.getItem("aksa-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const nextIsDark = storedTheme === "dark" || (storedTheme === null && prefersDark);

    document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
    setIsDark(nextIsDark);
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem("aksa-theme", nextIsDark ? "dark" : "light");
  }

  const ariaLabel = !mounted
    ? m.navigation_switch_to_dark({}, { locale })
    : isDark
      ? m.navigation_switch_to_light({}, { locale })
      : m.navigation_switch_to_dark({}, { locale });

  return (
    <button
      aria-label={ariaLabel}
      className="landing-theme-control"
      data-mobile-focusable="true"
      onClick={toggleTheme}
      title={ariaLabel}
      type="button"
    >
      <ThemeIcon dark={mounted ? isDark : false} />
    </button>
  );
}

function NavigationLinks({ links, onNavigate }: { links: NavigationLink[]; onNavigate?: () => void }) {
  return (
    <>
      {links.map((link) => (
        <a className="landing-navigation__link" href={link.href} key={link.label} onClick={onNavigate}>
          {link.label}
        </a>
      ))}
    </>
  );
}

export function LandingNavigation({ locale }: { locale: Locale }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const messageOptions = { locale };
  const links: NavigationLink[] = [
    { href: "#product-preview", label: m.navigation_product({}, messageOptions) },
    { href: "#product-preview", label: m.navigation_how_it_works({}, messageOptions) },
    { href: "#product-preview", label: m.navigation_safety({}, messageOptions) },
    { href: "#product-preview", label: m.navigation_accessibility({}, messageOptions) }
  ];

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
    <header className="landing-navigation">
      <div className="landing-navigation__inner">
        <a className="landing-navigation__brand" href="#hero">
          <Image
            alt={m.navigation_home_label({}, messageOptions)}
            height={32}
            priority
            src={DefaultLogo}
            width={100}
          />
        </a>

        <nav aria-label={m.navigation_label({}, messageOptions)} className="landing-navigation__desktop-links">
          <NavigationLinks links={links} />
        </nav>

        <div className="landing-navigation__utilities">
          <LocaleSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
        </div>

        <a className="landing-button landing-button--nav" href="#product-preview">
          {m.navigation_try_aksa({}, messageOptions)}
        </a>

        <button
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
          type="button"
        >
          <MenuIcon close={isMenuOpen} />
        </button>
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
            <button
              aria-label={m.navigation_close_menu({}, messageOptions)}
              className="landing-navigation__menu-button"
              data-mobile-focusable="true"
              onClick={closeMenu}
              ref={closeButtonRef}
              type="button"
            >
              <MenuIcon close />
            </button>
          </div>
          <nav aria-label={m.navigation_label({}, messageOptions)} className="landing-navigation__mobile-links">
            <NavigationLinks links={links} onNavigate={closeMenu} />
          </nav>
          <div className="landing-navigation__mobile-controls">
            <LocaleSwitcher locale={locale} />
            <ThemeToggle locale={locale} />
          </div>
          <a className="landing-button landing-button--primary landing-navigation__mobile-cta" href="#product-preview" onClick={closeMenu}>
            {m.navigation_try_aksa({}, messageOptions)}
          </a>
        </div>
      ) : null}
    </header>
  );
}
