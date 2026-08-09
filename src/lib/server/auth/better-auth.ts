import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { oneTap } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { GOOGLE_SIGN_IN_CLIENT_ID } from "@/lib/config/public-google";
import { db } from "@/lib/server/db/client";
import * as schema from "@/lib/server/db/schema";

declare global {
  var aksaDevelopmentAuthSecret: string | undefined;
}

const configuredSecret = process.env.AUTH_SECRET?.trim();
const developmentSecret = process.env.NODE_ENV === "development"
  ? (globalThis.aksaDevelopmentAuthSecret ??= randomBytes(32).toString("base64url"))
  : undefined;
const authSecret = configuredSecret || developmentSecret;

if (!authSecret && process.env.NODE_ENV !== "test") {
  throw new Error("auth_unavailable");
}

function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^replace-with/i.test(trimmed) || /^your-/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

const googleClientId = configuredValue(process.env.GOOGLE_CLIENT_ID) ?? GOOGLE_SIGN_IN_CLIENT_ID;
const vercelHost = configuredValue(process.env.VERCEL_URL);
const baseURL =
  configuredValue(process.env.BETTER_AUTH_URL) ??
  configuredValue(process.env.NEXT_PUBLIC_APP_URL) ??
  (vercelHost ? `https://${vercelHost}` : undefined) ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://aksawork.web.id");

export const auth = betterAuth({
  appName: "Aksa",
  baseURL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    }
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  account: {
    encryptOAuthTokens: true
  },
  secret: authSecret || "aksa-test-only-secret-key-32bytes",
  plugins: [
    ...(googleClientId ? [oneTap({ clientId: googleClientId })] : []),
    nextCookies()
  ]
});
