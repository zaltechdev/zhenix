import { NextResponse } from "next/server";
import {
  clearStoredConnection,
  getConnectedEmail,
  getGoogleConnectionState,
  getValidAccessToken
} from "@/lib/server/google/token-store";
import { isGoogleOAuthConfigured } from "@/lib/server/google/oauth";
import { getSession, recordAuditLog } from "@/lib/server/db/dal";

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

  const initialState = await getGoogleConnectionState(session.userId);
  const connected = initialState === "connected";
  const accessToken = connected ? await getValidAccessToken(session.userId) : null;
  if (connected && !accessToken) {
    /** Verify the stored refresh credential before claiming a usable connection. */
    const currentState = await getGoogleConnectionState(session.userId);
    if (currentState === "connected") {
      return NextResponse.json({
        state: "error",
        accountEmail: await getConnectedEmail(session.userId),
        configured: true
      });
    }
  }
  const state = await getGoogleConnectionState(session.userId);
  const email = await getConnectedEmail(session.userId);

  return NextResponse.json({
    state,
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
  await recordAuditLog({
    userId: session.userId,
    workspaceId: session.workspaceId,
    eventType: "google_disconnected",
    subjectType: "oauth_connection",
    subjectId: "google"
  });

  return NextResponse.json({ state: "not_connected", accountEmail: null });
}
