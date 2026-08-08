import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessibilityControls, ACCESSIBILITY_PROFILE_AUTOSAVE_DELAY_MS } from "@/components/workspace/accessibility-controls";
import { provisionalAccessibilityProfile } from "@/lib/contracts/auth";
import { HeadControlProvider } from "@/lib/client/vision/head-control-context";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AccessibilityControls", () => {
  it("applies live values and persists only the latest debounced profile", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ outcome: "saved", profile: provisionalAccessibilityProfile })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HeadControlProvider initialProfile={provisionalAccessibilityProfile} userId="autosave-user">
        <AccessibilityControls initialProfile={provisionalAccessibilityProfile} locale="en" />
      </HeadControlProvider>
    );

    const sensitivity = screen.getByLabelText("Pointer reach");
    fireEvent.change(sensitivity, { target: { value: "61" } });
    fireEvent.change(sensitivity, { target: { value: "72" } });
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();

    await vi.advanceTimersByTimeAsync(ACCESSIBILITY_PROFILE_AUTOSAVE_DELAY_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      pointerSensitivity: 72
    });
  });
});
