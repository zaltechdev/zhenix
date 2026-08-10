import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildAuthorizationUrl,
  createGoogleOAuthState,
  GOOGLE_SCOPES,
  googleOAuthReturnToFromState,
  parseGoogleOAuthReturnTo,
  verifyGoogleOAuthState
} from "@/lib/server/google/oauth";

describe("Google OAuth MVP", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-long-enough-for-state-signing";
    process.env.GOOGLE_CLIENT_ID = "client-id-for-tests";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret-for-tests";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  it("requests only identity, Drive metadata, and Docs scopes", () => {
    const url = buildAuthorizationUrl("state-1");
    const scopes = new URL(url).searchParams.get("scope")?.split(" ") ?? [];

    expect(scopes).toEqual([...GOOGLE_SCOPES]);
    expect(scopes.some((scope) => scope.includes("sheets") || scope.includes("gmail"))).toBe(false);
  });

  it("binds OAuth state to the initiating Aksa user", () => {
    const created = createGoogleOAuthState("aksa-user-a", "/onboarding");

    expect(verifyGoogleOAuthState(created.cookieValue, created.state, "aksa-user-a")).toBe(true);
    expect(verifyGoogleOAuthState(created.cookieValue, created.state, "aksa-user-b")).toBe(false);
    expect(verifyGoogleOAuthState(created.cookieValue, "different-state", "aksa-user-a")).toBe(false);
    expect(
      googleOAuthReturnToFromState(created.cookieValue, created.state, "aksa-user-a")
    ).toBe("/onboarding");
  });

  it("allows only bounded post-consent destinations", () => {
    expect(parseGoogleOAuthReturnTo("/onboarding")).toBe("/onboarding");
    expect(parseGoogleOAuthReturnTo("https://attacker.example")).toBe("/workspace/documents");
    expect(parseGoogleOAuthReturnTo("/workspace/settings")).toBe("/workspace/documents");
  });

  it("rejects a tampered OAuth state cookie", () => {
    const created = createGoogleOAuthState("aksa-user-a");
    const tampered = `${created.cookieValue.slice(0, -1)}x`;

    expect(verifyGoogleOAuthState(tampered, created.state, "aksa-user-a")).toBe(false);
  });
});
