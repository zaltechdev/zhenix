import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/db/dal";
import { readDocumentForUser } from "@/lib/server/google/docs-workflow";
import { createAksaError } from "@/lib/contracts/errors";

/**
 * GET /api/google/docs/[documentId]
 *
 * Reads a Google Doc for the authenticated user and returns the normalized AksaDocumentModel.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { status: "blocked", error: createAksaError("authentication_required") },
      { status: 401 }
    );
  }

  const { documentId } = await params;

  if (!documentId || documentId.length === 0 || documentId.length > 200) {
    return NextResponse.json(
      { status: "blocked", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await readDocumentForUser(
    { userId: session.userId, workspaceId: session.workspaceId },
    documentId
  );
  const status = result.status === "ready" ? 200 : result.status === "blocked" ? 400 : 200;
  return NextResponse.json(result, { status });
}
