import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/request", () => ({
  getRequestLocale: async () => "en"
}));

import Loading from "@/app/loading";

describe("loading shell", () => {
  it("uses a stable destination-shaped shell instead of a giant spinner", async () => {
    const view = render(await Loading());

    expect(view.container.querySelector(".aksa-loading-shell")).toHaveAttribute("aria-busy", "true");
    expect(view.container.querySelectorAll(".aksa-loading-skeleton").length).toBeGreaterThan(0);
    expect(view.container.querySelector(".aksa-button__loading-indicator")).toBeNull();
  });
});
