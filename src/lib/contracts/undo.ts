import { z } from "zod";
import { aksaErrorSchema } from "@/lib/contracts/errors";
import { affectedItemSchema } from "@/lib/contracts/task";

/**
 * Reverse operations Aksa genuinely supports, matching `undo_records.undo_kind`
 * in `.agents/db_schema.md` section 3.15.
 */
export const undoKinds = [
  "drive_move",
  "drive_rename",
  "sheets_range_write",
  "docs_edit",
  "gmail_draft_delete"
] as const;

export const undoKindSchema = z.enum(undoKinds);
export type UndoKind = z.infer<typeof undoKindSchema>;

export const undoStates = [
  "available",
  "running",
  "completed",
  "partially_completed",
  "failed",
  "unavailable",
  "expired"
] as const;

export const undoStateSchema = z.enum(undoStates);
export type UndoState = z.infer<typeof undoStateSchema>;

export const undoRecordSchema = z
  .object({
    id: z.string().min(1).max(200),
    taskId: z.string().min(1).max(200),
    kind: undoKindSchema.nullable(),
    supported: z.boolean(),
    /** Required when unsupported, so the reason is stated before reliance. */
    unsupportedReasonKey: z.string().max(120).nullable(),
    state: undoStateSchema,
    affectedItems: z.array(affectedItemSchema),
    itemsTotal: z.number().int().min(0),
    itemsReverted: z.number().int().min(0).nullable(),
    /** Remaining availability is stated as text, never as a pressuring countdown. */
    expiresAt: z.number().int().nonnegative().nullable(),
    resultSummaryKey: z.string().max(120).nullable()
  })
  .refine((record) => record.supported || record.unsupportedReasonKey !== null, {
    message: "An unsupported undo record must state why it cannot be reversed."
  });

export type UndoRecord = z.infer<typeof undoRecordSchema>;

export const undoOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("applied"), record: undoRecordSchema }),
  z.object({ outcome: z.literal("partially_applied"), record: undoRecordSchema }),
  z.object({ outcome: z.literal("already_applied"), record: undoRecordSchema }),
  z.object({ outcome: z.literal("expired"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("unsupported"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("failed"), error: aksaErrorSchema })
]);

export type UndoOutcome = z.infer<typeof undoOutcomeSchema>;

export function isUndoOfferable(record: UndoRecord): boolean {
  return record.supported && record.state === "available";
}
