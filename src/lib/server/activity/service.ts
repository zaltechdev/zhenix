import { assertServerOnly } from "@/lib/server/server-guard";
import { readSessionState } from "@/lib/server/auth/service";
import { createAksaError } from "@/lib/server/errors/aksa-error";
import { blockedResource, type ResourceState } from "@/lib/contracts/resource-state";
import type { ActivityFeed } from "@/lib/contracts/activity";
import { readPersistedActivity } from "@/lib/server/google/docs-workflow";

assertServerOnly("src/lib/server/activity/service.ts");

/**
 * Activity boundary.
 *
 * An activity event exists only after a real execution was recorded, so an empty
 * feed is the only honest result while execution is unavailable.
 */
export async function readWorkspaceActivity(): Promise<ResourceState<ActivityFeed>> {
  const session = await readSessionState();

  if (session.status === "unavailable") {
    return blockedResource<ActivityFeed>(session.error);
  }

  if (session.status === "expired") {
    return blockedResource<ActivityFeed>(createAksaError("session_expired"));
  }

  if (session.status !== "authenticated") {
    return blockedResource<ActivityFeed>(createAksaError("authentication_required"));
  }

  return readPersistedActivity(session.session.userId, session.session.workspaceId);
}
