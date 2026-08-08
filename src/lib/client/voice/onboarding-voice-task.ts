import type { Locale } from "@/paraglide/runtime.js";

function normalize(transcript: string): string {
  return transcript.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Local-only matcher for onboarding practice commands. No agent or network execution. */
export function matchesOnboardingOptionOne(transcript: string, locale: Locale): boolean {
  const heard = normalize(transcript);
  const accepted = locale === "id"
    ? ["centang opsi satu", "pilih opsi satu", "pilih pilihan satu"]
    : ["check option one", "select option one", "choose option one"];
  return accepted.some((phrase) => heard === phrase);
}
