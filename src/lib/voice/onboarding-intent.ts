import {
  type OnboardingVoiceColor,
  type OnboardingVoiceDemoState,
  type OnboardingVoiceIntentResult
} from "@/lib/contracts/onboarding-voice";

function unknownIntent(): OnboardingVoiceIntentResult {
  return { intent: "unknown", color: null };
}

export function normalizeOnboardingTranscript(transcript: string): string {
  return transcript
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorFromEnglish(value: string): OnboardingVoiceColor | null {
  if (value === "yellow" || value === "blue" || value === "red") return value;
  return null;
}

function colorFromIndonesian(value: string): OnboardingVoiceColor | null {
  if (value === "kuning") return "yellow";
  if (value === "biru") return "blue";
  if (value === "merah") return "red";
  return null;
}

/** Small deterministic path for obvious commands. Paraphrases use semantic fallback. */
export function matchOnboardingVoiceIntent(
  transcript: string,
  locale: "en" | "id"
): OnboardingVoiceIntentResult {
  const heard = normalizeOnboardingTranscript(transcript);

  if (locale === "en") {
    if (/^(?:check|tick|enable|turn on)\s+(?:the\s+)?include sources(?:\s+checkbox)?$/.test(heard)) {
      return { intent: "check_include_sources", color: null };
    }
    if (/^(?:uncheck|disable|turn off)\s+(?:the\s+)?include sources(?:\s+checkbox)?$/.test(heard)) {
      return { intent: "uncheck_include_sources", color: null };
    }

    const colorMatch = /^(?:change|set|make)\s+(?:the\s+)?highlight(?:\s+color)?\s*(?:to\s+)?(yellow|blue|red)$/.exec(
      heard
    );
    const color = colorMatch ? colorFromEnglish(colorMatch[1]) : null;
    if (color !== null) return { intent: "set_highlight_color", color };
    return unknownIntent();
  }

  if (/^(?:centang|aktifkan)\s+(?:(?:bagian|kotak)\s+)?sertakan sumber$/.test(heard)) {
    return { intent: "check_include_sources", color: null };
  }
  if (/^(?:hapus centang|nonaktifkan|matikan)\s+(?:(?:bagian|kotak)\s+)?sertakan sumber$/.test(heard)) {
    return { intent: "uncheck_include_sources", color: null };
  }

  const colorMatch = /^(?:ubah|ganti)\s+(?:warna\s+)?sorotan(?:nya)?\s*(?:(?:menjadi|jadi)\s+)?(kuning|biru|merah)$/.exec(
    heard
  );
  const color = colorMatch ? colorFromIndonesian(colorMatch[1]) : null;
  if (color !== null) return { intent: "set_highlight_color", color };
  return unknownIntent();
}

export function applyOnboardingVoiceIntent(
  state: OnboardingVoiceDemoState,
  result: OnboardingVoiceIntentResult
): OnboardingVoiceDemoState {
  switch (result.intent) {
    case "check_include_sources":
      return { ...state, includeSources: true };
    case "uncheck_include_sources":
      return { ...state, includeSources: false };
    case "set_highlight_color":
      return result.color === null ? state : { ...state, highlightColor: result.color };
    case "unknown":
      return state;
  }
}
