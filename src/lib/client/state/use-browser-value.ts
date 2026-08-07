"use client";

import { useSyncExternalStore } from "react";

/**
 * Read a browser-only value without writing state from an effect.
 *
 * Capability probes have no server answer, so the server snapshot is the safe default
 * and the client snapshot replaces it after hydration. Only use this for primitives,
 * because the snapshot is compared by identity on every render.
 */
const noopSubscribe = () => () => {};

export function useBrowserValue<TValue extends string | number | boolean | null>(
  read: () => TValue,
  serverValue: TValue
): TValue {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
