import { NextRequest, NextResponse } from "next/server";
import {
  confirmationOutcomeSchema,
  confirmationResponseSchema
} from "@/lib/contracts/confirmation";
import { createAksaError } from "@/lib/contracts/errors";
import { respondToConfirmation } from "@/lib/server/tasks/service";

/** Generic agent confirmation boundary. The server owns the session and action scope. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "unavailable", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsed = confirmationResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: "unavailable", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await respondToConfirmation(parsed.data);
  const output = confirmationOutcomeSchema.safeParse(result);
  if (!output.success) {
    return NextResponse.json(
      { outcome: "unavailable", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  const status = ["executed", "cancelled", "edit_requested"].includes(output.data.outcome) ? 200 : 400;
  return NextResponse.json(output.data, { status });
}
