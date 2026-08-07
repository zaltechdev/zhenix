import { eq, and } from "drizzle-orm";
import { assertServerOnly } from "@/lib/server/server-guard";
import { refreshAccessToken, revokeToken, type GoogleTokens } from "@/lib/server/google/oauth";
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
  email: string | null
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
  const scopesJson = JSON.stringify(tokens.scope.split(" ").filter(Boolean));

  const existing = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  if (existing) {
    await db
      .update(oauthConnections)
      .set({
        providerEmail: email ?? existing.providerEmail,
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
  } catch {
    // Mark connection as needing reconnect on refresh failure
    await db
      .update(oauthConnections)
      .set({ status: "needs_reconnect", updatedAt: Date.now() })
      .where(eq(oauthConnections.id, connection.id));

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

export async function clearStoredConnection(userId: string): Promise<void> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });

  if (connection && connection.refreshTokenCiphertext) {
    try {
      const refreshToken = decryptToken(connection.refreshTokenCiphertext);
      await revokeToken(refreshToken);
    } catch {
      // Best-effort revocation
    }

    await db.delete(oauthConnections).where(eq(oauthConnections.id, connection.id));
  }
}
