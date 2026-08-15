import { z } from "zod";
import { assertServerOnly } from "@/lib/server/server-guard";
import {
  executionConfig,
  fallbackProviderStatus,
  googleAiStudioStatus,
  primaryProviderStatus,
  type ConfigurationStatus
} from "@/lib/server/config/runtime-config";
import type { AksaError } from "@/lib/contracts/errors";
import { createAksaError } from "@/lib/server/errors/aksa-error";

assertServerOnly("src/lib/server/ai/provider-registry.ts");

/**
 * Provider routing boundary.
 *
 * Model identifiers, base URLs, and limits are configuration, never literals in
 * feature code. No provider client is constructed at module import time, and no
 * provider call ever originates from a Client Component.
 */

export const providerRoles = ["orchestrate", "summarize", "classify", "search_grounded"] as const;
export const providerRoleSchema = z.enum(providerRoles);
export type ProviderRole = z.infer<typeof providerRoleSchema>;

export const providerIds = ["google_ai_studio", "vertex_ai", "dahl_inference"] as const;
export const providerIdSchema = z.enum(providerIds);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const retryConfigSchema = z.object({
  maxAttempts: z.number().int().positive(),
  baseDelayMs: z.number().int().positive(),
  maxDelayMs: z.number().int().positive(),
  jitterRatio: z.number().min(0).max(1),
  /** Honour `Retry-After` when the provider sends it. */
  honorRetryAfter: z.literal(true)
});

export type RetryConfig = z.infer<typeof retryConfigSchema>;

export const timeoutConfigSchema = z.object({
  perCallMs: z.number().int().positive(),
  perTaskMs: z.number().int().positive()
});

export type TimeoutConfig = z.infer<typeof timeoutConfigSchema>;

export type ProviderResolution =
  | {
      status: "ready";
      providerId: ProviderId;
      role: ProviderRole;
      retry: RetryConfig;
      timeouts: TimeoutConfig;
    }
  | { status: "not_configured"; error: AksaError; missingKeys: string[] };

export type ProviderRegistry = {
  resolve(role: ProviderRole): ProviderResolution;
  primaryStatus(): ConfigurationStatus;
  fallbackStatus(): ConfigurationStatus;
  retryConfig(): RetryConfig;
  timeoutConfig(): TimeoutConfig;
};

function readRetryConfig(): RetryConfig {
  /**
   * Vertex AI Gemini capacity is governed by dynamic shared quota, so `429` is a
   * runtime condition to back off from rather than a fixed rate to predict. No
   * request-per-minute value is hardcoded anywhere.
   */
  return retryConfigSchema.parse({
    maxAttempts: 4,
    baseDelayMs: 500,
    maxDelayMs: 8_000,
    jitterRatio: 0.3,
    honorRetryAfter: true
  });
}

function readTimeoutConfig(): TimeoutConfig {
  const config = executionConfig();
  return timeoutConfigSchema.parse({
    perCallMs: config.providerTimeoutMs,
    perTaskMs: config.taskTimeoutMs
  });
}

export function providerRegistry(): ProviderRegistry {
  return {
    resolve(role) {
      const googleAi = googleAiStudioStatus();
      if (googleAi.configured) {
        return {
          status: "ready",
          providerId: "google_ai_studio",
          role,
          retry: readRetryConfig(),
          timeouts: readTimeoutConfig()
        };
      }

      const fallback = fallbackProviderStatus();
      if (fallback.configured && role !== "search_grounded") {
        return {
          status: "ready",
          providerId: "dahl_inference",
          role,
          retry: readRetryConfig(),
          timeouts: readTimeoutConfig()
        };
      }

      return {
        status: "not_configured",
        error: createAksaError("not_configured"),
        missingKeys: googleAi.missingKeys
      };
    },

    primaryStatus: primaryProviderStatus,
    fallbackStatus: fallbackProviderStatus,
    retryConfig: readRetryConfig,
    timeoutConfig: readTimeoutConfig
  };
}
