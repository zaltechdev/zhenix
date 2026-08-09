import { z } from "zod";
import { aksaErrorSchema } from "@/lib/contracts/errors";
import { confirmationSchema } from "@/lib/contracts/confirmation";
import { taskSchema } from "@/lib/contracts/task";

export const commandSourceSchema = z.enum(["text", "voice"]);
export type CommandSource = z.infer<typeof commandSourceSchema>;

export const commandLocaleSchema = z.enum(["en", "id"]);
export type CommandLocale = z.infer<typeof commandLocaleSchema>;

export const COMMAND_TEXT_MAX_LENGTH = 2000;

export const commandSubmissionSchema = z.object({
  /** Client-generated idempotency handle for one submitted command. */
  commandId: z.string().min(8).max(80),
  text: z.string().trim().min(1).max(COMMAND_TEXT_MAX_LENGTH),
  /** The raw recognized transcript when the user edited it before submitting. */
  transcript: z.string().trim().max(COMMAND_TEXT_MAX_LENGTH).nullable(),
  /** Current document context, when the composer is mounted on a Docs route. */
  contextDocumentId: z.string().trim().min(1).max(200).nullable().optional(),
  locale: commandLocaleSchema,
  source: commandSourceSchema,
  submittedAt: z.number().int().nonnegative()
});

export type CommandSubmission = z.infer<typeof commandSubmissionSchema>;

/**
 * What Aksa received, echoed back so the user can check it before anything runs.
 *
 * This is a verbatim echo, not an inferred intent. Intent classification requires
 * the agent backend, so `intentResolved` stays false until that is configured.
 */
export const commandUnderstandingSchema = z.object({
  commandId: z.string().min(8).max(80),
  receivedText: z.string().min(1).max(COMMAND_TEXT_MAX_LENGTH),
  source: commandSourceSchema,
  locale: commandLocaleSchema,
  receivedAt: z.number().int().nonnegative(),
  intentResolved: z.literal(false)
});

export type CommandUnderstanding = z.infer<typeof commandUnderstandingSchema>;

/** Real, read-back document content returned by the bounded Docs agent. */
export const agentDocumentResultSchema = z.object({
  kind: z.literal("google_document"),
  documentId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  text: z.string().max(12000),
  truncated: z.boolean(),
  verified: z.literal(true)
});

export type AgentDocumentResult = z.infer<typeof agentDocumentResultSchema>;

export const commandResultSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("accepted"),
    task: taskSchema,
    confirmation: confirmationSchema.nullable().optional(),
    result: agentDocumentResultSchema.nullable().optional()
  }),
  z.object({
    outcome: z.literal("unavailable"),
    understanding: commandUnderstandingSchema,
    error: aksaErrorSchema
  }),
  z.object({ outcome: z.literal("rejected"), error: aksaErrorSchema })
]);

export type CommandResult = z.infer<typeof commandResultSchema>;

/**
 * Safe example commands offered by the interface. Selecting one fills the
 * composer only. It never runs anything.
 */
export const exampleCommandKeys = [
  "open_latest_assignment",
  "find_project_files",
  "summarize_document",
  "read_sheet_range",
  "search_with_sources"
] as const;

export const exampleCommandKeySchema = z.enum(exampleCommandKeys);
export type ExampleCommandKey = z.infer<typeof exampleCommandKeySchema>;

export function createCommandId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
