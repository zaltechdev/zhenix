import { NextResponse } from "next/server";
import {
  aksaSemanticIntentRequestSchema,
  aksaSemanticIntentResponseSchema
} from "@/lib/contracts/voice-intent";
import { getSession } from "@/lib/server/db/dal";
import { classifyAksaVoiceIntent } from "@/lib/server/voice/intent-classifier";
import { checkAksaIntentRateLimit } from "@/lib/server/voice/intent-rate-limit";

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
    return jsonResponse({ intent: "UNKNOWN" }, 400);
  }

  const parsedRequest = aksaSemanticIntentRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return jsonResponse({ intent: "UNKNOWN" }, 400);
  }

  const session = await getSession();
  if (session === null) {
    return jsonResponse({ intent: "UNKNOWN" }, 401);
  }

  const rateLimit = checkAksaIntentRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { intent: "UNKNOWN" },
      429,
      { "retry-after": String(rateLimit.retryAfterSeconds) }
    );
  }

  const intent = await classifyAksaVoiceIntent(parsedRequest.data, {
    requestKey: session.userId
  });
  const parsedResponse = aksaSemanticIntentResponseSchema.safeParse({ intent });
  return jsonResponse(parsedResponse.success ? parsedResponse.data : { intent: "UNKNOWN" });
}
