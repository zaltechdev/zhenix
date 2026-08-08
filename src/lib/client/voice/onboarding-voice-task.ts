import {
  onboardingVoiceClassificationSchema,
  onboardingVoiceRequestSchema,
  type OnboardingVoiceClassification,
  type OnboardingVoiceDemoState,
  type OnboardingVoiceIntentResult,
  type OnboardingVoiceUnavailableReason
} from "@/lib/contracts/onboarding-voice";
import { matchOnboardingVoiceIntent, normalizeOnboardingTranscript } from "@/lib/voice/onboarding-intent";

export {
  applyOnboardingVoiceIntent,
  matchOnboardingVoiceIntent,
  normalizeOnboardingTranscript
} from "@/lib/voice/onboarding-intent";

export type OnboardingVoiceResolution =
  | { status: "matched"; source: "local" | "semantic"; result: OnboardingVoiceIntentResult }
  | { status: "unknown" }
  | { status: "unavailable"; reason: OnboardingVoiceUnavailableReason };

type FetchLike = typeof fetch;

const inFlight = new Map<string, Promise<OnboardingVoiceResolution>>();

function unavailable(reason: OnboardingVoiceUnavailableReason): OnboardingVoiceResolution {
  return { status: "unavailable", reason };
}

function responseToResolution(
  response: OnboardingVoiceClassification
): OnboardingVoiceResolution {
  if (response.outcome === "matched") {
    return {
      status: "matched",
      source: response.source,
      result: { intent: response.intent, color: response.color }
    };
  }
  if (response.outcome === "unknown") return { status: "unknown" };
  if (response.outcome === "unavailable") return unavailable(response.reason);
  return unavailable("unavailable");
}

async function requestSemanticClassification(
  request: ReturnType<typeof onboardingVoiceRequestSchema.parse>,
  fetchImpl: FetchLike
): Promise<OnboardingVoiceResolution> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetchImpl("/api/onboarding/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    if (response.status === 429) return unavailable("rate_limited");
    if (response.status === 408 || response.status === 504) return unavailable("timeout");
    if (response.status === 401) return unavailable("authentication_required");
    if (!response.ok) return unavailable("unavailable");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return unavailable("unavailable");
    }

    const parsed = onboardingVoiceClassificationSchema.safeParse(payload);
    return parsed.success ? responseToResolution(parsed.data) : unavailable("unavailable");
  } catch {
    return unavailable(controller.signal.aborted ? "timeout" : "unavailable");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveOnboardingVoiceCommand({
  transcript,
  locale,
  state,
  fetchImpl = fetch
}: {
  transcript: string;
  locale: "en" | "id";
  state: OnboardingVoiceDemoState;
  fetchImpl?: FetchLike;
}): Promise<OnboardingVoiceResolution> {
  const requestCandidate = { transcript, locale, state };
  const parsedRequest = onboardingVoiceRequestSchema.safeParse(requestCandidate);
  if (!parsedRequest.success) return { status: "unknown" };

  const local = matchOnboardingVoiceIntent(parsedRequest.data.transcript, locale);
  if (local.intent !== "unknown") {
    return { status: "matched", source: "local", result: local };
  }

  const key = `${locale}:${normalizeOnboardingTranscript(parsedRequest.data.transcript)}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = requestSemanticClassification(parsedRequest.data, fetchImpl);
  inFlight.set(key, request);
  void request.then(
    () => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    },
    () => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    }
  );
  return request;
}

export function clearOnboardingVoiceRequestsForTests(): void {
  inFlight.clear();
}
