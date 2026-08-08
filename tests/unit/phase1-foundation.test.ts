import { describe, expect, it, beforeEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/server/crypto/crypto";
import { db } from "@/lib/server/db/client";
import { users, workspaces, accessibilityProfiles, oauthConnections } from "@/lib/server/db/schema";
import { bootstrapUserWorkspaceAndProfile, getAccessibilityProfile, saveAccessibilityProfile } from "@/lib/server/db/dal";
import { storeGoogleTokens, isGoogleConnected, getConnectedEmail, clearStoredConnection, getValidAccessToken } from "@/lib/server/google/token-store";
import { eq } from "drizzle-orm";

const TEST_KEY = "test-high-entropy-oauth-token-encryption-key-32bytes";

describe("Phase I Foundation - Crypto & Token Encryption", () => {
  beforeEach(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it("encrypts refresh token at rest and decrypts back accurately", () => {
    const originalToken = "1//04_example_refresh_token_secret_123456";
    const encrypted = encryptToken(originalToken);

    expect(encrypted.ciphertext).not.toBe(originalToken);
    expect(encrypted.ciphertext.length).toBeGreaterThan(20);
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = decryptToken(encrypted.ciphertext);
    expect(decrypted).toBe(originalToken);
  });

  it("fails closed when OAUTH_TOKEN_ENCRYPTION_KEY is missing or placeholder", () => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("some-token")).toThrow("OAUTH_TOKEN_ENCRYPTION_KEY configuration is missing or unconfigured");

    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = "replace-with-a-high-entropy-encryption-key";
    expect(() => encryptToken("some-token")).toThrow("OAUTH_TOKEN_ENCRYPTION_KEY configuration is missing or unconfigured");

    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it("throws on corrupted ciphertext", () => {
    expect(() => decryptToken("invalid-base64")).toThrow();
  });
});

describe("Phase I Foundation - User Bootstrap & Idempotency", () => {
  const userId = "test_user_phase1_1";
  const userEmail = "test1@example.com";

  beforeEach(async () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, userId));
    await db.delete(accessibilityProfiles).where(eq(accessibilityProfiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    await db.insert(users).values({
      id: userId,
      email: userEmail,
      name: "Test User 1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("bootstraps workspace and accessibility profile idempotently", async () => {
    const firstCall = await bootstrapUserWorkspaceAndProfile(userId, userEmail, "Test User 1");
    expect(firstCall.workspaceId).toBeDefined();

    const profile = await getAccessibilityProfile(userId);
    expect(profile).not.toBeNull();
    expect(profile?.pointerSensitivity).toBe(50);
    expect(profile?.selectionMode).toBe("dwell");
    expect(profile?.reacquisitionPointerBehavior).toBe("keep_position");

    const secondCall = await bootstrapUserWorkspaceAndProfile(userId, userEmail, "Test User 1");
    expect(secondCall.workspaceId).toBe(firstCall.workspaceId);
  });

  it("saves and reloads accessibility profile updates", async () => {
    await bootstrapUserWorkspaceAndProfile(userId, userEmail, "Test User 1");

    const updated = await saveAccessibilityProfile(userId, {
      pointerSensitivity: 85,
      deadZone: 15,
      smoothing: 60,
      selectionMode: "both",
      dwellDurationMs: 800,
      gestureType: "smile",
      gestureThreshold: 70,
      gestureCooldownMs: 300,
      reacquisitionPointerBehavior: "reset_center",
      reducedMotion: true
    });

    expect(updated.pointerSensitivity).toBe(85);
    expect(updated.selectionMode).toBe("both");
    expect(updated.reacquisitionPointerBehavior).toBe("reset_center");
    expect(updated.reducedMotion).toBe(true);

    const reloaded = await getAccessibilityProfile(userId);
    expect(reloaded?.pointerSensitivity).toBe(85);
    expect(reloaded?.gestureType).toBe("smile");
    expect(reloaded?.reacquisitionPointerBehavior).toBe("reset_center");
  });
});

describe("Phase I Foundation - Encrypted User-Scoped Google Token Storage", () => {
  const userA = "user_A_google_test";
  const userB = "user_B_google_test";

  beforeEach(async () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    await db.delete(oauthConnections).where(eq(oauthConnections.userId, userA));
    await db.delete(oauthConnections).where(eq(oauthConnections.userId, userB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));

    await db.insert(users).values({
      id: userA,
      email: "usera@example.com",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.insert(users).values({
      id: userB,
      email: "userb@example.com",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("stores Google connection with encrypted refresh token scoped strictly to user A", async () => {
    await storeGoogleTokens(
      userA,
      {
        accessToken: "access_token_user_a",
        refreshToken: "refresh_token_user_a_secret",
        expiresAt: Date.now() + 3600000,
        scope: "https://www.googleapis.com/auth/documents openid email",
        idToken: null
      },
      "usera.google@example.com"
    );

    expect(await isGoogleConnected(userA)).toBe(true);
    expect(await getConnectedEmail(userA)).toBe("usera.google@example.com");

    expect(await isGoogleConnected(userB)).toBe(false);
    expect(await getConnectedEmail(userB)).toBeNull();

    const dbRow = await db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.userId, userA)
    });
    expect(dbRow?.refreshTokenCiphertext).toBeDefined();
    expect(dbRow?.refreshTokenCiphertext).not.toContain("refresh_token_user_a_secret");
  });

  it("handles valid access token lookup correctly", async () => {
    await storeGoogleTokens(
      userA,
      {
        accessToken: "access_token_user_a",
        refreshToken: "refresh_token_user_a_secret",
        expiresAt: Date.now() + 3600000,
        scope: "email",
        idToken: null
      },
      "usera@example.com"
    );

    const tokenB = await getValidAccessToken(userB);
    expect(tokenB).toBeNull();
  });

  it("disconnecting User A does not affect User B", async () => {
    await storeGoogleTokens(
      userA,
      {
        accessToken: "acc_a",
        refreshToken: "ref_a",
        expiresAt: Date.now() + 3600000,
        scope: "email",
        idToken: null
      },
      "usera@example.com"
    );
    await storeGoogleTokens(
      userB,
      {
        accessToken: "acc_b",
        refreshToken: "ref_b",
        expiresAt: Date.now() + 3600000,
        scope: "email",
        idToken: null
      },
      "userb@example.com"
    );

    await clearStoredConnection(userA);

    expect(await isGoogleConnected(userA)).toBe(false);
    expect(await isGoogleConnected(userB)).toBe(true);
  });
});
