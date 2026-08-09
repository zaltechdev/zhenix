import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteLoading } from "@/components/shared/route-loading";

const navigationMock = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname
}));

afterEach(() => cleanup());

describe("route loading skeletons", () => {
  it("keeps the public loading composition outside Workspace", () => {
    navigationMock.pathname = "/sign-in";
    const { container } = render(<RouteLoading locale="en" />);

    expect(container.querySelector(".aksa-loading-shell__card")).not.toBeNull();
    expect(container.querySelector(".aksa-workspace-loading")).toBeNull();
  });

  it("matches the Workspace home composition", () => {
    navigationMock.pathname = "/workspace";
    const { container } = render(<RouteLoading locale="en" />);

    expect(container.querySelector(".aksa-workspace-loading__sidebar")).not.toBeNull();
    expect(container.querySelector(".aksa-workspace-loading__composer")).not.toBeNull();
    expect(container.querySelector('[data-skeleton-kind="grid"]')).toBeNull();
  });

  it("uses a grid skeleton for Sheets", () => {
    navigationMock.pathname = "/workspace/sheets";
    const { container } = render(<RouteLoading locale="id" />);

    expect(container.querySelector('[data-skeleton-kind="grid"]')).not.toBeNull();
    expect(container.querySelectorAll(".aksa-workspace-loading__grid .aksa-loading-skeleton"))
      .toHaveLength(20);
  });
});
