import { z } from "zod";
import { aksaErrorSchema } from "@/lib/contracts/errors";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Minimum length enforced server-side, no composition puzzles, no truncation.
 * See `.agents/security.md` section 1.
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(320);

export const localeSchema = z.enum(["en", "id"]);

export const signUpInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(120).optional(),
  locale: localeSchema
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  locale: localeSchema
});

export type SignInInput = z.infer<typeof signInInputSchema>;

/**
 * Minimal session DTO. No password hash, no session token, and no internal
 * identifier ever reaches the client.
 */
export const sessionSchema = z.object({
  userId: z.string().min(1).max(200),
  email: emailSchema,
  displayName: z.string().max(120).nullable(),
  workspaceId: z.string().min(1).max(200),
  locale: localeSchema,
  expiresAt: z.number().int().nonnegative()
});

export type Session = z.infer<typeof sessionSchema>;

export const sessionStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("authenticated"), session: sessionSchema }),
  z.object({ status: z.literal("anonymous") }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("unavailable"), error: aksaErrorSchema })
]);

export type SessionState = z.infer<typeof sessionStateSchema>;

/**
 * Field-level errors keyed by form field, plus a form-level summary category.
 * The interface moves focus to the summary after a failed submission.
 */
export const authFieldErrorSchema = z.object({
  field: z.enum(["email", "password", "displayName", "form"]),
  messageKey: z.string().min(1).max(120)
});

export type AuthFieldError = z.infer<typeof authFieldErrorSchema>;

export const authResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("authenticated"), session: sessionSchema }),
  z.object({
    outcome: z.literal("invalid_input"),
    fieldErrors: z.array(authFieldErrorSchema).min(1)
  }),
  z.object({ outcome: z.literal("rejected"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("unavailable"), error: aksaErrorSchema })
]);

export type AuthResult = z.infer<typeof authResultSchema>;

/* Accessibility profile, owned by the account once sessions exist */

export const selectionModeSchema = z.enum(["dwell", "gesture", "both", "off"]);
export const gestureTypeSchema = z.enum(["mouth_open", "brow_raise", "eye_blink_long", "smile"]);
export const reacquisitionPointerBehaviorSchema = z.enum(["keep_position", "reset_center"]);

export const accessibilityProfileSchema = z.object({
  pointerSensitivity: z.number().int().min(0).max(100),
  deadZone: z.number().int().min(0).max(100),
  smoothing: z.number().int().min(0).max(100),
  selectionMode: selectionModeSchema,
  dwellDurationMs: z.number().int().min(300).max(5000).nullable(),
  gestureType: gestureTypeSchema.nullable(),
  gestureThreshold: z.number().int().min(0).max(100).nullable(),
  gestureCooldownMs: z.number().int().min(0).max(5000).nullable(),
  reacquisitionPointerBehavior: reacquisitionPointerBehaviorSchema.default("keep_position"),
  reducedMotion: z.boolean()
});

export type AccessibilityProfile = z.infer<typeof accessibilityProfileSchema>;

/**
 * Defaults are marked provisional because `.agents/prd.md` OQ-5 and
 * `.agents/features/accessibility-controls.md` ACQ-1 are unresolved. They are a
 * usable starting configuration, not a tested recommendation.
 */
export const provisionalAccessibilityProfile: AccessibilityProfile = {
  pointerSensitivity: 50,
  deadZone: 20,
  smoothing: 40,
  selectionMode: "dwell",
  dwellDurationMs: 1200,
  gestureType: null,
  gestureThreshold: null,
  gestureCooldownMs: null,
  reacquisitionPointerBehavior: "keep_position",
  reducedMotion: false
};

export const accessibilityProfileSaveResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("saved"), profile: accessibilityProfileSchema }),
  z.object({ outcome: z.literal("invalid_input"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("unavailable"), error: aksaErrorSchema })
]);

export type AccessibilityProfileSaveResult = z.infer<typeof accessibilityProfileSaveResultSchema>;

export const textSizeSchema = z.enum(["default", "large", "extra_large"]);
export const themeSchema = z.enum(["system", "light", "dark"]);
export const headPresetSchema = z.enum(["auto", "standard", "low_light", "custom"]);
export const voiceLanguageSchema = z.enum(["follow", "id", "en"]);
export const voiceModeSchema = z.enum(["dictation", "commands", "both"]);

/**
 * Preferences that affect presentation or control availability, stored beside
 * the accessibility profile without exposing account identity to the client.
 */
export const userPreferencesSchema = z.object({
  highContrast: z.boolean(),
  textSize: textSizeSchema,
  reducedMotion: z.boolean(),
  theme: themeSchema,
  language: localeSchema,
  headControlEnabled: z.boolean(),
  voiceControlEnabled: z.boolean(),
  headPreset: headPresetSchema,
  voiceLanguage: voiceLanguageSchema,
  voiceMode: voiceModeSchema,
  sidebarCollapsed: z.boolean()
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const defaultUserPreferences: UserPreferences = {
  highContrast: false,
  textSize: "default",
  reducedMotion: false,
  theme: "system",
  language: "en",
  headControlEnabled: false,
  voiceControlEnabled: true,
  headPreset: "auto",
  voiceLanguage: "follow",
  voiceMode: "both",
  sidebarCollapsed: false
};

export const userPreferencesSaveResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("saved"), preferences: userPreferencesSchema }),
  z.object({ outcome: z.literal("invalid_input"), error: aksaErrorSchema }),
  z.object({ outcome: z.literal("unavailable"), error: aksaErrorSchema })
]);

export type UserPreferencesSaveResult = z.infer<typeof userPreferencesSaveResultSchema>;
