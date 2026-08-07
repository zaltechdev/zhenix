import type {
  AccessibilityProfile,
  AccessibilityProfileSaveResult,
  AuthResult,
  SessionState,
  SignInInput,
  SignUpInput
} from "@/lib/contracts/auth";

/**
 * The account boundary Zaltech implements.
 *
 * Henix depends on this interface only. Session cookies, password hashing,
 * rotation, revocation, and rate limiting all live behind it. The repository has
 * no authentication library installed, so the current implementation reports
 * `not_configured` rather than guessing at one. See `.agents/features/auth-onboarding.md`
 * AOQ-1 and `.agents/db_schema.md` DQ-1.
 */
export type AuthGateway = {
  readSessionState(): Promise<SessionState>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  readAccessibilityProfile(): Promise<AccessibilityProfile | null>;
  saveAccessibilityProfile(profile: AccessibilityProfile): Promise<AccessibilityProfileSaveResult>;
};
