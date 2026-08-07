import { headers } from "next/headers";
import { assertServerOnly } from "@/lib/server/server-guard";
import { authStatus } from "@/lib/server/config/runtime-config";
import { validationFailedError, authFailedError, notConfiguredError } from "@/lib/server/errors/aksa-error";
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
import { auth } from "@/lib/server/auth/better-auth";
import { getSession, getAccessibilityProfile, saveAccessibilityProfile as saveProfileToDb, bootstrapUserWorkspaceAndProfile } from "@/lib/server/db/dal";

assertServerOnly("src/lib/server/auth/service.ts");

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

    async signOut(): Promise<void> {},

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

function createRealAuthGateway(): AuthGateway {
  return {
    async readSessionState(): Promise<SessionState> {
      const session = await getSession();
      if (!session) {
        return { status: "anonymous" };
      }
      return { status: "authenticated", session };
    },

    async signUp(input): Promise<AuthResult> {
      const parsed = signUpInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          outcome: "invalid_input",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: (issue.path[0] as "email" | "password" | "displayName" | "form") || "form",
            messageKey: "error.validation_failed"
          }))
        };
      }

      try {
        const reqHeaders = await headers();
        const res = await auth.api.signUpEmail({
          body: {
            email: parsed.data.email,
            password: parsed.data.password,
            name: parsed.data.displayName || parsed.data.email.split("@")[0]
          },
          headers: reqHeaders
        });

        if (!res || !res.user) {
          return { outcome: "rejected", error: authFailedError() };
        }

        const bootstrap = await bootstrapUserWorkspaceAndProfile(
          res.user.id,
          res.user.email,
          res.user.name
        );

        const sessionDto = {
          userId: res.user.id,
          email: res.user.email,
          displayName: res.user.name ?? null,
          workspaceId: bootstrap.workspaceId,
          locale: parsed.data.locale,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
        };

        return { outcome: "authenticated", session: sessionDto };
      } catch {
        return {
          outcome: "invalid_input",
          fieldErrors: [{ field: "form", messageKey: "error.account_exists_or_failed" }]
        };
      }
    },

    async signIn(input): Promise<AuthResult> {
      const parsed = signInInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          outcome: "invalid_input",
          fieldErrors: [{ field: "form", messageKey: "error.validation_failed" }]
        };
      }

      try {
        const reqHeaders = await headers();
        const res = await auth.api.signInEmail({
          body: {
            email: parsed.data.email,
            password: parsed.data.password
          },
          headers: reqHeaders
        });

        if (!res || !res.user) {
          return { outcome: "rejected", error: authFailedError() };
        }

        const bootstrap = await bootstrapUserWorkspaceAndProfile(
          res.user.id,
          res.user.email,
          res.user.name
        );

        const sessionDto = {
          userId: res.user.id,
          email: res.user.email,
          displayName: res.user.name ?? null,
          workspaceId: bootstrap.workspaceId,
          locale: parsed.data.locale,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
        };

        return { outcome: "authenticated", session: sessionDto };
      } catch {
        return {
          outcome: "invalid_input",
          fieldErrors: [{ field: "form", messageKey: "error.invalid_credentials" }]
        };
      }
    },

    async signOut(): Promise<void> {
      try {
        const reqHeaders = await headers();
        await auth.api.signOut({ headers: reqHeaders });
      } catch {
        // Sign-out is best-effort
      }
    },

    async readAccessibilityProfile(): Promise<AccessibilityProfile | null> {
      const session = await getSession();
      if (!session) return null;
      return getAccessibilityProfile(session.userId);
    },

    async saveAccessibilityProfile(profile): Promise<AccessibilityProfileSaveResult> {
      const session = await getSession();
      if (!session) {
        return { outcome: "unavailable", error: authFailedError() };
      }

      const parsed = accessibilityProfileSchema.safeParse(profile);
      if (!parsed.success) {
        return { outcome: "invalid_input", error: validationFailedError() };
      }

      const saved = await saveProfileToDb(session.userId, parsed.data);
      return { outcome: "saved", profile: saved };
    }
  };
}

export function authGateway(): AuthGateway {
  if (!authStatus().configured) {
    return createUnconfiguredAuthGateway();
  }
  return createRealAuthGateway();
}

export async function readSessionState(): Promise<SessionState> {
  return authGateway().readSessionState();
}

export async function readAccessibilityProfile(): Promise<AccessibilityProfile | null> {
  return authGateway().readAccessibilityProfile();
}

export function authConfiguration() {
  return authStatus();
}
