import { z } from "zod";
import { agentDocumentResultSchema } from "@/lib/contracts/command";
import { confirmationSchema } from "@/lib/contracts/confirmation";
import { driveListingSchema } from "@/lib/contracts/google";

/** The only external tools Phase 2 exposes to the bounded agent. */
export const docsAgentToolNames = ["drive.search", "docs.read", "docs.apply_edit"] as const;
export const docsAgentToolNameSchema = z.enum(docsAgentToolNames);
export type DocsAgentToolName = z.infer<typeof docsAgentToolNameSchema>;

export const docsFindInputSchema = z.object({
  query: z.string().trim().max(300),
  selectLatest: z.boolean().optional().default(false)
}).strict();

export const docsReadInputSchema = z.object({
  documentId: z.string().trim().min(1).max(200)
}).strict();

export const docsAppendInputSchema = z.object({
  documentId: z.string().trim().min(1).max(200),
  appendText: z.string().trim().min(1).max(4000),
  expectedRevisionId: z.string().trim().min(1).max(200)
}).strict();

export const docsAgentToolCallSchema = z.object({
  name: docsAgentToolNameSchema,
  arguments: z.record(z.string(), z.unknown())
}).strict();

export type DocsAgentToolCall = z.infer<typeof docsAgentToolCallSchema>;

export const docsAgentIntents = ["read_document", "edit_document", "unsupported"] as const;
export const docsAgentIntentSchema = z.enum(docsAgentIntents);

export const agentPlanSchema = z.object({
  intent: docsAgentIntentSchema,
  toolCalls: z.array(docsAgentToolCallSchema).max(4)
}).strict();

export type AgentPlan = z.infer<typeof agentPlanSchema>;

export const docsAgentToolOutputSchemas = {
  "drive.search": driveListingSchema,
  "docs.read": agentDocumentResultSchema,
  "docs.apply_edit": confirmationSchema
} as const;

export function parseDocsToolInput(name: DocsAgentToolName, input: unknown) {
  switch (name) {
    case "drive.search":
      return docsFindInputSchema.safeParse(input);
    case "docs.read":
      return docsReadInputSchema.safeParse(input);
    case "docs.apply_edit":
      return docsAppendInputSchema.safeParse(input);
  }
}
