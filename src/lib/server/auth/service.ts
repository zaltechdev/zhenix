import { assertServerOnly } from "@/lib/server/server-guard";
import { authStatus } from "@/lib/server/config/runtime-config";
import { notConfiguredError, validationFailedError } from "@/lib/server/errors/aksa-error";
import {
  accessibilityProfileSchema,
  signInInputSchema,
  signUpInputSchema,
  type AccessibilityProfile,
  type AccessibilityProfileSaveResult,
  type AuthResult,
  type SessionState
} from "@/lib/contracts/auth";
import type { AuthGateway } from "@/lib/server/auth/gateway";

assertServerOnly("src/lib/server/auth/service.ts");

/**
 * Unconfigured account boundary.
 *
 * Every method validates its input and then reports the honest state. Nothing here
 * ever returns a session, so no route can mistake this for a working sign in.
 */
function createUnconfiguredAuthGateway(): AuthGateway {
  return {
    async readSessionState(): Promise<SessionState> {
      return { status: "unavailable", error: notConfiguredError() };
    },

    async signUp(input): Promise<AuthResult> {
      const parsed = signUpInputSchema.safeParse(input);
      if (!parsed.success) {
        return { outcome: "invalid_input", fieldErrors: [{ field: "form", messageKey: "error.validation_failed" }] };
      }
      return { outcome: "unavailable", error: notConfiguredError() };
    },

    async signIn(input): Promise<AuthResult> {
      const parsed = signInInputSchema.safeParse(input);
      if (!parsed.success) {
        return { outcome: "invalid_input", fieldErrors: [{ field: "form", messageKey: "error.validation_failed" }] };
      }
      return { outcome: "unavailable", error: notConfiguredError() };
    },

    async signOut(): Promise<void> {
      /* No session exists to revoke. */
    },

    async readAccessibilityProfile(): Promise<AccessibilityProfile | null> {
      return null;
    },

    async saveAccessibilityProfile(profile): Promise<AccessibilityProfileSaveResult> {
      const parsed = accessibilityProfileSchema.safeParse(profile);
      if (!parsed.success) {
        return { outcome: "invalid_input", error: validationFailedError() };
      }
      return { outcome: "unavailable", error: notConfiguredError() };
    }
  };
}

export function authGateway(): AuthGateway {
  /**
   * When an authentication library is installed and configured, resolve the real
   * gateway here. Until then the unconfigured gateway is the only implementation.
   */
  return createUnconfiguredAuthGateway();
}

export async function readSessionState(): Promise<SessionState> {
  return authGateway().readSessionState();
}

export function authConfiguration() {
  return authStatus();
}
