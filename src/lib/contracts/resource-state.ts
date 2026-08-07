import { z } from "zod";
import { aksaErrorSchema, type AksaError } from "@/lib/contracts/errors";

/**
 * Why a surface has nothing to show. Distinguishing these keeps the interface
 * from collapsing "nothing matched" and "nothing exists yet" into one message.
 */
export const emptyReasons = [
  "no_items",
  "no_results",
  "no_reliable_source",
  "no_recent_messages",
  "no_tasks",
  "no_activity",
  "nothing_selected"
] as const;

export const emptyReasonSchema = z.enum(emptyReasons);
export type EmptyReason = z.infer<typeof emptyReasonSchema>;

/**
 * The single envelope every Aksa work surface consumes.
 *
 * `blocked` carries the reason in `error.category`, so disconnected, missing
 * scope, unconfigured, unsupported, rate limited, and failed all resolve to one
 * presentation path without the surface inventing its own state machine.
 */
export type ResourceState<TData> =
  | { status: "loading" }
  | { status: "ready"; data: TData }
  | { status: "empty"; reason: EmptyReason }
  | { status: "partial"; data: TData; error: AksaError }
  | { status: "blocked"; error: AksaError };

export function resourceStateSchema<TSchema extends z.ZodTypeAny>(data: TSchema) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("loading") }),
    z.object({ status: z.literal("ready"), data }),
    z.object({ status: z.literal("empty"), reason: emptyReasonSchema }),
    z.object({ status: z.literal("partial"), data, error: aksaErrorSchema }),
    z.object({ status: z.literal("blocked"), error: aksaErrorSchema })
  ]);
}

export function readyResource<TData>(data: TData): ResourceState<TData> {
  return { status: "ready", data };
}

export function emptyResource<TData>(reason: EmptyReason): ResourceState<TData> {
  return { status: "empty", reason };
}

export function blockedResource<TData>(error: AksaError): ResourceState<TData> {
  return { status: "blocked", error };
}

export function resourceData<TData>(state: ResourceState<TData>): TData | null {
  if (state.status === "ready" || state.status === "partial") {
    return state.data;
  }
  return null;
}

export function resourceError<TData>(state: ResourceState<TData>): AksaError | null {
  if (state.status === "partial" || state.status === "blocked") {
    return state.error;
  }
  return null;
}
