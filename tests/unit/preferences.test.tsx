import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferenceProvider, useAppPreferences } from "@/lib/client/preferences/preference-context";
import { defaultUserPreferences, provisionalAccessibilityProfile } from "@/lib/contracts/auth";
import { HeadControlProvider, useHeadControl } from "@/lib/client/vision/head-control-context";
import { VoiceControlProvider, useVoiceControls } from "@/components/workspace/voice-control-context";

function PreferenceProbe() {
  const { preferences, reconcileAccountPreferences, updatePreferences } = useAppPreferences();

  return (
    <div>
      <output data-testid="preference-state">{JSON.stringify(preferences)}</output>
      <button onClick={() => updatePreferences({ highContrast: true, textSize: "extra_large" })} type="button">
        Update anonymous preferences
      </button>
      <button onClick={() => updatePreferences({ theme: "dark", language: "id" })} type="button">
        Update theme and language
      </button>
      <button
        onClick={() =>
          void reconcileAccountPreferences("account-1", {
            ...defaultUserPreferences,
            theme: "light",
            language: "en"
          })
        }
        type="button"
      >
        Sign in
      </button>
    </div>
  );
}

function RuntimeProbe() {
  const head = useHeadControl();
  const voice = useVoiceControls();
  const preferences = useAppPreferences();

  return (
    <>
      <output data-testid="runtime-state">
        {`${head.lifecycleState}:${voice.settings.enabled}:${preferences.preferences.theme}`}
      </output>
      <button onClick={() => preferences.updatePreferences({ theme: "dark", language: "id" })} type="button">
        Change presentation
      </button>
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.dataset.theme = "light";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("preference persistence", () => {
  it("persists anonymous presentation preferences and applies them immediately", () => {
    render(
      <PreferenceProvider>
        <PreferenceProbe />
      </PreferenceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Update anonymous preferences" }));

    const stored = JSON.parse(window.localStorage.getItem("aksa-preferences:anonymous") ?? "{}");
    expect(stored).toMatchObject({ highContrast: true, textSize: "extra_large" });
    expect(document.documentElement).toHaveClass("high-contrast", "text-size-extra-large");
  });

  it("merges explicitly changed anonymous fields into the signed-in account snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          outcome: "saved",
          preferences: { ...defaultUserPreferences, highContrast: true, textSize: "extra_large" }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PreferenceProvider>
        <PreferenceProbe />
      </PreferenceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Update anonymous preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(saved).toMatchObject({ highContrast: true, textSize: "extra_large", theme: "light" });
    expect(JSON.parse(screen.getByTestId("preference-state").textContent ?? "{}")).toMatchObject({
      highContrast: true,
      textSize: "extra_large"
    });
  });

  it("saves signed-in changes without clearing the rest of the account snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ outcome: "saved", preferences: { ...defaultUserPreferences, theme: "dark", language: "id" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PreferenceProvider>
        <PreferenceProbe />
      </PreferenceProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("preference-state").textContent ?? "{}")).toMatchObject({
        theme: "light",
        language: "en"
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Update theme and language" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      theme: "dark",
      language: "id",
      voiceControlEnabled: true
    });
  });

  it("keeps head and voice runtime state mounted across presentation changes", () => {
    const engineFactory = () => ({
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      disable: vi.fn(),
      setNeutralBaseline: vi.fn()
    });

    render(
      <PreferenceProvider>
        <HeadControlProvider engineFactory={engineFactory} initialProfile={provisionalAccessibilityProfile}>
          <VoiceControlProvider userId="account-1">
            <RuntimeProbe />
          </VoiceControlProvider>
        </HeadControlProvider>
      </PreferenceProvider>
    );

    const runtimeState = screen.getByTestId("runtime-state");
    fireEvent.click(screen.getByRole("button", { name: "Change presentation" }));

    expect(runtimeState).toHaveTextContent("idle:true:dark");
  });
});
