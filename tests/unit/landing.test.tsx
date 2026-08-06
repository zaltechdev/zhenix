import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText(m.hero_description({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: m.hero_primary_action({}, { locale: "en" }) })).toHaveLength(3);
    expect(screen.getByRole("link", { name: m.hero_secondary_action({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: m.hero_secondary_action({}, { locale: "en" }) })).toHaveAttribute(
      "href",
      "#how-it-works"
    );
  });

  it("renders localized Indonesian content", () => {
    render(<LandingPage locale="id" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_first({}, { locale: "id" })
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      m.hero_headline_second({}, { locale: "id" })
    );
    expect(screen.getByText(m.hero_description({}, { locale: "id" }))).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: m.hero_primary_action({}, { locale: "id" }) })).toHaveLength(3);
  });

  it("exposes accessible navigation controls", () => {
    render(<LandingPage locale="en" />);

    expect(screen.getByRole("navigation", { name: m.navigation_label({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: m.navigation_features({}, { locale: "en" }) })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: m.navigation_how_it_works({}, { locale: "en" }) })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: m.navigation_faq({}, { locale: "en" }) })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: m.language_switcher_label({}, { locale: "en" }) })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: m.navigation_switch_to_dark({}, { locale: "en" }) })).toHaveLength(2);
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

  it("renders the required landing sections and exact anchors", () => {
    render(<LandingPage locale="en" />);

    for (const id of ["top", "features", "how-it-works", "accessibility", "faq"]) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }

    expect(screen.getAllByRole("article")).toHaveLength(11);
    expect(screen.getByRole("heading", { name: m.final_cta_heading({}, { locale: "en" }) })).toBeInTheDocument();
  });

  it("keeps the how-it-works demo and FAQ keyboard-operable", () => {
    render(<LandingPage locale="en" />);

    const speakTab = screen.getByRole("tab", { name: m.how_step_speak_label({}, { locale: "en" }) });
    expect(speakTab).toHaveAttribute("aria-selected", "false");
    fireEvent.click(speakTab);
    expect(speakTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(m.how_speak_detail_2({}, { locale: "en" }));
    fireEvent.keyDown(speakTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: m.how_step_confirm_label({}, { locale: "en" }) })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: m.how_pause({}, { locale: "en" }) }));
    expect(screen.getByRole("button", { name: m.how_resume({}, { locale: "en" }) })).toBeInTheDocument();

    const faqTrigger = screen.getByRole("button", { name: m.faq_question_hardware({}, { locale: "en" }) });
    expect(faqTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(faqTrigger);
    expect(faqTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(m.faq_answer_hardware({}, { locale: "en" }))).toBeVisible();
  });

  it("exposes accessible floating accessibility widget", () => {
    render(<LandingPage locale="en" />);

    expect(
      screen.getByRole("button", { name: m.accessibility_widget_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });
});
