import { NextResponse } from "next/server";
import { buildAuthorizationUrl, isGoogleOAuthConfigured } from "@/lib/server/google/oauth";

/**
 * GET /api/google/auth
 *
 * Initiates the Google OAuth flow. Redirects the user to Google's consent screen.
 * The state parameter prevents CSRF.
 */
export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 503 }
    );
  }

  /**
   * Simple state token for CSRF protection.
   * In production, this would be a signed, time-limited token stored in the session.
   */
  const state = crypto.randomUUID();

  const authUrl = buildAuthorizationUrl(state);

  /** Store the state in a short-lived cookie for validation in the callback. */
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });

  return response;
}
