import { NextResponse } from "next/server";
import { isGoogleConnected, getConnectedEmail, clearStoredConnection } from "@/lib/server/google/token-store";
import { isGoogleOAuthConfigured } from "@/lib/server/google/oauth";
import { getSession } from "@/lib/server/db/dal";

/**
 * GET /api/google/connection
 *
 * Returns the authenticated user's Google connection state.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      state: "not_connected",
      accountEmail: null,
      configured: false
    });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({
      state: "not_connected",
      accountEmail: null,
      configured: false
    });
  }

  const connected = await isGoogleConnected(session.userId);
  const email = await getConnectedEmail(session.userId);

  return NextResponse.json({
    state: connected ? "connected" : "not_connected",
    accountEmail: email,
    configured: true
  });
}

/**
 * DELETE /api/google/connection
 *
 * Disconnects the Google account for the authenticated user.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  await clearStoredConnection(session.userId);

  return NextResponse.json({ state: "not_connected", accountEmail: null });
}
