// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyOnboardingVoiceCommand,
  classifyWithGemini,
  clearOnboardingVoiceClassifierForTests,
  type OnboardingClassifierError
} from "@/lib/server/onboarding/voice-classifier";
import {
  checkOnboardingVoiceRateLimit,
  clearOnboardingVoiceRateLimitForTests
} from "@/lib/server/onboarding/voice-rate-limit";
import type { OnboardingVoiceRequest } from "@/lib/contracts/onboarding-voice";

const request: OnboardingVoiceRequest = {
  transcript: "Could you make sure sources are included?",
  locale: "en",
  state: { includeSources: false, addSummary: false, highlightColor: "blue" }
};

afterEach(() => {
  clearOnboardingVoiceClassifierForTests();
  clearOnboardingVoiceRateLimitForTests();
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GOOGLE_AI_MODEL;
});

describe("server onboarding voice classifier", () => {
  it("avoids Gemini for obvious local matches", async () => {
    const semanticClassifier = vi.fn();
    const result = await classifyOnboardingVoiceCommand(
      { ...request, transcript: "Check Include sources." },
      { semanticClassifier }
    );

    expect(result).toEqual({
      outcome: "matched",
      source: "local",
      intent: "check_include_sources",
      color: null
    });
    expect(semanticClassifier).not.toHaveBeenCalled();
  });

  it("routes paraphrases through semantic fallback", async () => {
    const semanticClassifier = vi.fn().mockResolvedValue({
      intent: "check_include_sources",
      color: null
    });

    await expect(classifyOnboardingVoiceCommand(request, { semanticClassifier })).resolves.toEqual({
      outcome: "matched",
      source: "semantic",
      intent: "check_include_sources",
      color: null
    });
    expect(semanticClassifier).toHaveBeenCalledOnce();
  });

  it("turns malformed, ambiguous, and unsupported model output into unknown", async () => {
    const cases = [
      {},
      { intent: "set_highlight_color", color: null },
      { intent: "run arbitrary function", color: "blue" }
    ];

    for (const output of cases) {
      const semanticClassifier = vi.fn().mockResolvedValue(output as never);
      await expect(
        classifyOnboardingVoiceCommand(
          { ...request, transcript: `${request.transcript} ${cases.indexOf(output)}` },
          { semanticClassifier }
        )
      ).resolves.toEqual({ outcome: "unknown" });
    }
  });

  it("suppresses duplicate semantic requests on the server boundary", async () => {
    let resolveClassifier: (value: { intent: "unknown"; color: null }) => void = () => undefined;
    const semanticClassifier = vi.fn(
      () => new Promise<{ intent: "unknown"; color: null }>((resolve) => {
        resolveClassifier = resolve;
      })
    );
    const first = classifyOnboardingVoiceCommand(request, {
      requestKey: "user-a",
      semanticClassifier
    });
    const second = classifyOnboardingVoiceCommand(request, {
      requestKey: "user-a",
      semanticClassifier
    });

    expect(semanticClassifier).toHaveBeenCalledOnce();
    resolveClassifier({ intent: "unknown", color: null });
    await expect(first).resolves.toEqual({ outcome: "unknown" });
    await expect(second).resolves.toEqual({ outcome: "unknown" });
  });

  it("validates structured Gemini output and sends text state only", async () => {
    process.env.GOOGLE_AI_API_KEY = "unit-test-key";
    process.env.GOOGLE_AI_MODEL = "gemini-3.1-flash-lite";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ intent: "set_highlight_color", color: "yellow" }) }] } }
          ]
        }),
        { status: 200 }
      )
    );

    await expect(classifyWithGemini({ ...request, transcript: "Make the highlight yellow." }, fetchImpl)).resolves.toEqual({
      intent: "set_highlight_color",
      color: "yellow"
    });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.contents[0].parts[0].text).toContain("Make the highlight yellow.");
    expect(JSON.stringify(body)).not.toContain("audio");
    expect(JSON.stringify(body)).not.toContain("camera");
  });

  it("maps provider timeout to recoverable timeout", async () => {
    process.env.GOOGLE_AI_API_KEY = "unit-test-key";
    const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(new Promise<Response>(() => undefined));

    await expect(classifyWithGemini(request, fetchImpl, 1)).rejects.toMatchObject({ reason: "timeout" } satisfies Partial<OnboardingClassifierError>);
  });

  it("limits repeated fallback requests", () => {
    const first = checkOnboardingVoiceRateLimit("user-a", 10_000);
    expect(first.allowed).toBe(true);
    for (let attempt = 0; attempt < 7; attempt += 1) {
      expect(checkOnboardingVoiceRateLimit("user-a", 10_000).allowed).toBe(true);
    }
    expect(checkOnboardingVoiceRateLimit("user-a", 10_000).allowed).toBe(false);
    expect(checkOnboardingVoiceRateLimit("user-a", 70_001).allowed).toBe(true);
  });
});
