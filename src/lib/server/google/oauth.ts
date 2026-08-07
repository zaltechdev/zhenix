import { assertServerOnly } from "@/lib/server/server-guard";

assertServerOnly("src/lib/server/google/oauth.ts");

/**
 * Google OAuth 2.0 utilities for the Aksa Docs PoC.
 *
 * Uses direct fetch to Google token endpoints. No `googleapis` package.
 * Refresh tokens are stored server-side only. Access tokens are never sent to the client
 * except for the short-lived Picker token (see picker-token route).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Scopes for the Docs PoC. drive.file gives per-file access via Picker. */
const POC_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
  "openid",
  "email"
];

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
    return true;
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
    scope: POC_SCOPES.join(" "),
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
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();

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
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? "",
    idToken: data.id_token ?? null
  };
}

/**
 * Revoke a token with Google. Best-effort; does not throw on failure.
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
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
