import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, isGoogleConnected } from "@/lib/server/google/token-store";
import { getDocument, GoogleApiError } from "@/lib/server/google/docs-api";
import { adaptGoogleDocument } from "@/lib/server/google/docs-adapter";
import { getSession } from "@/lib/server/db/dal";

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
      { status: "blocked", error: { category: "authentication_required" } },
      { status: 401 }
    );
  }

  const { documentId } = await params;

  if (!documentId || documentId.length === 0) {
    return NextResponse.json(
      { status: "blocked", error: { category: "validation_failed", message: "Missing document ID" } },
      { status: 400 }
    );
  }

  const connected = await isGoogleConnected(session.userId);
  if (!connected) {
    return NextResponse.json(
      { status: "blocked", error: { category: "connection_required" } },
      { status: 401 }
    );
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    return NextResponse.json(
      { status: "blocked", error: { category: "connection_required" } },
      { status: 401 }
    );
  }

  try {
    const rawDoc = await getDocument(accessToken, documentId);
    const model = adaptGoogleDocument(rawDoc);

    return NextResponse.json({ status: "ready", data: model });
  } catch (err) {
    if (err instanceof GoogleApiError) {
      if (err.isNotFound) {
        return NextResponse.json(
          { status: "blocked", error: { category: "not_found" } },
          { status: 404 }
        );
      }
      if (err.isPermissionDenied) {
        return NextResponse.json(
          { status: "blocked", error: { category: "permission_denied" } },
          { status: 403 }
        );
      }
      if (err.isRateLimited) {
        return NextResponse.json(
          { status: "blocked", error: { category: "rate_limited" } },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { status: "blocked", error: { category: "internal_error" } },
      { status: 500 }
    );
  }
}
