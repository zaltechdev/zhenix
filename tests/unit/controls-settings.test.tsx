import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccessibilityPreferences,
  HeadControlSettings,
  VoiceControlSettings
} from "@/components/workspace/controls-settings";
import { VoiceControlProvider } from "@/components/workspace/voice-control-context";
import { provisionalAccessibilityProfile } from "@/lib/contracts/auth";
import { HeadControlProvider } from "@/lib/client/vision/head-control-context";
import { secondaryNavigationItems } from "@/components/workspace/navigation-items";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Phase II controls settings", () => {
  it("keeps standard accessibility preferences free of head-control tuning", () => {
    render(
      <HeadControlProvider initialProfile={provisionalAccessibilityProfile} userId="controls-user">
        <AccessibilityPreferences initialProfile={provisionalAccessibilityProfile} locale="en" />
      </HeadControlProvider>
    );

    expect(screen.getByLabelText("Reduce motion")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pointer reach")).toBeNull();
    expect(screen.queryByLabelText("Selection")).toBeNull();
  });

  it("adds a dedicated Controls navigation destination", () => {
    expect(secondaryNavigationItems("en").map((item) => item.href)).toEqual([
      "/workspace/accessibility",
      "/workspace/controls",
      "/workspace/account"
    ]);
  });

  it("shows clear head presets and exposes tuning only for Custom", () => {
    render(
      <HeadControlProvider initialProfile={provisionalAccessibilityProfile} userId="controls-user">
        <HeadControlSettings initialProfile={provisionalAccessibilityProfile} locale="en" />
      </HeadControlProvider>
    );

    expect(screen.getByRole("heading", { name: "Pointer preset" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Auto/ })).toBeChecked();
    expect(screen.queryByLabelText("Pointer reach")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Custom/ }));

    expect(screen.getByLabelText("Pointer reach")).toBeInTheDocument();
    expect(screen.getByLabelText("Ignore small movements")).toBeInTheDocument();
    expect(screen.getByLabelText("Pointer steadiness")).toBeInTheDocument();
  });

  it.each([
    {
      locale: "en" as const,
      heading: "When tracking resumes",
      keep: "Keep current position",
      center: "Move to screen center",
      helper: "Pointer starting position when face is re-detected."
    },
    {
      locale: "id" as const,
      heading: "Saat pelacakan tersambung kembali",
      keep: "Pertahankan posisi terakhir",
      center: "Pindahkan ke tengah layar",
      helper: "Posisi penunjuk saat wajah kembali terdeteksi."
    }
  ])("exposes persisted reacquisition behavior in $locale", ({ locale, heading, keep, center, helper }) => {
    render(
      <HeadControlProvider initialProfile={provisionalAccessibilityProfile} userId="controls-user">
        <HeadControlSettings initialProfile={provisionalAccessibilityProfile} locale={locale} />
      </HeadControlProvider>
    );

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByText(helper)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: keep })).toBeChecked();
    const centerChoice = screen.getByRole("radio", { name: center });
    fireEvent.click(centerChoice);
    expect(centerChoice).toBeChecked();
  });

  it("renders voice control, language, and distinct dictation and command modes", () => {
    render(
      <VoiceControlProvider userId="controls-user">
        <VoiceControlSettings locale="en" />
      </VoiceControlProvider>
    );

    expect(screen.getByLabelText("Voice control on")).toBeChecked();
    expect(screen.getByRole("heading", { name: "Voice language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Dictation/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Commands/ })).toBeInTheDocument();
  });
});
