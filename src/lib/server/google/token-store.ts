import { eq, and } from "drizzle-orm";
import { assertServerOnly } from "@/lib/server/server-guard";
import {
  GoogleOAuthError,
  refreshAccessToken,
  revokeToken,
  type GoogleTokens
} from "@/lib/server/google/oauth";
import { encryptToken, decryptToken } from "@/lib/server/crypto/crypto";
import { auth } from "@/lib/server/auth/better-auth";
import { db } from "@/lib/server/db/client";
import { accounts, oauthConnections, users } from "@/lib/server/db/schema";

assertServerOnly("src/lib/server/google/token-store.ts");

async function getBetterAuthGoogleAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "google"))
  });
}

function hasBetterAuthGoogleTokens(
  account: Awaited<ReturnType<typeof getBetterAuthGoogleAccount>>
): boolean {
  return Boolean(account?.accessToken || account?.refreshToken);
}

function parseScopes(value: string | null | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}

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
  const betterAuthAccount = await getBetterAuthGoogleAccount(userId);
  if (hasBetterAuthGoogleTokens(betterAuthAccount)) {
    try {
      const tokens = await auth.api.getAccessToken({
        body: { providerId: "google", userId }
      });
      if (tokens.accessToken) return tokens.accessToken;
    } catch {
      // Legacy encrypted connection below remains a valid fallback during migration.
    }
  }

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
  if (hasBetterAuthGoogleTokens(await getBetterAuthGoogleAccount(userId))) return true;

  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });
  return connection?.status === "active";
}

export async function getConnectedEmail(userId: string): Promise<string | null> {
  if (hasBetterAuthGoogleTokens(await getBetterAuthGoogleAccount(userId))) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return user?.email ?? null;
  }

  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });
  return connection?.status === "active" ? connection.providerEmail : null;
}

export async function getGrantedGoogleScopes(userId: string): Promise<string[]> {
  const betterAuthAccount = await getBetterAuthGoogleAccount(userId);
  if (hasBetterAuthGoogleTokens(betterAuthAccount)) {
    return parseScopes(betterAuthAccount?.scope);
  }

  const connection = await db.query.oauthConnections.findFirst({
    where: and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "google"))
  });
  if (!connection?.grantedScopes) return [];
  try {
    const parsed: unknown = JSON.parse(connection.grantedScopes);
    return Array.isArray(parsed)
      ? parsed.filter((scope): scope is string => typeof scope === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getGoogleConnectionState(
  userId: string
): Promise<"not_connected" | "connected" | "needs_reconnect" | "revoked"> {
  if (hasBetterAuthGoogleTokens(await getBetterAuthGoogleAccount(userId))) return "connected";

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
  const betterAuthAccount = await getBetterAuthGoogleAccount(userId);
  if (hasBetterAuthGoogleTokens(betterAuthAccount)) {
    try {
      const tokens = await auth.api.refreshToken({
        body: { providerId: "google", userId }
      });
      await revokeToken(tokens.refreshToken ?? tokens.accessToken);
    } catch {
      // Clear local credentials even when provider revocation cannot be completed.
    }

    await db
      .update(accounts)
      .set({
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        updatedAt: new Date()
      })
      .where(eq(accounts.id, betterAuthAccount!.id));
  }

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
