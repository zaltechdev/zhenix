import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { LandingPage } from "@/components/landing/landing-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe("landing hero", () => {
  it("renders localized English headline and actions", () => {
    render(<LandingPage locale="en" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_first({}, { locale: "en" })
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_second({}, { locale: "en" })
    );
    expect(screen.getByText(m.hero_description_prefix({}, { locale: "en" }).trim())).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: m.hero_primary_action({}, { locale: "en" }) })).toHaveLength(2);
    expect(screen.getByRole("link", { name: m.hero_secondary_action({}, { locale: "en" }) })).toBeInTheDocument();
  });

  it("renders localized Indonesian content", () => {
    render(<LandingPage locale="id" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_first({}, { locale: "id" })
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_second({}, { locale: "id" })
    );
    expect(screen.getByText(m.hero_description_prefix({}, { locale: "id" }).trim())).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: m.hero_primary_action({}, { locale: "id" }) })).toHaveLength(2);
  });

  it("exposes accessible navigation controls", () => {
    render(<LandingPage locale="en" />);

    expect(screen.getByRole("navigation", { name: m.navigation_label({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: m.navigation_product({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.language_switcher_label({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.navigation_switch_to_dark({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.navigation_open_menu({}, { locale: "en" }) })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("marks product preview as illustrative and equivalent", () => {
    render(<LandingPage locale="en" />);

    const preview = screen.getByRole("figure", { name: m.preview_assignment_title({}, { locale: "en" }) });

    expect(preview).toHaveAttribute("data-preview-type", "illustrative");
    expect(within(preview).getByText(m.preview_status_message({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      within(preview).getByRole("button", { name: m.preview_voice_control_label({}, { locale: "en" }) })
    ).toBeDisabled();
    expect(within(preview).getByText(m.preview_text_equivalent({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("exposes accessible floating accessibility widget", () => {
    render(<LandingPage locale="en" />);

    expect(
      screen.getByRole("button", { name: m.accessibility_widget_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });
});
