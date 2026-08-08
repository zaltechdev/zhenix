import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createGoogleOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured
} from "@/lib/server/google/oauth";
import { getSession } from "@/lib/server/db/dal";

/**
 * GET /api/google/auth
 *
 * Initiates the Google OAuth flow for the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 503 }
    );
  }

  const oauthState = createGoogleOAuthState(session.userId);
  const authUrl = buildAuthorizationUrl(oauthState.state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, oauthState.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });

  return response;
}
