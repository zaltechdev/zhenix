import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, extractEmailFromIdToken } from "@/lib/server/google/oauth";
import { storeGoogleTokens } from "@/lib/server/google/token-store";
import { getSession } from "@/lib/server/db/dal";

/**
 * GET /api/google/callback
 *
 * Google OAuth callback. Binds the Google connection to the authenticated user's session.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in?auth_error=session_required", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/workspace?google_error=consent_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/workspace?google_error=missing_code", request.url));
  }

  const storedState = request.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/workspace?google_error=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = tokens.idToken ? extractEmailFromIdToken(tokens.idToken) : null;

    await storeGoogleTokens(session.userId, tokens, email);

    const response = NextResponse.redirect(new URL("/workspace/documents", request.url));
    response.cookies.delete("google_oauth_state");

    return response;
  } catch {
    return NextResponse.redirect(new URL("/workspace?google_error=token_exchange_failed", request.url));
  }
}
