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
  recognition.maxAlternatives = 1;
  return recognition;
}

export function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  let transcript = "";
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (result.length > 0) {
      transcript += result[0].transcript;
    }
  }
  return transcript.trim();
}
