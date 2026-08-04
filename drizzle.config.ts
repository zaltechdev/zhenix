import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/server/db/schema.ts",
  out: "./src/lib/server/db/migrations",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "libsql://placeholder.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN ?? "placeholder"
  }
});
