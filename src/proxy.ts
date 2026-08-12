import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "aksawork.web.id";
const AUTH_ENTRY_PATHS = new Set(["/sign-in", "/sign-up"]);

function createContentSecurityPolicy(nonce: string): string {
  const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self'${developmentScriptSource} 'wasm-unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

function continueWithContentSecurityPolicy(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

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

  const hasSessionCookie = request.cookies.getAll().some(({ name, value }) =>
    value.length > 0 && (
      name === "better-auth.session_token" ||
      name === "better-auth-session_token" ||
      name === "__Secure-better-auth.session_token"
    )
  );

  if (AUTH_ENTRY_PATHS.has(request.nextUrl.pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  const requiresSession =
    request.nextUrl.pathname === "/onboarding" || request.nextUrl.pathname.startsWith("/workspace");

  if (requiresSession && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return continueWithContentSecurityPolicy(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon0.svg|icon1.png|manifest.json).*)"]
};
