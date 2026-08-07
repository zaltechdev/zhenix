import { z } from "zod";
import { errorCategorySchema } from "@/lib/contracts/errors";
import { affectedItemSchema } from "@/lib/contracts/task";

/**
 * Closed set of user-visible activity events, matching `activity_events.event_type`
 * in `.agents/db_schema.md` section 3.13.
 *
 * A closed enum means the interface can localize every event exhaustively and can
 * never render an unlabelled or model-authored step.
 */
export const activityEventTypes = [
  "task_started",
  "step_started",
  "step_succeeded",
  "step_failed",
  "step_skipped",
  "confirmation_requested",
  "confirmation_approved",
  "confirmation_edited",
  "confirmation_cancelled",
  "confirmation_expired",
  "task_completed",
  "task_partially_completed",
  "task_failed",
  "task_cancelled",
  "undo_requested",
  "undo_completed",
  "undo_failed"
] as const;

export const activityEventTypeSchema = z.enum(activityEventTypes);
export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;

export const activityOutcomes = [
  "started",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "awaiting_confirmation"
] as const;

export const activityOutcomeSchema = z.enum(activityOutcomes);
export type ActivityOutcome = z.infer<typeof activityOutcomeSchema>;

export const activityEventSchema = z.object({
  id: z.string().min(1).max(200),
  taskId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  eventType: activityEventTypeSchema,
  outcome: activityOutcomeSchema,
  /** Product-language step name already safe to display. */
  actionLabel: z.string().min(1).max(300),
  affectedItems: z.array(affectedItemSchema),
  /** Stable localization key for the result line, never a provider message. */
  resultSummaryKey: z.string().max(120).nullable(),
  /** True only when the effect was read back and checked. */
  verified: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  durationMs: z.number().int().min(0).nullable(),
  errorCategory: errorCategorySchema.nullable()
});

export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const activityFeedSchema = z.object({
  events: z.array(activityEventSchema),
  /** True when every listed event maps to a real recorded execution. */
  evidenceBacked: z.literal(true)
});

export type ActivityFeed = z.infer<typeof activityFeedSchema>;
