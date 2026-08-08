/**
 * Minimal typing for the browser speech recognition API.
 *
 * Declared locally rather than pulling in another dependency. Availability is
 * always detected before a microphone control is offered, so Aksa never shows a
 * control it cannot honour. See `.agents/prd.md` FR-V4.
 */

export type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

export type SpeechRecognitionResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};

export type SpeechRecognitionResultListLike = {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
};

export type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = {
  readonly error: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as SpeechRecognitionWindow;
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return speechRecognitionConstructor() !== null;
}

/** BCP 47 tags for the two supported locales. */
export function recognitionLanguage(locale: "en" | "id"): string {
  return locale === "id" ? "id-ID" : "en-US";
}

export function createRecognition(locale: "en" | "id"): SpeechRecognitionLike | null {
  const Constructor = speechRecognitionConstructor();
  if (Constructor === null) {
    return null;
  }

  const recognition = new Constructor();
  recognition.lang = recognitionLanguage(locale);
  recognition.continuous = false;
  recognition.interimResults = true;
  // Indonesian recognition benefits from alternatives where browser speech services
  // expose regional pronunciation choices. The selected transcript remains verbatim.
  recognition.maxAlternatives = locale === "id" ? 3 : 1;
  return recognition;
}

export function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  return transcriptAlternativesFromEvent(event)[0] ?? "";
}

export function finalTranscriptAlternativesFromEvent(
  event: SpeechRecognitionEventLike
): string[] {
  return transcriptAlternativesFromEvent(event, true);
}

function transcriptAlternativesFromEvent(
  event: SpeechRecognitionEventLike,
  finalOnly = false
): string[] {
  const segments: SpeechRecognitionAlternative[][] = [];

  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (result.length === 0 || (finalOnly && !result.isFinal)) continue;

    const alternatives = Array.from({ length: result.length }, (_, alternativeIndex) =>
      result.item(alternativeIndex)
    ).sort((left, right) => right.confidence - left.confidence);
    segments.push(alternatives);
  }

  if (segments.length === 0) return [];

  const primary = segments.map(([best]) => best.transcript);
  const candidates = [primary.join(" ").trim()];
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    for (const alternative of segments[segmentIndex]) {
      const candidate = [...primary];
      candidate[segmentIndex] = alternative.transcript;
      candidates.push(candidate.join(" ").trim());
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}
