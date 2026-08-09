import { z } from "zod";
import { assertServerOnly } from "@/lib/server/server-guard";

assertServerOnly("src/lib/server/config/runtime-config.ts");

/**
 * Lazy deployment configuration.
 *
 * Nothing is read at module import time and no client is constructed here, so a
 * missing variable cannot break a production build or a static render. Every
 * value is server-only. See `.agents/rules.md` section 6.
 */

/**
 * Placeholder shapes used in `.env.example`. Treating them as unconfigured stops
 * a copied example file from being mistaken for real configuration.
 */
const placeholderPatterns = [/^replace-with/i, /^your-/i, /example\.invalid/i];

function readSecret(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  if (value === "") {
    return null;
  }

  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    return null;
  }

  return value;
}

function readInteger(key: string, fallback: number): number {
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type ConfigurationStatus = {
  configured: boolean;
  /** Variable names only. Never a value. */
  missingKeys: string[];
};

function statusFor(keys: string[]): ConfigurationStatus {
  const missingKeys = keys.filter((key) => readSecret(key) === null);
  return { configured: missingKeys.length === 0, missingKeys };
}

export function databaseStatus(): ConfigurationStatus {
  return statusFor(["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
}

export function authStatus(): ConfigurationStatus {
  return statusFor(["AUTH_SECRET"]);
}

export function googleStatus(): ConfigurationStatus {
  return statusFor([
    "AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "OAUTH_TOKEN_ENCRYPTION_KEY"
  ]);
}

export function googleApiConfig() {
  return {
    timeoutMs: readInteger("GOOGLE_API_TIMEOUT_MS", 10_000),
    maxRetries: readInteger("GOOGLE_API_MAX_RETRIES", 2),
    retryBaseDelayMs: readInteger("GOOGLE_API_RETRY_BASE_MS", 250),
    retryJitterMs: readInteger("GOOGLE_API_RETRY_JITTER_MS", 100),
    maxRetryDelayMs: readInteger("GOOGLE_API_MAX_RETRY_DELAY_MS", 5_000)
  };
}

export function googleAiStudioStatus(): ConfigurationStatus {
  return statusFor(["GOOGLE_AI_API_KEY", "GOOGLE_AI_MODEL"]);
}

export const ONBOARDING_GEMINI_MODEL = "gemini-3.1-flash-lite";

export function googleAiStudioClassifierConfig(): { apiKey: string; model: string } | null {
  const apiKey = readSecret("GOOGLE_AI_API_KEY");
  if (apiKey === null) return null;

  return {
    apiKey,
    model: readSecret("GOOGLE_AI_MODEL") ?? ONBOARDING_GEMINI_MODEL
  };
}

export function primaryProviderStatus(): ConfigurationStatus {
  const vertex = vertexStatus();
  if (vertex.configured) return vertex;
  return googleAiStudioStatus();
}

export function vertexStatus(): ConfigurationStatus {
  return statusFor(["VERTEX_AI_PROJECT_ID", "VERTEX_AI_LOCATION", "VERTEX_AI_MODEL"]);
}

export function vertexConfig(): { project: string; location: string; model: string } | null {
  const project = readSecret("VERTEX_AI_PROJECT_ID");
  const location = readSecret("VERTEX_AI_LOCATION");
  const model = readSecret("VERTEX_AI_MODEL");
  return project && location && model ? { project, location, model } : null;
}

export function fallbackProviderStatus(): ConfigurationStatus {
  return statusFor([
    "DAHL_INFERENCE_BASE_URL",
    "DAHL_INFERENCE_API_KEY",
    "DAHL_INFERENCE_MODEL"
  ]);
}

/**
 * Grounded search rides on the primary provider's grounding feature, so it cannot
 * be configured independently of it.
 */
export function groundedSearchStatus(): ConfigurationStatus {
  return primaryProviderStatus();
}

export const executionConfigSchema = z.object({
  maxIterations: z.number().int().positive(),
  taskTimeoutMs: z.number().int().positive(),
  providerTimeoutMs: z.number().int().positive(),
  dailyCostCeilingMicros: z.number().int().positive(),
  undoWindowMs: z.number().int().positive(),
  taskRetentionDays: z.number().int().positive(),
  auditRetentionDays: z.number().int().positive()
});

export type ExecutionConfig = z.infer<typeof executionConfigSchema>;

/**
 * Limits are deployment configuration with documented defaults, never literals in
 * feature code. See `.agents/rules.md` section 10.
 */
export function executionConfig(): ExecutionConfig {
  return executionConfigSchema.parse({
    maxIterations: readInteger("AI_MAX_ITERATIONS", 8),
    taskTimeoutMs: readInteger("AI_TASK_TIMEOUT_MS", 30_000),
    providerTimeoutMs: readInteger("AI_PROVIDER_TIMEOUT_MS", 10_000),
    dailyCostCeilingMicros: readInteger("AI_DAILY_COST_CEILING_MICROS", 1_000_000),
    undoWindowMs: readInteger("UNDO_WINDOW_MS", 86_400_000),
    taskRetentionDays: readInteger("TASK_RETENTION_DAYS", 90),
    auditRetentionDays: readInteger("AUDIT_RETENTION_DAYS", 365)
  });
}

/**
 * Content caps for the work surfaces. Values remain open questions VWQ-2 and
 * GWQ-6, so they are conservative and configurable rather than presented as final.
 */
export function contentLimits() {
  return {
    documentBlockLimit: readInteger("AKSA_DOCUMENT_BLOCK_LIMIT", 400),
    sheetRowLimit: readInteger("AKSA_SHEET_ROW_LIMIT", 200),
    sheetColumnLimit: readInteger("AKSA_SHEET_COLUMN_LIMIT", 26),
    drivePageSize: readInteger("AKSA_DRIVE_PAGE_SIZE", 25),
    mailPageSize: readInteger("AKSA_MAIL_PAGE_SIZE", 15),
    searchSourceLimit: readInteger("AKSA_SEARCH_SOURCE_LIMIT", 6)
  };
}
