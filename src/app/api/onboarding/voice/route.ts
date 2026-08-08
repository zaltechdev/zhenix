import { NextResponse } from "next/server";
import {
  onboardingVoiceClassificationSchema,
  onboardingVoiceRequestSchema
} from "@/lib/contracts/onboarding-voice";
import { getSession } from "@/lib/server/db/dal";
import {
  classifyOnboardingVoiceCommand,
  OnboardingClassifierError
} from "@/lib/server/onboarding/voice-classifier";
import { checkOnboardingVoiceRateLimit } from "@/lib/server/onboarding/voice-rate-limit";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ outcome: "rejected", reason: "validation_failed" }, 400);
  }

  const parsedRequest = onboardingVoiceRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return jsonResponse({ outcome: "rejected", reason: "validation_failed" }, 400);
  }

  const session = await getSession();
  if (session === null) {
    return jsonResponse({ outcome: "unavailable", reason: "authentication_required" }, 401);
  }

  const rateLimit = checkOnboardingVoiceRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { outcome: "unavailable", reason: "rate_limited" },
      429,
      { "retry-after": String(rateLimit.retryAfterSeconds) }
    );
  }

  try {
    const result = await classifyOnboardingVoiceCommand(parsedRequest.data, {
      requestKey: session.userId
    });
    const parsedResult = onboardingVoiceClassificationSchema.safeParse(result);
    if (!parsedResult.success) {
      return jsonResponse({ outcome: "unknown" }, 200);
    }
    return jsonResponse(parsedResult.data, 200);
  } catch (error) {
    if (error instanceof OnboardingClassifierError) {
      const status = error.reason === "rate_limited" ? 429 : error.reason === "timeout" ? 504 : 503;
      const headers: Record<string, string> =
        error.reason === "rate_limited" ? { "retry-after": "60" } : {};
      return jsonResponse({ outcome: "unavailable", reason: error.reason }, status, headers);
    }
    return jsonResponse({ outcome: "unavailable", reason: "unavailable" }, 503);
  }
}
