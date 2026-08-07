import { z } from "zod";

/**
 * Stable error categories shared by every Aksa boundary.
 *
 * A category is safe to display and safe to log. Raw provider messages, Google
 * payloads, stack traces, and internal identifiers never reach the client.
 * See `.agents/rules.md` section 15 and `.agents/security.md` section 1.
 */
export const errorCategories = [
  "not_configured",
  "connection_required",
  "scope_required",
  "authentication_required",
  "session_expired",
  "permission_denied",
  "not_found",
  "unsupported",
  "unavailable",
  "rate_limited",
  "timeout",
  "validation_failed",
  "verification_failed",
  "partial_failure",
  "cancelled",
  "undo_unavailable",
  "internal_error"
] as const;

export const errorCategorySchema = z.enum(errorCategories);
export type ErrorCategory = z.infer<typeof errorCategorySchema>;

/**
 * The safe next steps a user can take. The interface maps each value to
 * localized copy and, where relevant, to a control.
 */
export const nextActions = [
  "retry",
  "sign_in",
  "connect_google",
  "grant_capability",
  "narrow_scope",
  "wait_and_retry",
  "use_text_input",
  "use_keyboard",
  "configure_deployment",
  "cancel_task",
  "none"
] as const;

export const nextActionSchema = z.enum(nextActions);
export type NextAction = z.infer<typeof nextActionSchema>;

/**
 * What survived a partial or interrupted operation. Counts and item names are
 * required so the interface never has to estimate progress.
 */
export const preservedProgressSchema = z.object({
  completedCount: z.number().int().min(0),
  remainingCount: z.number().int().min(0),
  completedItemNames: z.array(z.string().max(300)),
  remainingItemNames: z.array(z.string().max(300))
});

export type PreservedProgress = z.infer<typeof preservedProgressSchema>;

export const aksaErrorSchema = z.object({
  category: errorCategorySchema,
  /** Stable localization key derived from the category. Never free-form prose. */
  messageKey: z.string().min(1).max(120),
  retryable: z.boolean(),
  preservedProgress: preservedProgressSchema.nullable(),
  nextActions: z.array(nextActionSchema).min(1),
  /**
   * Correlation reference safe to write to a log line. Contains no user
   * content, no token, and no provider payload.
   */
  debugReference: z.string().min(1).max(80)
});

export type AksaError = z.infer<typeof aksaErrorSchema>;

const retryableCategories = new Set<ErrorCategory>([
  "unavailable",
  "rate_limited",
  "timeout",
  "internal_error",
  "verification_failed",
  "partial_failure"
]);

export function isRetryableCategory(category: ErrorCategory): boolean {
  return retryableCategories.has(category);
}

export function errorMessageKey(category: ErrorCategory): string {
  return `error.${category}`;
}

/**
 * Default next actions per category.
 *
 * Kept in one place so no feature invents its own recovery vocabulary and no
 * category ever reaches the interface without at least one way forward.
 */
const defaultNextActions: Record<ErrorCategory, NextAction[]> = {
  not_configured: ["configure_deployment"],
  connection_required: ["connect_google"],
  scope_required: ["grant_capability", "narrow_scope"],
  authentication_required: ["sign_in"],
  session_expired: ["sign_in"],
  permission_denied: ["grant_capability"],
  not_found: ["retry"],
  unsupported: ["use_text_input", "use_keyboard"],
  unavailable: ["retry"],
  rate_limited: ["wait_and_retry"],
  timeout: ["retry", "cancel_task"],
  validation_failed: ["retry"],
  verification_failed: ["retry"],
  partial_failure: ["retry"],
  cancelled: ["retry"],
  undo_unavailable: ["none"],
  internal_error: ["retry"]
};

let referenceSequence = 0;

/**
 * Correlation reference safe for a log line. Contains no user content, no token,
 * and no provider payload.
 */
function createDebugReference(category: ErrorCategory): string {
  referenceSequence = (referenceSequence + 1) % 100000;
  return `${category}-${referenceSequence.toString(36)}`;
}

/**
 * Shared error factory.
 *
 * Lives in the contracts layer because both the server boundary and the browser
 * need to build a well-formed error, for example when a request never reaches
 * Aksa at all.
 */
export function createAksaError(
  category: ErrorCategory,
  options: {
    nextActions?: NextAction[];
    preservedProgress?: PreservedProgress | null;
    retryable?: boolean;
    debugReference?: string;
  } = {}
): AksaError {
  const nextActions = options.nextActions ?? defaultNextActions[category];

  return {
    category,
    messageKey: errorMessageKey(category),
    retryable: options.retryable ?? isRetryableCategory(category),
    preservedProgress: options.preservedProgress ?? null,
    nextActions: nextActions.length > 0 ? nextActions : ["none"],
    debugReference: options.debugReference ?? createDebugReference(category)
  };
}
