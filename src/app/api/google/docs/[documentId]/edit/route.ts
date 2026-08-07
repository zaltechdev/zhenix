import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getValidAccessToken, isGoogleConnected } from "@/lib/server/google/token-store";
import { batchUpdateDocument, getDocument, GoogleApiError } from "@/lib/server/google/docs-api";
import { adaptGoogleDocument } from "@/lib/server/google/docs-adapter";
import type { GoogleDocRequest } from "@/lib/server/google/docs-api";
import { getSession } from "@/lib/server/db/dal";

/**
 * POST /api/google/docs/[documentId]/edit
 *
 * Applies structured edits to a Google Doc. Requires the current revision ID
 * for conflict detection. Re-reads after write to verify.
 */

const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("replaceText"),
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().positive(),
    newText: z.string()
  }),
  z.object({
    type: z.literal("insertText"),
    index: z.number().int().nonnegative(),
    text: z.string().min(1)
  }),
  z.object({
    type: z.literal("deleteRange"),
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().positive()
  }),
  z.object({
    type: z.literal("updateTextStyle"),
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().positive(),
    style: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional()
    }),
    fields: z.string().min(1)
  }),
  z.object({
    type: z.literal("updateParagraphStyle"),
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().positive(),
    namedStyleType: z.string().min(1)
  })
]);

const editRequestSchema = z.object({
  operations: z.array(editOperationSchema).min(1).max(100),
  requiredRevisionId: z.string().min(1)
});

function operationToGoogleRequest(op: z.infer<typeof editOperationSchema>): GoogleDocRequest[] {
  switch (op.type) {
    case "replaceText":
      return [
        { deleteContentRange: { range: { startIndex: op.startIndex, endIndex: op.endIndex } } },
        { insertText: { text: op.newText, location: { index: op.startIndex } } }
      ];

    case "insertText":
      return [
        { insertText: { text: op.text, location: { index: op.index } } }
      ];

    case "deleteRange":
      return [
        { deleteContentRange: { range: { startIndex: op.startIndex, endIndex: op.endIndex } } }
      ];

    case "updateTextStyle":
      return [
        {
          updateTextStyle: {
            range: { startIndex: op.startIndex, endIndex: op.endIndex },
            textStyle: op.style,
            fields: op.fields
          }
        }
      ];

    case "updateParagraphStyle":
      return [
        {
          updateParagraphStyle: {
            range: { startIndex: op.startIndex, endIndex: op.endIndex },
            paragraphStyle: { namedStyleType: op.namedStyleType },
            fields: "namedStyleType"
          }
        }
      ];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { outcome: "blocked", error: { category: "authentication_required" } },
      { status: 401 }
    );
  }

  const { documentId } = await params;

  const connected = await isGoogleConnected(session.userId);
  if (!connected) {
    return NextResponse.json(
      { outcome: "blocked", error: { category: "connection_required" } },
      { status: 401 }
    );
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    return NextResponse.json(
      { outcome: "blocked", error: { category: "connection_required" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "blocked", error: { category: "validation_failed" } },
      { status: 400 }
    );
  }

  const parsed = editRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: "blocked", error: { category: "validation_failed", details: parsed.error.issues } },
      { status: 400 }
    );
  }

  const { operations, requiredRevisionId } = parsed.data;

  const sortedOps = [...operations].sort((a, b) => {
    const aStart = "startIndex" in a ? a.startIndex : ("index" in a ? a.index : 0);
    const bStart = "startIndex" in b ? b.startIndex : ("index" in b ? b.index : 0);
    return bStart - aStart;
  });

  const googleRequests: GoogleDocRequest[] = [];
  for (const op of sortedOps) {
    googleRequests.push(...operationToGoogleRequest(op));
  }

  try {
    await batchUpdateDocument(accessToken, documentId, {
      requests: googleRequests,
      writeControl: { requiredRevisionId }
    });

    const rawDoc = await getDocument(accessToken, documentId);
    const model = adaptGoogleDocument(rawDoc);

    return NextResponse.json({
      outcome: "completed",
      document: model
    });
  } catch (err) {
    if (err instanceof GoogleApiError) {
      if (err.isRevisionConflict) {
        return NextResponse.json(
          { outcome: "conflict", error: { category: "verification_failed", message: "Document was modified externally" } },
          { status: 409 }
        );
      }
      if (err.isPermissionDenied) {
        return NextResponse.json(
          { outcome: "blocked", error: { category: "permission_denied" } },
          { status: 403 }
        );
      }
      if (err.isRateLimited) {
        return NextResponse.json(
          { outcome: "blocked", error: { category: "rate_limited" } },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { outcome: "blocked", error: { category: "internal_error" } },
      { status: 500 }
    );
  }
}
