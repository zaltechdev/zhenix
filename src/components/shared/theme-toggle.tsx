
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { IconButton } from "@/components/shared/icon-button";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";

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
  const appPreferences = useOptionalAppPreferences();
  const activeIsDark = appPreferences ? appPreferences.preferences.theme === "dark" : isDark;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (appPreferences) return;
    const activeTheme = document.documentElement.dataset.theme;
    if (activeTheme === "dark" || activeTheme === "light") {
      setIsDark(activeTheme === "dark");
    } else {
      const storedTheme = window.localStorage.getItem("aksa-theme");
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
      const nextIsDark = storedTheme === "dark" || (storedTheme === null && prefersDark);
      const theme = nextIsDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      window.localStorage.setItem("aksa-theme", theme);
      document.cookie = `aksa-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      setIsDark(nextIsDark);
    }
  }, [appPreferences]);

  function toggleTheme() {
    const nextIsDark = !activeIsDark;
    setIsDark(nextIsDark);
    const theme = nextIsDark ? "dark" : "light";
    appPreferences?.updatePreferences({ theme });
    if (appPreferences) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("aksa-theme", theme);
    document.cookie = `aksa-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  }

  const ariaLabel = !mounted
    ? m.navigation_switch_to_dark({}, { locale })
    : activeIsDark
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
      <ThemeIcon dark={mounted ? activeIsDark : false} />
    </IconButton>
  );
}
