import { z } from "zod";
import { COMMAND_TEXT_MAX_LENGTH, commandLocaleSchema } from "@/lib/contracts/command";

export const aksaIntentNames = [
  "NAV_HOME",
  "NAV_DOCS",
  "NAV_SHEETS",
  "NAV_DRIVE",
  "NAV_GMAIL",
  "NAV_WEB_SEARCH",
  "NAV_HISTORY",
  "NAV_ACTIVITY",
  "NAV_ACCESSIBILITY",
  "NAV_SETTINGS",
  "NAV_ACCOUNT",
  "HEAD_PAUSE",
  "HEAD_RESUME",
  "HEAD_CALIBRATE",
  "SIDEBAR_COLLAPSE",
  "SIDEBAR_EXPAND"
] as const;

export const aksaIntentSchema = z.enum(aksaIntentNames);
export type AksaIntent = z.infer<typeof aksaIntentSchema>;

export const aksaIntentResolutionSchema = z.union([
  aksaIntentSchema,
  z.literal("UNKNOWN")
]);
export type AksaIntentResolution = z.infer<typeof aksaIntentResolutionSchema>;

export const aksaSemanticIntentResponseSchema = z
  .object({ intent: aksaIntentResolutionSchema })
  .strict();

export const aksaSemanticIntentRequestSchema = z
  .object({
    transcript: z.string().trim().min(1).max(COMMAND_TEXT_MAX_LENGTH),
    locale: commandLocaleSchema
  })
  .strict();

export type AksaSemanticIntentRequest = z.infer<typeof aksaSemanticIntentRequestSchema>;
