import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/server/db/client";
import * as schema from "@/lib/server/db/schema";

const configuredSecret = process.env.AUTH_SECRET?.trim();
if (!configuredSecret && process.env.NODE_ENV !== "test") {
  throw new Error("auth_unavailable");
}

function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^replace-with/i.test(trimmed) || /^your-/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

const googleClientId = configuredValue(process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = configuredValue(process.env.GOOGLE_CLIENT_SECRET);
const googleProvider = googleClientId && googleClientSecret
  ? {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        prompt: "select_account" as const
      }
    }
  : {};

export const auth = betterAuth({
  appName: "Aksa",
  baseURL: configuredValue(process.env.BETTER_AUTH_URL),
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
  socialProviders: googleProvider,
  account: {
    encryptOAuthTokens: true
  },
  secret: configuredSecret || "aksa-test-only-secret-key-32bytes",
  plugins: [nextCookies()]
});
