
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { IconButton } from "@/components/shared/icon-button";

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <Moon aria-hidden="true" className="landing-icon" />
  ) : (
    <Sun aria-hidden="true" className="landing-icon" />
  );
}

export function ThemeToggle({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = window.localStorage.getItem("aksa-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const nextIsDark = storedTheme === "dark" || (storedTheme === null && prefersDark);
    document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
    // Always persist so other pages can read it via the blocking script
    window.localStorage.setItem("aksa-theme", nextIsDark ? "dark" : "light");
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
    <IconButton
      aria-label={ariaLabel}
      className="landing-theme-control"
      data-mobile-focusable="true"
      onClick={toggleTheme}
      title={ariaLabel}
    >
      <ThemeIcon dark={mounted ? isDark : false} />
    </IconButton>
  );
}
