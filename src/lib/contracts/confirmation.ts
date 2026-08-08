import { z } from "zod";
import { aksaErrorSchema } from "@/lib/contracts/errors";
import { affectedItemSchema, taskSchema } from "@/lib/contracts/task";

/**
 * The action a confirmation authorizes. One approved confirmation authorizes
 * exactly one execution of exactly one of these.
 */
export const confirmationActions = [
  "drive_move",
  "drive_rename",
  "drive_create_folder",
  "docs_apply_edit",
  "sheets_write_range",
  "gmail_create_draft"
] as const;

export const confirmationActionSchema = z.enum(confirmationActions);
export type ConfirmationAction = z.infer<typeof confirmationActionSchema>;

export const externalSystems = [
  "google_drive",
  "google_docs",
  "google_sheets",
  "gmail",
  "aksa_only"
] as const;

export const externalSystemSchema = z.enum(externalSystems);
export type ExternalSystem = z.infer<typeof externalSystemSchema>;

export const confirmationSchema = z.object({
  id: z.string().min(1).max(200),
  taskId: z.string().min(1).max(200),
  action: confirmationActionSchema,
  /** Named items, never a vague quantity. */
  scopeItems: z.array(affectedItemSchema),
  /** Present when the named list is summarized, so the count stays honest. */
  scopeItemsTotal: z.number().int().min(0),
  destinationName: z.string().max(300).nullable(),
  changesExternalData: z.boolean(),
  externalSystem: externalSystemSchema,
  undoSupported: z.boolean(),
  /** Required whenever `undoSupported` is false, so the user knows before approving. */
  undoUnsupportedReasonKey: z.string().max(120).nullable(),
  /** Bounded preview of the proposed change. It is never a provider request body. */
  preview: z.string().max(4000).nullable().optional(),
  expiresAt: z.number().int().nonnegative(),
  canApprove: z.boolean(),
  canEdit: z.boolean(),
  canCancel: z.boolean(),
  /**
   * True when this confirmation is a labelled interface preview rather than a
   * real pending approval. Illustrative confirmations can never execute.
   */
  illustrative: z.boolean()
});

export type Confirmation = z.infer<typeof confirmationSchema>;

export const confirmationDecisionSchema = z.enum(["approve", "edit", "cancel"]);
export type ConfirmationDecision = z.infer<typeof confirmationDecisionSchema>;

export const confirmationResponseSchema = z.object({
  confirmationId: z.string().min(1).max(200),
  decision: confirmationDecisionSchema
});

export type ConfirmationResponse = z.infer<typeof confirmationResponseSchema>;

export const confirmationOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("executed"), task: taskSchema }),
  z.object({ outcome: z.literal("cancelled"), task: taskSchema }),
  z.object({ outcome: z.literal("edit_requested"), confirmation: confirmationSchema }),
  z.object({ outcome: z.literal("expired"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("already_consumed"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("unavailable"), error: aksaErrorSchema })
]);

export type ConfirmationOutcome = z.infer<typeof confirmationOutcomeSchema>;

/**
 * Reserved identifiers for the labelled interface preview.
 *
 * An illustrative confirmation may describe an external action so the preview shows
 * real confirmation content, but it can never be executed. The server rejects these
 * identifiers outright, and the client never sends them.
 */
export const ILLUSTRATIVE_TASK_ID = "illustrative-preview";
export const ILLUSTRATIVE_CONFIRMATION_PREFIX = "illustrative-";

export function isIllustrativeConfirmationId(confirmationId: string): boolean {
  return confirmationId.startsWith(ILLUSTRATIVE_CONFIRMATION_PREFIX);
}

/**
 * A confirmation is a valid preview only when it is labelled and carries the
 * reserved identifiers, so a real pending approval can never be mislabelled as one.
 */
export function isValidIllustrativeConfirmation(confirmation: Confirmation): boolean {
  return (
    confirmation.illustrative &&
    confirmation.taskId === ILLUSTRATIVE_TASK_ID &&
    isIllustrativeConfirmationId(confirmation.id)
  );
}
