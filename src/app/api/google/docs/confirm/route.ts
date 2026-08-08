import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/server/db/dal";
import { respondToDocumentConfirmation } from "@/lib/server/google/docs-workflow";
import { createAksaError } from "@/lib/contracts/errors";

const confirmationRequestSchema = z.object({
  confirmationId: z.string().trim().min(1).max(200),
  decision: z.enum(["approve", "edit", "cancel"])
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ outcome: "unavailable", error: createAksaError("authentication_required") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ outcome: "unavailable", error: createAksaError("validation_failed") }, { status: 400 });
  }
  const parsed = confirmationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ outcome: "unavailable", error: createAksaError("validation_failed") }, { status: 400 });
  }

  const result = await respondToDocumentConfirmation(
    { userId: session.userId, workspaceId: session.workspaceId },
    parsed.data.confirmationId,
    parsed.data.decision
  );
  const status = result.outcome === "completed" || result.outcome === "cancelled" || result.outcome === "edit_requested" ? 200 : 400;
  return NextResponse.json(result, { status });
}
