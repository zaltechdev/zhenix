import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyOnboardingVoiceIntent,
  clearOnboardingVoiceRequestsForTests,
  matchOnboardingVoiceIntent,
  resolveOnboardingVoiceCommand
} from "@/lib/client/voice/onboarding-voice-task";
import type { OnboardingVoiceDemoState } from "@/lib/contracts/onboarding-voice";

const state: OnboardingVoiceDemoState = {
  includeSources: false,
  addSummary: false,
  highlightColor: "blue"
};

afterEach(() => {
  clearOnboardingVoiceRequestsForTests();
});

describe("onboarding voice intent", () => {
  it("matches obvious English commands locally", () => {
    expect(matchOnboardingVoiceIntent("Check Include sources.", "en")).toEqual({
      intent: "check_include_sources",
      color: null
    });
    expect(matchOnboardingVoiceIntent("Make the highlight yellow.", "en")).toEqual({
      intent: "set_highlight_color",
      color: "yellow"
    });
  });

  it("matches obvious Indonesian commands locally", () => {
    expect(matchOnboardingVoiceIntent("Centang Sertakan sumber.", "id")).toEqual({
      intent: "check_include_sources",
      color: null
    });
    expect(matchOnboardingVoiceIntent("Ganti sorotannya jadi kuning.", "id")).toEqual({
      intent: "set_highlight_color",
      color: "yellow"
    });
  });

  it("keeps unknown and unsupported commands inert", () => {
    const result = matchOnboardingVoiceIntent("Open my documents.", "en");
    expect(result).toEqual({ intent: "unknown", color: null });
    expect(applyOnboardingVoiceIntent(state, result)).toEqual(state);
  });

  it("executes local matches without a semantic request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await resolveOnboardingVoiceCommand({
      transcript: "Check Include sources.",
      locale: "en",
      state,
      fetchImpl
    });

    expect(result).toEqual({
      status: "matched",
      source: "local",
      result: { intent: "check_include_sources", color: null }
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses semantic fallback for natural paraphrases", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          outcome: "matched",
          source: "semantic",
          intent: "check_include_sources",
          color: null
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await resolveOnboardingVoiceCommand({
      transcript: "Could you make sure sources are included?",
      locale: "en",
      state,
      fetchImpl
    });

    expect(result).toEqual({
      status: "matched",
      source: "semantic",
      result: { intent: "check_include_sources", color: null }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("suppresses duplicate in-flight semantic requests", async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(fetchPromise);
    const input = {
      transcript: "Please turn on sources for this brief.",
      locale: "en" as const,
      state,
      fetchImpl
    };

    const first = resolveOnboardingVoiceCommand(input);
    const second = resolveOnboardingVoiceCommand(input);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify({ outcome: "unknown" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    await expect(first).resolves.toEqual({ status: "unknown" });
    await expect(second).resolves.toEqual({ status: "unknown" });
  });
});
