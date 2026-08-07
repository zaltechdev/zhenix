import { assertServerOnly } from "@/lib/server/server-guard";
import {
  authStatus,
  databaseStatus,
  googleStatus,
  groundedSearchStatus,
  primaryProviderStatus
} from "@/lib/server/config/runtime-config";
import { readGoogleConnection } from "@/lib/server/google/service";
import { readSessionState } from "@/lib/server/auth/service";
import {
  capabilitySnapshotSchema,
  type Capability,
  type CapabilityName,
  type CapabilitySnapshot
} from "@/lib/contracts/capability";
import type { ErrorCategory, NextAction } from "@/lib/contracts/errors";

assertServerOnly("src/lib/server/capabilities/service.ts");

/**
 * Server-determined capability snapshot.
 *
 * Browser capabilities such as voice input, camera access, and head pointing are
 * detected in the client, because the server cannot know them. They share the same
 * `CapabilityName` vocabulary so the interface presents one consistent list.
 */

const googleCapabilities: readonly CapabilityName[] = [
  "drive_read",
  "drive_write",
  "docs_read",
  "docs_write",
  "sheets_read",
  "sheets_write",
  "gmail_read",
  "gmail_compose",
  "drive_picker"
];

const writeCapabilities = new Set<CapabilityName>([
  "drive_write",
  "docs_write",
  "sheets_write",
  "gmail_compose"
]);

function capability(
  name: CapabilityName,
  reasonCategory: ErrorCategory | null,
  options: { requiresConnection: boolean; requiresScope: boolean }
): Capability {
  if (reasonCategory === null) {
    return {
      name,
      availability: "available",
      requiresConnection: options.requiresConnection,
      requiresScope: options.requiresScope,
      reasonCategory: null,
      nextAction: "none"
    };
  }

  const availabilityByCategory: Partial<Record<ErrorCategory, Capability["availability"]>> = {
    not_configured: "not_configured",
    connection_required: "connection_required",
    scope_required: "scope_required",
    authentication_required: "unavailable",
    unsupported: "unsupported",
    unavailable: "unavailable"
  };

  const nextActionByCategory: Partial<Record<ErrorCategory, NextAction>> = {
    not_configured: "configure_deployment",
    connection_required: "connect_google",
    scope_required: "grant_capability",
    authentication_required: "sign_in",
    unsupported: "use_keyboard",
    unavailable: "retry"
  };

  return {
    name,
    availability: availabilityByCategory[reasonCategory] ?? "unavailable",
    requiresConnection: options.requiresConnection,
    requiresScope: options.requiresScope,
    reasonCategory,
    nextAction: nextActionByCategory[reasonCategory] ?? "retry"
  };
}

export async function readCapabilitySnapshot(): Promise<CapabilitySnapshot> {
  const [session, connection] = await Promise.all([readSessionState(), readGoogleConnection()]);
  const authenticated = session.status === "authenticated";

  const accountReason: ErrorCategory | null = authStatus().configured ? null : "not_configured";
  const settingsReason: ErrorCategory | null = databaseStatus().configured
    ? authenticated
      ? null
      : "authentication_required"
    : "not_configured";
  const agentReason: ErrorCategory | null = primaryProviderStatus().configured ? null : "not_configured";
  const searchReason: ErrorCategory | null = groundedSearchStatus().configured ? null : "not_configured";

  function googleReason(name: CapabilityName): ErrorCategory | null {
    if (!googleStatus().configured) {
      return "not_configured";
    }
    if (!authenticated) {
      return "authentication_required";
    }
    if (connection.state !== "connected") {
      return "connection_required";
    }
    if (!connection.grantedCapabilities.includes(name)) {
      return "scope_required";
    }
    return null;
  }

  const capabilities: Capability[] = [
    capability("account_session", accountReason, { requiresConnection: false, requiresScope: false }),
    capability("settings_persistence", settingsReason, { requiresConnection: false, requiresScope: false }),
    capability("agent_execution", agentReason, { requiresConnection: false, requiresScope: false }),
    capability("grounded_search", searchReason, { requiresConnection: false, requiresScope: false }),
    ...googleCapabilities.map((name) =>
      capability(name, googleReason(name), {
        requiresConnection: true,
        requiresScope: writeCapabilities.has(name)
      })
    )
  ];

  return capabilitySnapshotSchema.parse({ capabilities, checkedAt: Date.now() });
}
