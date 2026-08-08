import { z } from "zod";

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

