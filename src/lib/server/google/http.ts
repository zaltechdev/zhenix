import { assertServerOnly } from "@/lib/server/server-guard";
import { googleApiConfig } from "@/lib/server/config/runtime-config";

assertServerOnly("src/lib/server/google/http.ts");

/**
 * Google API boundary. Provider payloads stay server-side and are never copied
 * into errors, logs, or client responses.
 */
export class GoogleApiError extends Error {
  readonly status: number;
  readonly method: string;

  constructor(status: number, method: string) {
    super(`Google API ${method} failed`);
    this.status = status;
    this.method = method;
    this.name = "GoogleApiError";
  }

  get isTimeout() {
    return this.status === 0;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isPermissionDenied() {
    return this.status === 403;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isRevisionConflict() {
    return this.status === 400;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isServerError() {
    return this.status >= 500;
  }
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const config = googleApiConfig();
  const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, config.maxRetryDelayMs);
  }

  const exponential = config.retryBaseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * (config.retryJitterMs + 1));
  return Math.min(exponential + jitter, config.maxRetryDelayMs);
}

function shouldRetry(status: number, attempt: number): boolean {
  const config = googleApiConfig();
  return (status === 408 || status === 429 || status >= 500) && attempt < config.maxRetries;
}

/** Fetch JSON with a configured timeout and bounded retry for transient failures. */
export async function fetchGoogleJson<T>(
  url: string,
  init: RequestInit,
  method: string
): Promise<T> {
  const config = googleApiConfig();
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) {
        return (await response.json()) as T;
      }

      if (shouldRetry(response.status, attempt)) {
        const delay = retryDelayMs(response.headers.get("retry-after"), attempt);
        attempt += 1;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new GoogleApiError(response.status, method);
    } catch (error) {
      if (error instanceof GoogleApiError) {
        throw error;
      }

      if (attempt < config.maxRetries) {
        const delay = retryDelayMs(null, attempt);
        attempt += 1;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new GoogleApiError(0, method);
    } finally {
      clearTimeout(timeout);
    }
  }
}
