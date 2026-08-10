import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "aksawork.web.id";

function shouldUseCanonicalHost(hostname: string): boolean {
  return hostname === "aksawork.vercel.app" || hostname.endsWith(".vercel.app");
}

export function proxy(request: NextRequest) {
  if (shouldUseCanonicalHost(request.nextUrl.hostname)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.protocol = "https:";
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (!request.nextUrl.pathname.startsWith("/workspace")) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.getAll().some(({ name, value }) =>
    value.length > 0 && (
      name === "better-auth.session_token" ||
      name === "better-auth-session_token" ||
      name === "__Secure-better-auth.session_token"
    )
  );

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon0.svg|icon1.png|manifest.json).*)"]
};
