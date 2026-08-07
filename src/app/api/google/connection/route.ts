import { NextResponse } from "next/server";
import { isGoogleConnected, getConnectedEmail, clearStoredConnection } from "@/lib/server/google/token-store";
import { isGoogleOAuthConfigured, revokeToken } from "@/lib/server/google/oauth";
import { getStoredConnection } from "@/lib/server/google/token-store";

/**
 * GET /api/google/connection
 *
 * Returns the current Google connection state.
 */
export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({
      state: "not_connected",
      accountEmail: null,
      configured: false
    });
  }

  const connected = isGoogleConnected();
  const email = getConnectedEmail();

  return NextResponse.json({
    state: connected ? "connected" : "not_connected",
    accountEmail: email,
    configured: true
  });
}

/**
 * DELETE /api/google/connection
 *
 * Disconnects the Google account. Revokes the token with Google and
 * clears stored credentials.
 */
export async function DELETE() {
  const connection = getStoredConnection();

  if (connection) {
    /** Best-effort revocation with Google per security spec. */
    await revokeToken(connection.accessToken);
    clearStoredConnection();
  }

  return NextResponse.json({ state: "not_connected", accountEmail: null });
}
