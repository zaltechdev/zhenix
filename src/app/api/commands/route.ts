import { NextResponse } from "next/server";
import { commandResultSchema, commandSubmissionSchema } from "@/lib/contracts/command";
import { createAksaError } from "@/lib/contracts/errors";
import { submitCommand } from "@/lib/server/tasks/service";

/**
 * Command submission boundary.
 *
 * The composer is a Client Component, so this is a genuine browser-originated
 * boundary rather than an internal hop. Input and output are both validated, and the
 * handler can only return what the task service actually reports.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "rejected", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsedInput = commandSubmissionSchema.safeParse(payload);
  if (!parsedInput.success) {
    return NextResponse.json(
      { outcome: "rejected", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await submitCommand(parsedInput.data);

  /**
   * Output validation keeps a malformed service response from reaching the client as
   * if it were a real outcome.
   */
  const parsedOutput = commandResultSchema.safeParse(result);
  if (!parsedOutput.success) {
    return NextResponse.json(
      { outcome: "rejected", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  /**
   * A command that cannot run is a successful exchange reporting an honest state, so
   * the transport status stays 200 while the payload carries the reason.
   */
  return NextResponse.json(parsedOutput.data, { status: 200 });
}
