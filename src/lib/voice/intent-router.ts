import {
  aksaIntentResolutionSchema,
  type AksaIntent,
  type AksaIntentResolution
} from "@/lib/contracts/voice-intent";
import type { CommandLocale } from "@/lib/contracts/command";
import type { AksaSemanticIntentRequest } from "@/lib/contracts/voice-intent";

type LocalePatterns = Record<CommandLocale, readonly RegExp[]>;

type IntentDefinition = {
  intent: AksaIntent;
  patterns: LocalePatterns;
};

const intentDefinitions: readonly IntentDefinition[] = [
  {
    intent: "NAV_HOME",
    patterns: {
      en: [/^(?:go|open)(?: to)? home$/],
      id: [/^(?:buka|ke) beranda$/]
    }
  },
  {
    intent: "NAV_DOCS",
    patterns: {
      en: [/^(?:open|go to) docs$/, /^(?:open|go to) documents$/],
      id: [/^buka (?:dokumen|docs)$/, /^ke dokumen$/]
    }
  },
  {
    intent: "NAV_SHEETS",
    patterns: {
      en: [/^(?:open|go to) sheets$/, /^(?:open|go to) spreadsheets$/],
      id: [/^buka (?:spreadsheet|sheets)$/, /^ke (?:spreadsheet|sheets)$/]
    }
  },
  {
    intent: "NAV_DRIVE",
    patterns: {
      en: [/^(?:open|go to) drive$/],
      id: [/^(?:buka|ke) drive$/]
    }
  },
  {
    intent: "NAV_GMAIL",
    patterns: {
      en: [/^(?:open|go to) gmail$/, /^(?:open|go to) mail$/],
      id: [/^buka (?:gmail|email)$/, /^ke (?:gmail|email)$/]
    }
  },
  {
    intent: "NAV_WEB_SEARCH",
    patterns: {
      en: [/^(?:open|go to) web search$/, /^search the web$/],
      id: [/^buka pencarian web$/, /^cari di web$/]
    }
  },
  {
    intent: "NAV_HISTORY",
    patterns: {
      en: [/^(?:open|go to) history$/],
      id: [/^(?:buka|lihat) riwayat$/]
    }
  },
  {
    intent: "NAV_ACTIVITY",
    patterns: {
      en: [/^open activity$/, /^show activity$/],
      id: [/^(?:buka|lihat) aktivitas$/]
    }
  },
  {
    intent: "NAV_ACCESSIBILITY",
    patterns: {
      en: [/^open accessibility$/, /^accessibility settings$/],
      id: [/^buka aksesibilitas$/, /^pengaturan aksesibilitas$/]
    }
  },
  {
    intent: "NAV_CONTROLS",
    patterns: {
      en: [/^(?:open|go to) controls$/, /^control settings$/],
      id: [/^buka kontrol$/, /^ke kontrol$/, /^pengaturan kontrol$/]
    }
  },
  {
    intent: "NAV_SETTINGS",
    patterns: {
      en: [/^(?:open|go to) settings$/],
      id: [/^buka pengaturan$/, /^ke pengaturan$/]
    }
  },
  {
    intent: "NAV_ACCOUNT",
    patterns: {
      en: [/^(?:open|go to) account$/],
      id: [/^buka akun$/, /^ke akun$/]
    }
  },
  {
    intent: "HEAD_PAUSE",
    patterns: {
      en: [/^pause head control$/, /^pause pointer$/],
      id: [/^jeda kontrol kepala$/, /^jeda pointer$/, /^pause (?:kontrol kepala|head control)$/]
    }
  },
  {
    intent: "HEAD_RESUME",
    patterns: {
      en: [/^resume head control$/, /^resume pointer$/],
      id: [
        /^lanjutkan kontrol kepala$/,
        /^lanjutkan pointer$/,
        /^resume (?:kontrol kepala|head control)$/
      ]
    }
  },
  {
    intent: "HEAD_CALIBRATE",
    patterns: {
      en: [/^calibrate head control$/, /^recalibrate head control$/],
      id: [
        /^kalibrasi kontrol kepala$/,
        /^kalibrasi ulang kontrol kepala$/,
        /^kalibrasi head control$/
      ]
    }
  },
  {
    intent: "SIDEBAR_COLLAPSE",
    patterns: {
      en: [/^collapse sidebar$/, /^close sidebar$/],
      id: [/^ciutkan sidebar$/, /^tutup sidebar$/]
    }
  },
  {
    intent: "SIDEBAR_EXPAND",
    patterns: {
      en: [/^expand sidebar$/, /^open sidebar$/],
      id: [/^perluas sidebar$/, /^buka sidebar$/]
    }
  }
];

/** Normalize spoken words without deleting letters or meaningful whitespace. */
export function normalizeAksaTranscript(transcript: string): string {
  return transcript
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Return one allowlisted intent only when exactly one bounded match exists. */
export function matchAksaIntent(
  transcript: string,
  locale: CommandLocale
): AksaIntent | null {
  const normalized = normalizeAksaTranscript(transcript);
  if (!normalized) return null;

  const localeMatches = intentDefinitions.filter((definition) =>
    definition.patterns[locale].some((pattern) => pattern.test(normalized))
  );

  if (localeMatches.length === 1) return localeMatches[0].intent;
  if (localeMatches.length > 1) return null;

  const alternateLocale: CommandLocale = locale === "en" ? "id" : "en";
  const codeSwitchMatches = intentDefinitions.filter((definition) =>
    definition.patterns[alternateLocale].some((pattern) => pattern.test(normalized))
  );

  return codeSwitchMatches.length === 1 ? codeSwitchMatches[0].intent : null;
}

export type AksaSemanticClassifier = (
  request: AksaSemanticIntentRequest
) => Promise<unknown>;

/** Optional semantic boundary. Backend provider selection stays outside client code. */
export async function requestSemanticAksaIntent(
  request: AksaSemanticIntentRequest,
  fetchImpl: typeof fetch = fetch
): Promise<AksaIntentResolution> {
  try {
    const response = await fetchImpl("/api/commands/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: request.transcript,
        locale: request.locale
      })
    });
    if (!response.ok) return "UNKNOWN";

    const payload: unknown = await response.json();
    const candidate =
      typeof payload === "object" && payload !== null && "intent" in payload
        ? (payload as { intent: unknown }).intent
        : payload;
    const parsed = aksaIntentResolutionSchema.safeParse(candidate);
    return parsed.success ? parsed.data : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export async function resolveAksaIntent({
  transcript,
  locale,
  semanticClassifier = requestSemanticAksaIntent
}: AksaSemanticIntentRequest & {
  semanticClassifier?: AksaSemanticClassifier;
}): Promise<{ intent: AksaIntentResolution; source: "deterministic" | "semantic" | "unknown" }> {
  const deterministic = matchAksaIntent(transcript, locale);
  if (deterministic !== null) {
    return { intent: deterministic, source: "deterministic" };
  }

  try {
    const candidate = await semanticClassifier({ transcript, locale });
    const parsed = aksaIntentResolutionSchema.safeParse(candidate);
    if (parsed.success && parsed.data !== "UNKNOWN") {
      return { intent: parsed.data, source: "semantic" };
    }
  } catch {
    // Unavailable semantic routing must leave deterministic controls unaffected.
  }

  return { intent: "UNKNOWN", source: "unknown" };
}
