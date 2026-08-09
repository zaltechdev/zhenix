import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/server/db/client";
import * as schema from "@/lib/server/db/schema";

const configuredSecret = process.env.AUTH_SECRET?.trim();
if (!configuredSecret && process.env.NODE_ENV !== "test") {
  throw new Error("auth_unavailable");
}

export const auth = betterAuth({
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
  secret: configuredSecret || "aksa-test-only-secret-key-32bytes",
  plugins: [nextCookies()]
});
