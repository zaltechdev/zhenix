import { eq, and } from "drizzle-orm";
import { assertServerOnly } from "@/lib/server/server-guard";
import {
  GoogleOAuthError,
  refreshAccessToken,
  revokeToken,
  type GoogleTokens
} from "@/lib/server/google/oauth";
import { encryptToken, decryptToken } from "@/lib/server/crypto/crypto";
import { db } from "@/lib/server/db/client";
import { oauthConnections } from "@/lib/server/db/schema";

assertServerOnly("src/lib/server/google/token-store.ts");

/**
 * User-Scoped DB Token Store for Google OAuth.
 *
 * Stores Google OAuth connection & encrypted refresh tokens in `oauth_connections` table,
 * scoped strictly to the authenticated Aksa user ID.
 */

export async function storeGoogleTokens(
  userId: string,
  tokens: GoogleTokens,
  email: string | null,
  providerAccountId: string | null = null
): Promise<void> {
  if (!tokens.refreshToken) {
    // If no new refresh token returned, keep existing ciphertext if present
    const existing = await db.query.oauthConnections.findFirst({
      where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
    });
    if (!existing || !existing.refreshTokenCiphertext) {
      throw new Error("Cannot store Google connection without a refresh token");
    }
  }

  const now = Date.now();
  const encrypted = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;
  const existing = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  const nextScopes = tokens.scope.split(" ").filter(Boolean);
  let previousScopes: string[] = [];
  if (existing?.grantedScopes) {
    try {
      const parsed: unknown = JSON.parse(existing.grantedScopes);
      if (Array.isArray(parsed)) previousScopes = parsed.filter((scope): scope is string => typeof scope === "string");
    } catch {
      previousScopes = [];
    }
  }
  const scopesJson = JSON.stringify(nextScopes.length > 0 ? nextScopes : previousScopes);

  if (existing) {
    await db
      .update(oauthConnections)
      .set({
        providerEmail: email ?? existing.providerEmail,
        providerAccountId: providerAccountId ?? existing.providerAccountId,
        refreshTokenCiphertext: encrypted?.ciphertext ?? existing.refreshTokenCiphertext,
        refreshTokenKeyVersion: encrypted?.keyVersion ?? existing.refreshTokenKeyVersion,
        grantedScopes: scopesJson,
        status: "active",
        lastVerifiedAt: now,
        updatedAt: now
      })
      .where(eq(oauthConnections.id, existing.id));
  } else {
    await db.insert(oauthConnections).values({
      id: `oauth_google_${userId}`,
      userId,
      provider: "google",
      providerAccountId,
      providerEmail: email,
      refreshTokenCiphertext: encrypted!.ciphertext,
      refreshTokenKeyVersion: encrypted!.keyVersion,
      grantedScopes: scopesJson,
      status: "active",
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now
    });
  }
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  if (!connection || connection.status !== "active" || !connection.refreshTokenCiphertext) {
    return null;
  }

  try {
    const refreshToken = decryptToken(connection.refreshTokenCiphertext);
    const refreshed = await refreshAccessToken(refreshToken);

    // Update verified timestamp
    await db
      .update(oauthConnections)
      .set({ lastVerifiedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(oauthConnections.id, connection.id));

    return refreshed.accessToken;
  } catch (error) {
    /** Only an invalid or rejected refresh credential requires reconnect. */
    if (
      error instanceof GoogleOAuthError &&
      (error.status === 400 || error.status === 401) &&
      (error.code === "invalid_grant" || error.code === "invalid_client" || error.code === null)
    ) {
      await db
        .update(oauthConnections)
        .set({ status: "needs_reconnect", updatedAt: Date.now() })
        .where(eq(oauthConnections.id, connection.id));
    }

    return null;
  }
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });
  return connection?.status === "active";
}

export async function getConnectedEmail(userId: string): Promise<string | null> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });
  return connection?.status === "active" ? connection.providerEmail : null;
}

export async function getGoogleConnectionState(
  userId: string
): Promise<"not_connected" | "connected" | "needs_reconnect" | "revoked"> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  if (!connection) return "not_connected";
  if (connection.status === "needs_reconnect") return "needs_reconnect";
  if (connection.status === "revoked") return "revoked";
  return "connected";
}

export async function markGoogleNeedsReconnect(userId: string): Promise<void> {
  await db
    .update(oauthConnections)
    .set({ status: "needs_reconnect", updatedAt: Date.now() })
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google")));
}

export async function clearStoredConnection(userId: string): Promise<void> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  if (!connection) return;

  if (connection.refreshTokenCiphertext) {
    try {
      const refreshToken = decryptToken(connection.refreshTokenCiphertext);
      await revokeToken(refreshToken);
    } catch {
      // Best-effort revocation
    }
  }

  await db.delete(oauthConnections).where(eq(oauthConnections.id, connection.id));
}
