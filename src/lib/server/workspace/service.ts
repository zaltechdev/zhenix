import { assertServerOnly } from "@/lib/server/server-guard";
import { readCapabilitySnapshot } from "@/lib/server/capabilities/service";
import { readGoogleConnection } from "@/lib/server/google/service";
import { readSessionState, readAccessibilityProfile } from "@/lib/server/auth/service";
import { readActiveTask } from "@/lib/server/tasks/service";
import { contentLimits } from "@/lib/server/config/runtime-config";
import type { CapabilitySnapshot } from "@/lib/contracts/capability";
import type { GoogleConnection } from "@/lib/contracts/google";
import type { SessionState, AccessibilityProfile } from "@/lib/contracts/auth";
import type { ResourceState } from "@/lib/contracts/resource-state";
import type { Task } from "@/lib/contracts/task";

assertServerOnly("src/lib/server/workspace/service.ts");

/**
 * One shaped read for the workspace shell.
 *
 * Server Components call this directly rather than fetching Aksa's own Route
 * Handlers, so the shell costs no internal HTTP round trip.
 */
export type WorkspaceContext = {
  session: SessionState;
  capabilities: CapabilitySnapshot;
  connection: GoogleConnection;
  activeTask: ResourceState<Task>;
  limits: ReturnType<typeof contentLimits>;
  accessibilityProfile: AccessibilityProfile | null;
};

export async function readWorkspaceContext(): Promise<WorkspaceContext> {
  const [session, capabilities, connection, activeTask, accessibilityProfile] = await Promise.all([
    readSessionState(),
    readCapabilitySnapshot(),
    readGoogleConnection(),
    readActiveTask(),
    readAccessibilityProfile()
  ]);

  return {
    session,
    capabilities,
    connection,
    activeTask,
    limits: contentLimits(),
    accessibilityProfile
  };
}
