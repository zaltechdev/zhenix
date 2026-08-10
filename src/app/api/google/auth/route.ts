import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createGoogleOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured,
  parseGoogleOAuthReturnTo
} from "@/lib/server/google/oauth";
import { getSession } from "@/lib/server/db/dal";

/**
 * GET /api/google/auth
 *
 * Initiates the Google OAuth flow for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const returnTo = parseGoogleOAuthReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!isGoogleOAuthConfigured()) {
    const destination = new URL(returnTo, request.url);
    destination.searchParams.set("google_error", "not_configured");
    return NextResponse.redirect(destination);
  }

  const oauthState = createGoogleOAuthState(session.userId, returnTo);
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
