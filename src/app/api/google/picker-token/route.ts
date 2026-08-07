import { NextResponse } from "next/server";
import { getValidAccessToken, isGoogleConnected } from "@/lib/server/google/token-store";
import { googleOAuthConfig } from "@/lib/server/google/oauth";

/**
 * GET /api/google/picker-token
 *
 * Returns a short-lived access token and the API key for the Google Picker.
 *
 * Security notes:
 * - This token is needed by the Picker client-side component.
 * - The Picker API requires setOAuthToken() and setDeveloperKey().
 * - Token is short-lived and scoped to drive.file.
 * - The client uses it only for the Picker, then discards it.
 * - Per the prompt: "The standard Picker pattern."
 */
export async function GET() {
  if (!isGoogleConnected()) {
    return NextResponse.json(
      { error: "Google not connected" },
      { status: 401 }
    );
  }

  const accessToken = await getValidAccessToken();
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
