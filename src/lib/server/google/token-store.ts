import { assertServerOnly } from "@/lib/server/server-guard";
import { refreshAccessToken, type GoogleTokens } from "@/lib/server/google/oauth";

assertServerOnly("src/lib/server/google/token-store.ts");

/**
 * In-memory token store for the Docs PoC.
 *
 * Stores Google OAuth tokens keyed by a session identifier. In a production
 * implementation, refresh tokens would be encrypted at rest in the database
 * per `.agents/security.md` section 4. This in-memory store is sufficient for
 * the PoC since there is no auth library installed yet.
 *
 * For the PoC, a single "dev" user session is used.
 */

type StoredConnection = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  accountEmail: string | null;
};

const store = new Map<string, StoredConnection>();

/** Default session key for the PoC (single-user dev mode). */
const POC_SESSION_KEY = "poc-dev-user";

export function storeGoogleTokens(
  tokens: GoogleTokens,
  email: string | null,
  sessionKey: string = POC_SESSION_KEY
): void {
  if (!tokens.refreshToken) {
    throw new Error("Cannot store connection without a refresh token");
  }

  store.set(sessionKey, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    accountEmail: email
  });
}

export function getStoredConnection(
  sessionKey: string = POC_SESSION_KEY
): StoredConnection | null {
  return store.get(sessionKey) ?? null;
}

export function clearStoredConnection(
  sessionKey: string = POC_SESSION_KEY
): void {
  store.delete(sessionKey);
}

/**
 * Get a valid access token, refreshing if expired.
 * Returns null if no connection exists.
 */
export async function getValidAccessToken(
  sessionKey: string = POC_SESSION_KEY
): Promise<string | null> {
  const connection = store.get(sessionKey);
  if (!connection) {
    return null;
  }

  /** Refresh 60 seconds before expiry to avoid edge-case failures. */
  if (Date.now() > connection.expiresAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken(connection.refreshToken);
      connection.accessToken = refreshed.accessToken;
      connection.expiresAt = refreshed.expiresAt;
      if (refreshed.scope) {
        connection.scope = refreshed.scope;
      }
    } catch {
      /** Refresh failed. Mark as needing reconnect by clearing. */
      store.delete(sessionKey);
      return null;
    }
  }

  return connection.accessToken;
}

export function isGoogleConnected(
  sessionKey: string = POC_SESSION_KEY
): boolean {
  return store.has(sessionKey);
}

export function getConnectedEmail(
  sessionKey: string = POC_SESSION_KEY
): string | null {
  return store.get(sessionKey)?.accountEmail ?? null;
}
