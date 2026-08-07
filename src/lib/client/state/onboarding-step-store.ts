"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Onboarding progress, stored per browser tab.
 *
 * A tiny external store rather than state written from an effect. Session storage is
 * the source of truth, so leaving and returning in the same tab resumes at the last
 * step, and the copy shown to the user stays accurate.
 */
const STEP_STORAGE_KEY = "aksa-onboarding-step";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function readStep(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.sessionStorage.getItem(STEP_STORAGE_KEY);
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function clearOnboardingStep(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(STEP_STORAGE_KEY);
  notify();
}

export function useOnboardingStep(stepCount: number): [number, (next: number) => void] {
  const stored = useSyncExternalStore(subscribe, readStep, () => 0);
  const index = Math.min(Math.max(stored, 0), stepCount - 1);

  const setIndex = useCallback((next: number) => {
    const bounded = Math.min(Math.max(next, 0), stepCount - 1);
    window.sessionStorage.setItem(STEP_STORAGE_KEY, String(bounded));
    notify();
  }, [stepCount]);

  return [index, setIndex];
}
