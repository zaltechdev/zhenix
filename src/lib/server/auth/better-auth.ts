import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/server/db/client";
import * as schema from "@/lib/server/db/schema";

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
  secret: process.env.AUTH_SECRET || "aksa-fallback-high-entropy-development-secret-key-32bytes"
});
