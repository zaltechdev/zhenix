import { z } from "zod";
import {
  onboardingVoiceIntentResultSchema,
  type OnboardingVoiceClassification,
  type OnboardingVoiceIntentResult,
  type OnboardingVoiceRequest,
  type OnboardingVoiceUnavailableReason
} from "@/lib/contracts/onboarding-voice";
import { matchOnboardingVoiceIntent, normalizeOnboardingTranscript } from "@/lib/voice/onboarding-intent";
import { executionConfig, googleAiStudioClassifierConfig } from "@/lib/server/config/runtime-config";
import { assertServerOnly } from "@/lib/server/server-guard";

assertServerOnly("src/lib/server/onboarding/voice-classifier.ts");

const providerResponseSchema = z
  .object({
    candidates: z.array(
      z
        .object({
          content: z
            .object({
              parts: z.array(
                z
                  .object({ text: z.string().optional() })
                  .passthrough()
              )
            })
            .passthrough()
        })
        .passthrough()
    )
  })
  .passthrough();

export const ONBOARDING_GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["check_include_sources", "uncheck_include_sources", "set_highlight_color", "unknown"]
    },
    color: {
      type: ["string", "null"],
      enum: ["yellow", "blue", "red", null]
    }
  },
  required: ["intent", "color"],
  additionalProperties: false
} as const;

const CLASSIFIER_PROMPT = `You classify one spoken onboarding command for a local Aksa demo.
Allowed state: Include sources checkbox, Add summary checkbox, highlight color blue/yellow/red.
Allowed intents: check_include_sources, uncheck_include_sources, set_highlight_color, unknown.
Return schema only. Do not explain. Do not invent actions.`;

const DEFAULT_TIMEOUT_MS = 4_500;

export class OnboardingClassifierError extends Error {
  readonly reason: OnboardingVoiceUnavailableReason;

  constructor(reason: OnboardingVoiceUnavailableReason) {
    super(reason);
    this.name = "OnboardingClassifierError";
    this.reason = reason;
  }
}

function providerErrorForStatus(status: number): OnboardingClassifierError {
  if (status === 429) return new OnboardingClassifierError("rate_limited");
  if (status === 408 || status === 504) return new OnboardingClassifierError("timeout");
  return new OnboardingClassifierError("unavailable");
}

function extractProviderText(payload: unknown): string | null {
  const parsed = providerResponseSchema.safeParse(payload);
  if (!parsed.success) return null;

  for (const candidate of parsed.data.candidates) {
    for (const part of candidate.content.parts) {
      if (typeof part.text === "string" && part.text.trim() !== "") return part.text;
    }
  }
  return null;
}

export async function classifyWithGemini(
  request: OnboardingVoiceRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = Math.min(executionConfig().providerTimeoutMs, DEFAULT_TIMEOUT_MS)
): Promise<OnboardingVoiceIntentResult> {
  const config = googleAiStudioClassifierConfig();
  if (config === null) throw new OnboardingClassifierError("not_configured");

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;

  try {
    const providerRequest = fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFIER_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  locale: request.locale,
                  transcript: request.transcript,
                  state: request.state
                })
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 64,
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema: ONBOARDING_GEMINI_RESPONSE_SCHEMA
            }
          }
        }
      }),
      signal: controller.signal
    });
    const timeoutRequest = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new OnboardingClassifierError("timeout"));
      }, timeoutMs);
    });
    const response = await Promise.race([providerRequest, timeoutRequest]);

    if (!response.ok) throw providerErrorForStatus(response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { intent: "unknown", color: null };
    }

    const text = extractProviderText(payload);
    if (text === null) return { intent: "unknown", color: null };

    let output: unknown;
    try {
      output = JSON.parse(text);
    } catch {
      return { intent: "unknown", color: null };
    }

    const parsed = onboardingVoiceIntentResultSchema.safeParse(output);
    return parsed.success ? parsed.data : { intent: "unknown", color: null };
  } catch (error) {
    if (error instanceof OnboardingClassifierError) throw error;
    if (controller.signal.aborted) throw new OnboardingClassifierError("timeout");
    throw new OnboardingClassifierError("unavailable");
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

type SemanticClassifier = (request: OnboardingVoiceRequest) => Promise<OnboardingVoiceIntentResult>;

const inFlight = new Map<string, Promise<OnboardingVoiceClassification>>();

export async function classifyOnboardingVoiceCommand(
  request: OnboardingVoiceRequest,
  options: { requestKey?: string; semanticClassifier?: SemanticClassifier } = {}
): Promise<OnboardingVoiceClassification> {
  const local = matchOnboardingVoiceIntent(request.transcript, request.locale);
  if (local.intent !== "unknown") {
    return {
      outcome: "matched",
      source: "local",
      intent: local.intent,
      color: local.color
    };
  }

  const key = `${options.requestKey ?? "anonymous"}:${request.locale}:${normalizeOnboardingTranscript(request.transcript)}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const semanticClassifier = options.semanticClassifier ?? classifyWithGemini;
  const pending: Promise<OnboardingVoiceClassification> = semanticClassifier(request).then((result) => {
    const parsed = onboardingVoiceIntentResultSchema.safeParse(result);
    if (!parsed.success || parsed.data.intent === "unknown") return { outcome: "unknown" as const };
    return {
      outcome: "matched" as const,
      source: "semantic" as const,
      intent: parsed.data.intent,
      color: parsed.data.color
    };
  });

  inFlight.set(key, pending);
  void pending.then(
    () => {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    },
    () => {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    }
  );
  return pending;
}

export function clearOnboardingVoiceClassifierForTests(): void {
  inFlight.clear();
}
