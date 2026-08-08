import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";

const routerRefresh = vi.hoisted(() => vi.fn());
const setLocaleMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh })
}));

vi.mock("@/paraglide/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/paraglide/runtime.js")>()),
  setLocale: setLocaleMock
}));

afterEach(() => {
  cleanup();
  routerRefresh.mockReset();
  setLocaleMock.mockReset();
});

describe("locale switcher runtime continuity", () => {
  it("refreshes server content without unmounting mounted controls", () => {
    const unmounted = vi.fn();
    function RuntimeSentinel() {
      useEffect(() => unmounted, []);
      return <LocaleSwitcher locale="en" />;
    }

    render(<RuntimeSentinel />);
    fireEvent.click(
      screen.getByRole("button", {
        name: m.language_switcher_label({}, { locale: "en" })
      })
    );
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: m.language_indonesian({}, { locale: "en" })
      })
    );

    expect(setLocaleMock).toHaveBeenCalledWith("id", { reload: false });
    expect(routerRefresh).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
  });
});
