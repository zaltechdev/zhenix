import { z } from "zod";
import { aksaErrorSchema, preservedProgressSchema } from "@/lib/contracts/errors";

/**
 * The fixed product state set from `.agents/prd.md` section 14. No other state
 * may be shown. `idle`, `listening`, and `transcribing` are client-only input
 * states and are never persisted.
 */
export const taskStates = [
  "idle",
  "listening",
  "transcribing",
  "understanding",
  "executing",
  "waiting_for_confirmation",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
  "undo_available"
] as const;

export const taskStateSchema = z.enum(taskStates);
export type TaskState = z.infer<typeof taskStateSchema>;

export const clientOnlyTaskStates: readonly TaskState[] = ["idle", "listening", "transcribing"];

export const terminalTaskStates: readonly TaskState[] = [
  "completed",
  "partially_completed",
  "failed",
  "cancelled"
];

export function isTerminalTaskState(state: TaskState): boolean {
  return terminalTaskStates.includes(state);
}

export function isCancellableTaskState(state: TaskState): boolean {
  return state === "understanding" || state === "executing" || state === "waiting_for_confirmation";
}

export const affectedItemKinds = [
  "drive_file",
  "drive_folder",
  "document",
  "sheet_range",
  "email_message",
  "email_draft",
  "artifact"
] as const;

export const affectedItemKindSchema = z.enum(affectedItemKinds);
export type AffectedItemKind = z.infer<typeof affectedItemKindSchema>;

export const affectedItemSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  kind: affectedItemKindSchema
});

export type AffectedItem = z.infer<typeof affectedItemSchema>;

export const intentCategories = [
  "navigate",
  "find_files",
  "read_document",
  "edit_document",
  "read_sheet",
  "write_sheet",
  "read_mail",
  "draft_mail",
  "organize_files",
  "research",
  "unsupported"
] as const;

export const intentCategorySchema = z.enum(intentCategories);
export type IntentCategory = z.infer<typeof intentCategorySchema>;

export const taskSchema = z.object({
  id: z.string().min(1).max(200),
  /** Already-safe user-visible title. Never a prompt and never reasoning. */
  title: z.string().min(1).max(300),
  intentCategory: intentCategorySchema.nullable(),
  state: taskStateSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  affectedItems: z.array(affectedItemSchema),
  artifactIds: z.array(z.string().min(1).max(200)),
  confirmationId: z.string().min(1).max(200).nullable(),
  undoId: z.string().min(1).max(200).nullable(),
  cancellationAvailable: z.boolean(),
  itemsTotal: z.number().int().min(0).nullable(),
  itemsCompleted: z.number().int().min(0).nullable(),
  /** Stable localization key, never a provider message. */
  resultSummaryKey: z.string().max(120).nullable(),
  error: aksaErrorSchema.nullable()
});

export type Task = z.infer<typeof taskSchema>;

/**
 * Cancellation is a request, not an instant guarantee. The interface never shows
 * a cancel as successful before the server accepts it.
 */
export const cancellationResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("requested"), taskId: z.string().min(1).max(200) }),
  z.object({ outcome: z.literal("accepted"), task: taskSchema }),
  z.object({ outcome: z.literal("already_completed"), task: taskSchema }),
  z.object({
    outcome: z.literal("partial"),
    task: taskSchema,
    preservedProgress: preservedProgressSchema
  }),
  z.object({ outcome: z.literal("unable_to_cancel"), error: aksaErrorSchema })
]);

export type CancellationResult = z.infer<typeof cancellationResultSchema>;

export const taskListSchema = z.object({
  tasks: z.array(taskSchema),
  nextCursor: z.string().min(1).max(400).nullable()
});

export type TaskList = z.infer<typeof taskListSchema>;
