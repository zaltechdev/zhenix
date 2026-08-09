import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "bun run dev",
    env: {
      AUTH_SECRET: "aksa-e2e-auth-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
      TURSO_AUTH_TOKEN: "aksa-e2e-local",
      TURSO_DATABASE_URL: "file:aksa-e2e.db"
    },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
