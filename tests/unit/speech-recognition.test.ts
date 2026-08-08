import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRecognition,
  recognitionLanguage,
  transcriptFromEvent,
  type SpeechRecognitionLike
} from "@/lib/client/voice/speech-recognition";

class RecognitionMock implements SpeechRecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  onstart: SpeechRecognitionLike["onstart"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

afterEach(() => vi.unstubAllGlobals());

describe("Indonesian speech recognition", () => {
  it("uses Indonesian BCP 47 recognition and alternatives", () => {
    vi.stubGlobal("SpeechRecognition", RecognitionMock);

    const recognition = createRecognition("id");

    expect(recognitionLanguage("id")).toBe("id-ID");
    expect(recognition).toMatchObject({ lang: "id-ID", maxAlternatives: 3 });
  });

  it("keeps the highest-confidence Indonesian transcript verbatim", () => {
    const result = {
      length: 2,
      isFinal: true,
      0: { transcript: "Buka dokumen terbaru", confidence: 0.42 },
      1: { transcript: "Buka dokumen terkini", confidence: 0.88 },
      item: (index: number) =>
        index === 0
          ? { transcript: "Buka dokumen terbaru", confidence: 0.42 }
          : { transcript: "Buka dokumen terkini", confidence: 0.88 }
    };
    const results = Object.assign([result], { item: () => result });
    const transcript = transcriptFromEvent({
      resultIndex: 0,
      results
    });

    expect(transcript).toBe("Buka dokumen terkini");
  });
});
