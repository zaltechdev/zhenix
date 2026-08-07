import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, extractEmailFromIdToken } from "@/lib/server/google/oauth";
import { storeGoogleTokens } from "@/lib/server/google/token-store";

/**
 * GET /api/google/callback
 *
 * Google OAuth callback. Exchanges the authorization code for tokens,
 * stores them server-side, and redirects to the workspace.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  /** User denied consent. */
  if (error) {
    return NextResponse.redirect(
      new URL("/workspace?google_error=consent_denied", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/workspace?google_error=missing_code", request.url)
    );
  }

  /** Validate CSRF state. */
  const storedState = request.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/workspace?google_error=invalid_state", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = tokens.idToken ? extractEmailFromIdToken(tokens.idToken) : null;

    storeGoogleTokens(tokens, email);

    const response = NextResponse.redirect(
      new URL("/workspace/documents", request.url)
    );

    /** Clear the CSRF state cookie. */
    response.cookies.delete("google_oauth_state");

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/workspace?google_error=token_exchange_failed", request.url)
    );
  }
}
