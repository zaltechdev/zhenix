import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("production host canonicalization", () => {
  it("redirects the Vercel alias to the canonical host while preserving the path and query", () => {
    const response = proxy(new NextRequest("https://aksawork.vercel.app/workspace?from=bookmark"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://aksawork.web.id/workspace?from=bookmark");
  });

  it("leaves public canonical-host routes unchanged", () => {
    const response = proxy(new NextRequest("https://aksawork.web.id/sign-in"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the existing workspace session-cookie guard", () => {
    const response = proxy(new NextRequest("https://aksawork.web.id/workspace"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://aksawork.web.id/sign-in");
  });

  it("protects onboarding with the same session cookie", () => {
    const response = proxy(new NextRequest("https://aksawork.web.id/onboarding"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://aksawork.web.id/sign-in");
  });

  it("redirects authenticated users away from sign-in", () => {
    const response = proxy(
      new NextRequest("https://aksawork.web.id/sign-in", {
        headers: { cookie: "__Secure-better-auth.session_token=session-token" }
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://aksawork.web.id/workspace");
  });
});
