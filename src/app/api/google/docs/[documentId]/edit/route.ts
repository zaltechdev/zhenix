import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/server/db/dal";
import { proposeDocumentAppend } from "@/lib/server/google/docs-workflow";
import { createAksaError } from "@/lib/contracts/errors";

/**
 * POST /api/google/docs/[documentId]/edit
 *
 * Applies structured edits to a Google Doc. Requires the current revision ID
 * for conflict detection. Re-reads after write to verify.
 */

const editRequestSchema = z.object({
  appendText: z.string().trim().min(1).max(4000),
  expectedRevisionId: z.string().trim().min(1).max(200)
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { outcome: "blocked", error: createAksaError("authentication_required") },
      { status: 401 }
    );
  }

  const { documentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "blocked", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsed = editRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: "blocked", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await proposeDocumentAppend(
    { userId: session.userId, workspaceId: session.workspaceId },
    { documentId, ...parsed.data }
  );
  return NextResponse.json(result, { status: result.outcome === "blocked" ? 400 : 200 });
}
