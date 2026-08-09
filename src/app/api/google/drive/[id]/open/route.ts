import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/db/dal";
import { getValidAccessToken } from "@/lib/server/google/token-store";
import { getGoogleDriveOpenUrl } from "@/lib/server/google/drive-api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in", _request.url));

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) return NextResponse.redirect(new URL("/workspace/settings", _request.url));

  try {
    const { id } = await context.params;
    return NextResponse.redirect(await getGoogleDriveOpenUrl(accessToken, id));
  } catch {
    return NextResponse.redirect(new URL("/workspace/files", _request.url));
  }
}
