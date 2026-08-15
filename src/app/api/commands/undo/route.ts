import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { undoOutcomeSchema } from "@/lib/contracts/undo";
import { createAksaError } from "@/lib/contracts/errors";
import { requestUndo } from "@/lib/server/tasks/service";

const undoRequestSchema = z
  .object({
    undoId: z.string().trim().min(1).max(200)
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "failed", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsed = undoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: "failed", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await requestUndo(parsed.data.undoId);
  const output = undoOutcomeSchema.safeParse(result);
  if (!output.success) {
    return NextResponse.json(
      { outcome: "failed", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  return NextResponse.json(output.data, {
    status: output.data.outcome === "failed" ? 400 : 200
  });
}
