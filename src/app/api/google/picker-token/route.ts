import { NextResponse } from "next/server";

/**
 * Retained as an explicit dead-end for older clients. The Docs MVP uses a
 * server-backed Drive list and never exposes a Google access token to a browser.
 */
export async function GET() {
  /** The MVP uses a server-side Drive list so no Google access token reaches the browser. */
  return NextResponse.json({ error: "Drive picker is not used by the Docs MVP" }, { status: 410 });
}
