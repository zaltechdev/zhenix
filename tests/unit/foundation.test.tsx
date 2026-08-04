import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoundationView } from "@/components/foundation/foundation-view";
import { m } from "@/paraglide/messages.js";

describe("foundation page", () => {
  it("renders the localized foundation status", () => {
    render(<FoundationView locale="en" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(m.foundation_title({}, { locale: "en" }));
    expect(screen.getByRole("status")).toHaveTextContent(m.foundation_ready({}, { locale: "en" }));
  });
});
