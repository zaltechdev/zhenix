import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  GOOGLE_OAUTH_STATE_COOKIE,
  verifyGoogleOAuthState
} from "@/lib/server/google/oauth";
import { storeGoogleTokens } from "@/lib/server/google/token-store";
import { getSession, recordAuditLog, recordConsent } from "@/lib/server/db/dal";

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
  const storedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  const redirectWithError = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/workspace?google_error=${reason}`, request.url));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  };

  if (!verifyGoogleOAuthState(storedState, state, session.userId)) {
    return redirectWithError("invalid_state");
  }

  if (error) {
    return redirectWithError("consent_denied");
  }

  if (!code) {
    return redirectWithError("missing_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getGoogleUserInfo(tokens.accessToken);
    const email = userInfo.email;
    const providerAccountId = userInfo.sub;

    await storeGoogleTokens(session.userId, tokens, email, providerAccountId);
    await recordConsent(session.userId, "google_connection", true);
    await recordAuditLog({
      userId: session.userId,
      workspaceId: session.workspaceId,
      eventType: "google_connected",
      subjectType: "oauth_connection",
      subjectId: "google"
    });

    const response = NextResponse.redirect(new URL("/workspace/documents", request.url));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);

    return response;
  } catch {
    return redirectWithError("token_exchange_failed");
  }
}
