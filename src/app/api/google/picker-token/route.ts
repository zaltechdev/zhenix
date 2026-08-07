import { NextResponse } from "next/server";
import { getValidAccessToken, isGoogleConnected } from "@/lib/server/google/token-store";
import { googleOAuthConfig } from "@/lib/server/google/oauth";
import { getSession } from "@/lib/server/db/dal";

/**
 * GET /api/google/picker-token
 *
 * Returns a short-lived access token and the API key for the Google Picker for the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const connected = await isGoogleConnected(session.userId);
  if (!connected) {
    return NextResponse.json(
      { error: "Google not connected" },
      { status: 401 }
    );
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Unable to get access token" },
      { status: 401 }
    );
  }

  const config = googleOAuthConfig();

  return NextResponse.json({
    accessToken,
    clientId: config.clientId,
    apiKey: process.env.GOOGLE_PICKER_API_KEY ?? "",
    appId: process.env.GOOGLE_CLOUD_PROJECT_NUMBER ?? ""
  });
}
