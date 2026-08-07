import { NextResponse } from "next/server";
import {
  accessibilityProfileSaveResultSchema,
  accessibilityProfileSchema
} from "@/lib/contracts/auth";
import { createAksaError } from "@/lib/contracts/errors";
import { authGateway } from "@/lib/server/auth/service";

/**
 * GET current user's accessibility profile.
 */
export async function GET(): Promise<NextResponse> {
  const profile = await authGateway().readAccessibilityProfile();
  if (!profile) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }
  return NextResponse.json({ profile }, { status: 200 });
}

/**
 * Save/update current user's accessibility profile.
 */
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

  const parsedInput = accessibilityProfileSchema.safeParse(payload);
  if (!parsedInput.success) {
    return NextResponse.json(
      { outcome: "invalid_input", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await authGateway().saveAccessibilityProfile(parsedInput.data);
  const parsedOutput = accessibilityProfileSaveResultSchema.safeParse(result);

  if (!parsedOutput.success) {
    return NextResponse.json(
      { outcome: "unavailable", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  return NextResponse.json(parsedOutput.data, { status: 200 });
}
