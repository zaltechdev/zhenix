import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccessibilityWidget } from "@/components/shared/accessibility-widget";
import { PreferenceProvider } from "@/lib/client/preferences/preference-context";
import { m } from "@/paraglide/messages.js";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => cleanup());

describe("accessibility quick panel", () => {
  it("remains mounted globally across every application surface", () => {
    const rootLayout = readFileSync("src/app/layout.tsx", "utf8");

    expect(rootLayout).toContain('<AccessibilityWidget locale={locale} />');
  });

  it("offers configurable text size, high contrast, and reduced motion", () => {
    render(
      <PreferenceProvider>
        <AccessibilityWidget locale="en" />
      </PreferenceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: m.accessibility_widget_title({}, { locale: "en" }) }));

    const textSize = screen.getByRole("combobox", {
      name: m.accessibility_text_size_label({}, { locale: "en" })
    });
    expect(textSize).toHaveValue("default");
    expect(screen.getByRole("option", { name: m.accessibility_text_size_extra_large({}, { locale: "en" }) })).toBeInTheDocument();

    fireEvent.change(textSize, { target: { value: "extra_large" } });
    fireEvent.click(screen.getByRole("button", { name: m.accessibility_high_contrast({}, { locale: "en" }) }));
    fireEvent.click(screen.getByRole("button", { name: m.accessibility_reduce_motion({}, { locale: "en" }) }));

    expect(document.documentElement).toHaveClass("text-size-extra-large", "high-contrast", "reduce-motion");
    expect(document.querySelector(".landing-a11y-option__motion-icon")).toContainHTML("<svg");
    expect(JSON.parse(window.localStorage.getItem("aksa-preferences:anonymous") ?? "{}")).toMatchObject({
      highContrast: true,
      textSize: "extra_large",
      reducedMotion: true
    });
  });
});
