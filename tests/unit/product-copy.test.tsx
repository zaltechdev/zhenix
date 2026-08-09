import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickStartSuggestions } from "@/components/workspace/quick-start-suggestions";
import { CommandProvider } from "@/components/workspace/command-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

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

  it("keeps the real Docs prompt and routes preview prompts to labelled surfaces", () => {
    render(
      <CommandProvider>
        <QuickStartSuggestions locale="en" />
      </CommandProvider>
    );

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Summarize a document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read a sheet range" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search the web with sources" })).toBeInTheDocument();
  });
});
