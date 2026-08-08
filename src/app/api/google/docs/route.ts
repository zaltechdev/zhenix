import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/server/db/dal";
import { listDocumentsForUser } from "@/lib/server/google/docs-workflow";
import { createAksaError } from "@/lib/contracts/errors";

const querySchema = z.object({
  query: z.string().trim().max(300).optional().default(""),
  pageToken: z.string().trim().max(400).optional().nullable()
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "blocked", error: createAksaError("authentication_required") }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    query: request.nextUrl.searchParams.get("query") ?? "",
    pageToken: request.nextUrl.searchParams.get("pageToken")
  });
  if (!parsed.success) {
    return NextResponse.json({ status: "blocked", error: createAksaError("validation_failed") }, { status: 400 });
  }

  const result = await listDocumentsForUser(
    { userId: session.userId, workspaceId: session.workspaceId },
    parsed.data.query,
    parsed.data.pageToken ?? null
  );
  return NextResponse.json(result, { status: result.status === "blocked" ? 400 : 200 });
}
