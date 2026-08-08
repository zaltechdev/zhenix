import { describe, expect, it } from "vitest";
import { matchesOnboardingOptionOne } from "@/lib/client/voice/onboarding-voice-task";

describe("onboarding voice task", () => {
  it("accepts the deterministic English practice command", () => {
    expect(matchesOnboardingOptionOne("Select option one.", "en")).toBe(true);
    expect(matchesOnboardingOptionOne("Select option two", "en")).toBe(false);
  });

  it("accepts natural Indonesian command variants", () => {
    expect(matchesOnboardingOptionOne("Centang opsi satu", "id")).toBe(true);
    expect(matchesOnboardingOptionOne("pilih pilihan satu!", "id")).toBe(true);
    expect(matchesOnboardingOptionOne("pilih opsi dua", "id")).toBe(false);
  });
});
