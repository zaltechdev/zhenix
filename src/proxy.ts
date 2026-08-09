import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
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
  matcher: ["/workspace/:path*"]
};
