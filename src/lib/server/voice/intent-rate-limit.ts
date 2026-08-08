const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

type RateLimitEntry = { startedAt: number; count: number };

const entries = new Map<string, RateLimitEntry>();

export function checkAksaIntentRateLimit(
  key: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const current = entries.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    entries.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1_000)
      )
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearAksaIntentRateLimitForTests(): void {
  entries.clear();
}
