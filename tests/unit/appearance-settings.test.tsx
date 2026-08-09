import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettings } from "@/components/workspace/appearance-settings";
import { defaultUserPreferences } from "@/lib/contracts/auth";
import { PreferenceProvider, useAppPreferences } from "@/lib/client/preferences/preference-context";

function BoundAppearance({ locale = "en" }: { locale?: "en" | "id" }) {
  const { reconcileAccountPreferences } = useAppPreferences();
  useEffect(() => {
    void reconcileAccountPreferences("test-user", defaultUserPreferences);
  }, [reconcileAccountPreferences]);
  return <AppearanceSettings locale={locale} />;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.dataset.theme = "light";
  document.documentElement.dataset.themePreference = "system";
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Appearance settings", () => {
  it("shows visual theme choices and applies theme and contrast", async () => {
    render(
      <PreferenceProvider>
        <BoundAppearance />
      </PreferenceProvider>
    );

    expect(screen.getByRole("radio", { name: /System/ })).toHaveAttribute("aria-checked", "true");
    expect(document.querySelectorAll(".aksa-theme-card__preview")).toHaveLength(3);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Dark" })).toBeEnabled());

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    fireEvent.click(screen.getByRole("radio", { name: "Increased contrast" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("dark");
    expect(document.documentElement).toHaveClass("high-contrast");

  });

  it("renders natural Indonesian labels", () => {
    render(
      <PreferenceProvider initialLocale="id">
        <BoundAppearance locale="id" />
      </PreferenceProvider>
    );

    expect(screen.getByRole("radio", { name: /Sistem/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Kontras lebih tinggi" })).toBeInTheDocument();
  });
});
