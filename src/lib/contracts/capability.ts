import { z } from "zod";
import { errorCategorySchema, nextActionSchema } from "@/lib/contracts/errors";

/**
 * Every capability the interface can ask about by name.
 *
 * Google capabilities mirror `.agents/features/google-workspace.md`. Connection
 * begins read-only, so each write capability is a separate entry the interface
 * can name when a user asks for a write.
 */
export const capabilityNames = [
  "account_session",
  "settings_persistence",
  "agent_execution",
  "voice_input",
  "camera_input",
  "head_pointer",
  "grounded_search",
  "drive_read",
  "drive_write",
  "drive_picker",
  "docs_read",
  "docs_write",
  "sheets_read",
  "sheets_write",
  "gmail_read",
  "gmail_compose"
] as const;

export const capabilityNameSchema = z.enum(capabilityNames);
export type CapabilityName = z.infer<typeof capabilityNameSchema>;

export const capabilityAvailabilities = [
  "available",
  "connection_required",
  "scope_required",
  "not_configured",
  "unsupported",
  "unavailable"
] as const;

export const capabilityAvailabilitySchema = z.enum(capabilityAvailabilities);
export type CapabilityAvailability = z.infer<typeof capabilityAvailabilitySchema>;

export const capabilitySchema = z.object({
  name: capabilityNameSchema,
  availability: capabilityAvailabilitySchema,
  requiresConnection: z.boolean(),
  requiresScope: z.boolean(),
  /** Null when the capability is available. */
  reasonCategory: errorCategorySchema.nullable(),
  nextAction: nextActionSchema
});

export type Capability = z.infer<typeof capabilitySchema>;

export const capabilitySnapshotSchema = z.object({
  capabilities: z.array(capabilitySchema),
  checkedAt: z.number().int().nonnegative()
});

export type CapabilitySnapshot = z.infer<typeof capabilitySnapshotSchema>;

export function findCapability(
  snapshot: CapabilitySnapshot,
  name: CapabilityName
): Capability | null {
  return snapshot.capabilities.find((entry) => entry.name === name) ?? null;
}

export function isCapabilityAvailable(
  snapshot: CapabilitySnapshot,
  name: CapabilityName
): boolean {
  return findCapability(snapshot, name)?.availability === "available";
}

export function countAvailableCapabilities(snapshot: CapabilitySnapshot): number {
  return snapshot.capabilities.filter((entry) => entry.availability === "available").length;
}
