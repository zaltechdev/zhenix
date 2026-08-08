import { assertServerOnly } from "@/lib/server/server-guard";
import { agentRunner } from "@/lib/server/ai/agent-runner";
import { readSessionState } from "@/lib/server/auth/service";
import { createAksaError } from "@/lib/server/errors/aksa-error";
import { blockedResource, emptyResource, type ResourceState } from "@/lib/contracts/resource-state";
import type { CommandResult, CommandSubmission } from "@/lib/contracts/command";
import type { CancellationResult, Task, TaskList } from "@/lib/contracts/task";
import {
  isIllustrativeConfirmationId,
  type ConfirmationOutcome,
  type ConfirmationResponse
} from "@/lib/contracts/confirmation";
import type { UndoOutcome } from "@/lib/contracts/undo";
import { readPersistedTaskHistory, respondToDocumentConfirmation } from "@/lib/server/google/docs-workflow";

assertServerOnly("src/lib/server/tasks/service.ts");

/**
 * Task boundary consumed by Server Components and the command Route Handler.
 *
 * Every read is scoped by the session. There is no session to scope by yet, so
 * reads report `authentication_required` instead of returning a global collection.
 */

async function requireSessionOrBlock<TData>(): Promise<ResourceState<TData> | null> {
  const session = await readSessionState();
  if (session.status === "authenticated") {
    return null;
  }

  if (session.status === "expired") {
    return blockedResource<TData>(createAksaError("session_expired"));
  }

  if (session.status === "unavailable") {
    return blockedResource<TData>(session.error);
  }

  return blockedResource<TData>(createAksaError("authentication_required"));
}

export async function submitCommand(submission: CommandSubmission): Promise<CommandResult> {
  return agentRunner().submitCommand(submission);
}

export async function readActiveTask(): Promise<ResourceState<Task>> {
  const blocked = await requireSessionOrBlock<Task>();
  if (blocked !== null) {
    return blocked;
  }
  return emptyResource<Task>("no_tasks");
}

export async function readTaskHistory(): Promise<ResourceState<TaskList>> {
  const blocked = await requireSessionOrBlock<TaskList>();
  if (blocked !== null) {
    return blocked;
  }
  const session = await readSessionState();
  if (session.status !== "authenticated") {
    return emptyResource<TaskList>("no_tasks");
  }
  return readPersistedTaskHistory(session.session.userId, session.session.workspaceId);
}

export async function cancelTask(taskId: string): Promise<CancellationResult> {
  const session = await readSessionState();
  if (session.status !== "authenticated") {
    return { outcome: "unable_to_cancel", error: createAksaError("authentication_required") };
  }
  return agentRunner().cancelTask(taskId);
}

export async function respondToConfirmation(
  response: ConfirmationResponse
): Promise<ConfirmationOutcome> {
  /**
   * A labelled interface preview can never be executed, whatever the session says.
   * Checked before authentication so the rule holds unconditionally.
   */
  if (isIllustrativeConfirmationId(response.confirmationId)) {
    return { outcome: "unavailable", error: createAksaError("not_found") };
  }

  const session = await readSessionState();
  if (session.status !== "authenticated") {
    return { outcome: "unavailable", error: createAksaError("authentication_required") };
  }

  const result = await respondToDocumentConfirmation(
    { userId: session.session.userId, workspaceId: session.session.workspaceId },
    response.confirmationId,
    response.decision
  );
  switch (result.outcome) {
    case "completed":
      return { outcome: "executed", task: result.task };
    case "cancelled":
      return { outcome: "cancelled", task: result.task };
    case "edit_requested":
      return { outcome: "edit_requested", confirmation: result.confirmation };
    case "expired":
      return { outcome: "expired", error: result.error };
    case "already_consumed":
      return { outcome: "already_consumed", error: result.error };
    case "failed":
      return { outcome: "unavailable", error: result.error };
  }
}

export async function requestUndo(undoId: string): Promise<UndoOutcome> {
  const session = await readSessionState();
  if (session.status !== "authenticated") {
    return { outcome: "failed", error: createAksaError("authentication_required") };
  }

  void undoId;
  return { outcome: "unsupported", error: createAksaError("undo_unavailable") };
}
