import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuickStartSuggestions } from "@/components/workspace/quick-start-suggestions";
import { CommandProvider } from "@/components/workspace/command-context";

describe("production product copy", () => {
  it("contains no deployment diagnostics or fabricated-data language", () => {
    const forbidden = /Developer details|not configured|missing configuration|deployment|environment|AUTH_SECRET|GOOGLE_CLIENT|fallback|sample data|\bmock\b/i;

    for (const locale of ["en", "id"]) {
      const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Record<string, string>;
      const productValues = Object.entries(messages)
        .filter(([key]) => !key.startsWith("preview_"))
        .map(([, value]) => value);
      expect(productValues.filter((value) => forbidden.test(value))).toEqual([]);
    }
  });

  it("offers only a command backed by the real Docs runner", () => {
    render(
      <CommandProvider>
        <QuickStartSuggestions locale="en" />
      </CommandProvider>
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Open my latest assignment" })).toBeInTheDocument();
    expect(screen.queryByText(/sheet|web search/i)).not.toBeInTheDocument();
  });
});
