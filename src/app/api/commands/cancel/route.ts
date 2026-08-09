import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancellationResultSchema } from "@/lib/contracts/task";
import { createAksaError } from "@/lib/contracts/errors";
import { cancelTask } from "@/lib/server/tasks/service";

const cancelRequestSchema = z.object({
  taskId: z.string().trim().min(1).max(200)
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { outcome: "unable_to_cancel", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const parsed = cancelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { outcome: "unable_to_cancel", error: createAksaError("validation_failed") },
      { status: 400 }
    );
  }

  const result = await cancelTask(parsed.data.taskId);
  const output = cancellationResultSchema.safeParse(result);
  if (!output.success) {
    return NextResponse.json(
      { outcome: "unable_to_cancel", error: createAksaError("internal_error") },
      { status: 500 }
    );
  }

  return NextResponse.json(output.data, { status: output.data.outcome === "unable_to_cancel" ? 400 : 200 });
}
