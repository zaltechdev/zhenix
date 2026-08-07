import type { AksaError } from "@/lib/contracts/errors";
import type { ResourceState } from "@/lib/contracts/resource-state";

export type SurfaceStateType =
  | "authentication_required"
  | "connection_required"
  | "scope_required"
  | "not_configured"
  | "loading"
  | "empty"
  | "ready"
  | "error";

export type ResolvedSurfaceState<TData> =
  | { type: "authentication_required" }
  | { type: "connection_required" }
  | { type: "scope_required"; scope?: string }
  | { type: "not_configured"; error: AksaError }
  | { type: "loading" }
  | { type: "empty"; reason?: string }
  | { type: "ready"; data: TData }
  | { type: "error"; error: AksaError };

export function isBlockedSurfaceType(type: SurfaceStateType): boolean {
  return (
    type === "authentication_required" ||
    type === "connection_required" ||
    type === "scope_required" ||
    type === "not_configured"
  );
}

/**
 * Single precedence resolver for all Google-backed workspace pages:
 * 1. authentication_required
 * 2. connection_required
 * 3. scope_required
 * 4. not_configured
 * 5. loading
 * 6. empty
 * 7. ready
 * 8. error
 */
export function resolveSurfaceState<TData>(params: {
  isAuthenticated: boolean;
  isGoogleConnected: boolean;
  resourceState: ResourceState<TData>;
}): ResolvedSurfaceState<TData> {
  const { isAuthenticated, isGoogleConnected, resourceState } = params;

  if (!isAuthenticated) {
    return { type: "authentication_required" };
  }

  if (!isGoogleConnected) {
    return { type: "connection_required" };
  }

  if (resourceState.status === "loading") {
    return { type: "loading" };
  }

  if (resourceState.status === "blocked") {
    const category = resourceState.error.category;
    if (category === "authentication_required") {
      return { type: "authentication_required" };
    }
    if (category === "connection_required") {
      return { type: "connection_required" };
    }
    if (category === "scope_required") {
      return { type: "scope_required" };
    }
    if (category === "not_configured") {
      return { type: "not_configured", error: resourceState.error };
    }
    return { type: "error", error: resourceState.error };
  }

  if (resourceState.status === "empty") {
    return { type: "empty", reason: resourceState.reason };
  }

  if (resourceState.status === "ready" || resourceState.status === "partial") {
    return { type: "ready", data: resourceState.data };
  }

  return { type: "loading" };
}
