// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyAksaIntentWithGemini,
  classifyAksaVoiceIntent,
  clearAksaVoiceIntentClassifierForTests
} from "@/lib/server/voice/intent-classifier";
import {
  checkAksaIntentRateLimit,
  clearAksaIntentRateLimitForTests
} from "@/lib/server/voice/intent-rate-limit";

const request = { transcript: "Could you show my documents?", locale: "en" as const };

afterEach(() => {
  clearAksaVoiceIntentClassifierForTests();
  clearAksaIntentRateLimitForTests();
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GOOGLE_AI_MODEL;
});

describe("server Aksa intent classifier", () => {
  it("keeps deterministic commands independent from Gemini", async () => {
    const semanticClassifier = vi.fn();

    await expect(
      classifyAksaVoiceIntent(
        { transcript: "open gmail", locale: "en" },
        { semanticClassifier }
      )
    ).resolves.toBe("NAV_GMAIL");
    expect(semanticClassifier).not.toHaveBeenCalled();
  });

  it("accepts only an allowlisted semantic intent", async () => {
    await expect(
      classifyAksaVoiceIntent(request, {
        semanticClassifier: vi.fn().mockResolvedValue("NAV_DOCS")
      })
    ).resolves.toBe("NAV_DOCS");
    await expect(
      classifyAksaVoiceIntent(
        { ...request, transcript: `${request.transcript} unsupported` },
        { semanticClassifier: vi.fn().mockResolvedValue("CLICK_ANYTHING") }
      )
    ).resolves.toBe("UNKNOWN");
  });

  it("validates structured Gemini output and sends transcript text only", async () => {
    process.env.GOOGLE_AI_API_KEY = "unit-test-key";
    process.env.GOOGLE_AI_MODEL = "gemini-3.1-flash-lite";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "NAV_DOCS" }) }] } }]
        }),
        { status: 200 }
      )
    );

    await expect(classifyAksaIntentWithGemini(request, fetchImpl)).resolves.toBe("NAV_DOCS");
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.contents[0].parts[0].text).toContain(request.transcript);
    expect(JSON.stringify(body)).not.toContain("audio");
    expect(JSON.stringify(body)).not.toContain("camera");
  });

  it("returns unknown for malformed provider JSON", async () => {
    process.env.GOOGLE_AI_API_KEY = "unit-test-key";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }),
        { status: 200 }
      )
    );

    await expect(classifyAksaIntentWithGemini(request, fetchImpl)).resolves.toBe("UNKNOWN");
  });

  it("bounds repeated semantic fallback requests", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(checkAksaIntentRateLimit("user-a", 10_000).allowed).toBe(true);
    }
    expect(checkAksaIntentRateLimit("user-a", 10_000).allowed).toBe(false);
    expect(checkAksaIntentRateLimit("user-a", 70_001).allowed).toBe(true);
  });
});
