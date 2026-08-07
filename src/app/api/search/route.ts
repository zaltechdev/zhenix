import { NextResponse } from "next/server";
import { createAksaError } from "@/lib/contracts/errors";
import { searchRequestSchema, searchStateSchema } from "@/lib/contracts/search";
import { searchGateway } from "@/lib/server/search/service";

/**
 * Grounded search boundary.
 *
 * Browser-originated, so a Route Handler is the right boundary. The response is
 * validated on the way out, and an unavailable provider produces an honest blocked
 * state rather than an unsourced answer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { status: "blocked", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsedInput = searchRequestSchema.safeParse(payload);
  if (!parsedInput.success) {
    return NextResponse.json(
      { status: "blocked", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await searchGateway().runGroundedQuery(parsedInput.data);
  const parsedOutput = searchStateSchema.safeParse(result);

  if (!parsedOutput.success) {
    return NextResponse.json(
      { status: "blocked", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  return NextResponse.json(parsedOutput.data, { status: 200 });
}
