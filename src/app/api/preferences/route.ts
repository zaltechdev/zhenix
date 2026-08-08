import { NextResponse } from "next/server";
import {
  userPreferencesSaveResultSchema,
  userPreferencesSchema
} from "@/lib/contracts/auth";
import { createAksaError } from "@/lib/contracts/errors";
import { authGateway } from "@/lib/server/auth/service";

/** Reads the signed-in user's presentation and control preferences. */
export async function GET(): Promise<NextResponse> {
  const preferences = await authGateway().readUserPreferences();
  return NextResponse.json({ preferences }, { status: 200 });
}

/** Saves the complete preference snapshot as one predictable account update. */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "invalid_input", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsedInput = userPreferencesSchema.safeParse(payload);
  if (!parsedInput.success) {
    return NextResponse.json(
      { outcome: "invalid_input", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await authGateway().saveUserPreferences(parsedInput.data);
  const parsedOutput = userPreferencesSaveResultSchema.safeParse(result);

  if (!parsedOutput.success) {
    return NextResponse.json(
      { outcome: "unavailable", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  return NextResponse.json(parsedOutput.data, { status: 200 });
}
