import { assertServerOnly } from "@/lib/server/server-guard";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fetchGoogleJson } from "@/lib/server/google/http";
import { googleApiConfig } from "@/lib/server/config/runtime-config";

assertServerOnly("src/lib/server/google/oauth.ts");

/**
 * Google OAuth 2.0 utilities for the Aksa Docs MVP.
 *
 * Uses direct fetch to Google token endpoints. No `googleapis` package.
 * Refresh tokens are stored server-side only. Access tokens are never sent to the client
 * The Docs MVP keeps all access tokens on the server; the browser receives only
 * normalized metadata and document models.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Least-privilege scopes for server-side Docs discovery, read, and append write. */
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

/**
 * Drive metadata is used only to discover real Docs. Docs permission covers the
 * single read and append-write path in this phase. No Sheets, Gmail, or Slides
 * permission is requested.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents",
  "openid",
  "email"
] as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.startsWith("replace-with") || value.startsWith("your-")) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

export function googleOAuthConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI")
  };
}

export function isGoogleOAuthConfigured(): boolean {
  try {
    googleOAuthConfig();
    requireEnv("AUTH_SECRET");
    requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY");
    return true;
  } catch {
    return false;
  }
}

type OAuthStatePayload = {
  state: string;
  userId: string;
  issuedAt: number;
};

const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable().optional(),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
  id_token: z.string().min(1).nullable().optional()
});

function authStateSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.startsWith("replace-with") || value.length < 32) {
    throw new Error("Missing required env: AUTH_SECRET");
  }
  return value;
}

function encodeState(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signState(encoded: string): string {
  return createHmac("sha256", authStateSecret()).update(encoded).digest("base64url");
}

/** Creates a cookie value bound to the authenticated Aksa user who initiated OAuth. */
export function createGoogleOAuthState(userId: string): { state: string; cookieValue: string } {
  const state = crypto.randomUUID();
  const encoded = encodeState({ state, userId, issuedAt: Date.now() });
  return { state, cookieValue: `${encoded}.${signState(encoded)}` };
}

/** Verifies the state, its age, and the initiating authenticated Aksa user. */
export function verifyGoogleOAuthState(
  cookieValue: string | undefined,
  expectedState: string | null,
  expectedUserId: string
): boolean {
  if (!cookieValue || !expectedState) return false;

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return false;

  try {
    const expectedSignature = signState(encoded);
    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    // Base64url decoding ignores unused trailing bits, so compare the canonical
    // encoded signature too; otherwise a one-character suffix mutation can decode
    // to the same MAC bytes.
    if (
      signature.length !== expectedSignature.length ||
      signature !== expectedSignature ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    const age = Date.now() - payload.issuedAt;
    return (
      payload.state === expectedState &&
      payload.userId === expectedUserId &&
      Number.isFinite(payload.issuedAt) &&
      age >= 0 &&
      age <= 10 * 60 * 1000
    );
  } catch {
    return false;
  }
}

/**
 * Build the Google OAuth authorization URL.
 * Uses `access_type=offline` to get a refresh token on first consent.
 */
export function buildAuthorizationUrl(state: string): string {
  const config = googleOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true"
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
  idToken: string | null;
};

type GoogleUserInfo = {
  sub?: unknown;
  email?: unknown;
};

export class GoogleOAuthError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null) {
    super("Google OAuth request failed");
    this.status = status;
    this.code = code;
    this.name = "GoogleOAuthError";
  }
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const config = googleOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    }),
    signal: AbortSignal.timeout(googleApiConfig().timeoutMs)
  });

  if (!response.ok) {
    let code: string | null = null;
    try {
      const data = (await response.json()) as { error?: unknown };
      code = typeof data.error === "string" ? data.error : null;
    } catch {
      // Keep provider response details out of errors and logs.
    }
    throw new GoogleOAuthError(response.status, code);
  }

  const data = googleTokenResponseSchema.parse(await response.json());

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? "",
    idToken: data.id_token ?? null
  };
}

/**
 * Refresh an access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const config = googleOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(googleApiConfig().timeoutMs)
  });

  if (!response.ok) {
    let code: string | null = null;
    try {
      const data = (await response.json()) as { error?: unknown };
      code = typeof data.error === "string" ? data.error : null;
    } catch {
      // Keep provider response details out of errors and logs.
    }
    throw new GoogleOAuthError(response.status, code);
  }

  const data = googleTokenResponseSchema.parse(await response.json());

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? "",
    idToken: data.id_token ?? null
  };
}

/** Uses the access token at Google's userinfo endpoint instead of trusting unverified JWT claims. */
export async function getGoogleUserInfo(accessToken: string): Promise<{ sub: string; email: string | null }> {
  const userInfo = await fetchGoogleJson<GoogleUserInfo>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    },
    "openid.userinfo"
  );
  if (typeof userInfo.sub !== "string" || userInfo.sub.length === 0) {
    throw new GoogleOAuthError(500, null);
  }
  return {
    sub: userInfo.sub,
    email: typeof userInfo.email === "string" ? userInfo.email : null
  };
}

/**
 * Revoke a token with Google. Best-effort; does not throw on failure.
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(googleApiConfig().timeoutMs)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Extract the user's email from a Google ID token (JWT).
 * Decodes without verification since we trust the token endpoint response.
 */
export function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf-8")
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export function extractSubjectFromIdToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf-8")
    );
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
