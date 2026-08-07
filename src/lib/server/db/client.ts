import { assertServerOnly } from "@/lib/server/server-guard";
import { databaseStatus } from "@/lib/server/config/runtime-config";
import { notConfiguredError } from "@/lib/server/errors/aksa-error";
import type { AksaError } from "@/lib/contracts/errors";

assertServerOnly("src/lib/server/db/client.ts");

/**
 * Lazy database access.
 *
 * The libSQL client is created on first successful use, never at module import
 * time, so a deployment without database configuration still builds and renders.
 * Schema and queries remain Zaltech's to write against `.agents/db_schema.md`.
 */

type DatabaseHandle = {
  url: string;
  authToken: string;
};

export type DatabaseAccess =
  | { status: "ready"; handle: DatabaseHandle }
  | { status: "not_configured"; error: AksaError; missingKeys: string[] };

let cached: DatabaseAccess | null = null;

export function databaseAccess(): DatabaseAccess {
  if (cached !== null) {
    return cached;
  }

  const status = databaseStatus();
  if (!status.configured) {
    cached = {
      status: "not_configured",
      error: notConfiguredError(),
      missingKeys: status.missingKeys
    };
    return cached;
  }

  cached = {
    status: "ready",
    handle: {
      url: process.env.TURSO_DATABASE_URL as string,
      authToken: process.env.TURSO_AUTH_TOKEN as string
    }
  };

  return cached;
}

export function isDatabaseReady(): boolean {
  return databaseAccess().status === "ready";
}

/** Test and request-scope helper so a configuration change is picked up. */
export function resetDatabaseAccessCache(): void {
  cached = null;
}
