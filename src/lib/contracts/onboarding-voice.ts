import { z } from "zod";
import { localeSchema } from "@/lib/contracts/auth";

export const onboardingVoiceIntentNames = [
  "check_include_sources",
  "uncheck_include_sources",
  "set_highlight_color",
  "unknown"
] as const;

export const onboardingVoiceIntentSchema = z.enum(onboardingVoiceIntentNames);
export type OnboardingVoiceIntent = z.infer<typeof onboardingVoiceIntentSchema>;

export const onboardingVoiceColors = ["yellow", "blue", "red"] as const;
export const onboardingVoiceColorSchema = z.enum(onboardingVoiceColors);
export type OnboardingVoiceColor = z.infer<typeof onboardingVoiceColorSchema>;

export const onboardingVoiceDemoStateSchema = z
  .object({
    includeSources: z.boolean(),
    addSummary: z.boolean(),
    highlightColor: onboardingVoiceColorSchema
  })
  .strict();

export type OnboardingVoiceDemoState = z.infer<typeof onboardingVoiceDemoStateSchema>;

export const onboardingVoiceIntentResultSchema = z
  .object({
    intent: onboardingVoiceIntentSchema,
    color: onboardingVoiceColorSchema.nullable()
  })
  .strict()
  .superRefine((value, context) => {
    const colorRequired = value.intent === "set_highlight_color";
    if (colorRequired && value.color === null) {
      context.addIssue({ code: "custom", path: ["color"], message: "Color required" });
    }
    if (!colorRequired && value.color !== null) {
      context.addIssue({ code: "custom", path: ["color"], message: "Color must be null" });
    }
  });

export type OnboardingVoiceIntentResult = z.infer<typeof onboardingVoiceIntentResultSchema>;

export const ONBOARDING_TRANSCRIPT_MAX_LENGTH = 240;

export const onboardingVoiceRequestSchema = z
  .object({
    transcript: z.string().trim().min(1).max(ONBOARDING_TRANSCRIPT_MAX_LENGTH),
    locale: localeSchema,
    state: onboardingVoiceDemoStateSchema
  })
  .strict();

export type OnboardingVoiceRequest = z.infer<typeof onboardingVoiceRequestSchema>;

export const onboardingVoiceUnavailableReasonSchema = z.enum([
  "authentication_required",
  "not_configured",
  "rate_limited",
  "timeout",
  "unavailable"
]);

export type OnboardingVoiceUnavailableReason = z.infer<
  typeof onboardingVoiceUnavailableReasonSchema
>;

export const onboardingVoiceMatchedResponseSchema = z
  .object({
    outcome: z.literal("matched"),
    source: z.enum(["local", "semantic"]),
    intent: onboardingVoiceIntentSchema,
    color: onboardingVoiceColorSchema.nullable()
  })
  .strict()
  .superRefine((value, context) => {
    const colorRequired = value.intent === "set_highlight_color";
    if (colorRequired && value.color === null) {
      context.addIssue({ code: "custom", path: ["color"], message: "Color required" });
    }
    if (!colorRequired && value.color !== null) {
      context.addIssue({ code: "custom", path: ["color"], message: "Color must be null" });
    }
    if (value.intent === "unknown") {
      context.addIssue({ code: "custom", path: ["intent"], message: "Unknown is not matched" });
    }
  });

export const onboardingVoiceClassificationSchema = z.discriminatedUnion("outcome", [
  onboardingVoiceMatchedResponseSchema,
  z.object({ outcome: z.literal("unknown") }).strict(),
  z
    .object({
      outcome: z.literal("unavailable"),
      reason: onboardingVoiceUnavailableReasonSchema
    })
    .strict(),
  z
    .object({
      outcome: z.literal("rejected"),
      reason: z.literal("validation_failed")
    })
    .strict()
]);

export type OnboardingVoiceClassification = z.infer<
  typeof onboardingVoiceClassificationSchema
>;
