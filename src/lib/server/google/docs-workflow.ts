import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { assertServerOnly } from "@/lib/server/server-guard";
import { googleStatus } from "@/lib/server/config/runtime-config";
import { createAksaError, type AksaError } from "@/lib/contracts/errors";
import { blockedResource, emptyResource, readyResource, type ResourceState } from "@/lib/contracts/resource-state";
import type { Confirmation } from "@/lib/contracts/confirmation";
import { confirmationSchema } from "@/lib/contracts/confirmation";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import type { ActivityEvent, ActivityEventType, ActivityOutcome } from "@/lib/contracts/activity";
import { activityEventTypeSchema } from "@/lib/contracts/activity";
import type { AffectedItem, Task, TaskList } from "@/lib/contracts/task";
import { affectedItemSchema, intentCategorySchema, taskStateSchema } from "@/lib/contracts/task";
import type { DriveItem, DriveListing } from "@/lib/contracts/google";
import { adaptGoogleDocument } from "@/lib/server/google/docs-adapter";
import {
  batchUpdateDocument,
  getDocument,
  GoogleApiError,
  type GoogleDocsGetResponse
} from "@/lib/server/google/docs-api";
import { getGoogleDriveItem, listGoogleDocuments } from "@/lib/server/google/drive-api";
import {
  getGoogleConnectionState,
  getValidAccessToken,
  markGoogleNeedsReconnect
} from "@/lib/server/google/token-store";
import { db, ensureLocalSchema } from "@/lib/server/db/client";
import {
  activityEvents,
  artifacts,
  confirmations,
  taskSteps,
  tasks,
  toolCalls
} from "@/lib/server/db/schema";

assertServerOnly("src/lib/server/google/docs-workflow.ts");

const appendRequestSchema = z.object({
  documentId: z.string().trim().min(1).max(200),
  appendText: z.string().trim().min(1).max(4000),
  expectedRevisionId: z.string().trim().min(1).max(200)
});

export type AppendRequest = z.infer<typeof appendRequestSchema>;

const pendingEditSchema = z.object({
  documentId: z.string().min(1).max(200),
  expectedRevisionId: z.string().min(1).max(200),
  appendText: z.string().min(1).max(4000)
});

type WorkflowContext = {
  userId: string;
  workspaceId: string;
};

type ActivityItem = AffectedItem;

type ReadRecord = {
  taskId: string;
  stepId: string;
  toolCallId: string;
  startedAt: number;
};

type ProposalResult =
  | { outcome: "confirmation_required"; confirmation: Confirmation }
  | { outcome: "blocked"; error: AksaError };

export type DocsConfirmationResult =
  | { outcome: "completed"; document: AksaDocumentModel; task: Task }
  | { outcome: "cancelled"; task: Task }
  | { outcome: "edit_requested"; confirmation: Confirmation }
  | { outcome: "expired"; error: AksaError }
  | { outcome: "already_consumed"; error: AksaError }
  | { outcome: "failed"; error: AksaError; task: Task };

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function affectedDocument(documentId: string, title: string): ActivityItem {
  return { id: documentId, name: title, kind: "document" };
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function errorFromGoogle(error: unknown): AksaError {
  if (error instanceof GoogleApiError) {
    if (error.isUnauthorized) return createAksaError("connection_required");
    if (error.isNotFound) return createAksaError("not_found");
    if (error.isPermissionDenied) return createAksaError("permission_denied");
    if (error.isRateLimited) return createAksaError("rate_limited");
    if (error.isTimeout) return createAksaError("timeout");
    if (error.isRevisionConflict) return createAksaError("verification_failed");
  }
  return createAksaError("internal_error");
}

async function accessTokenOrError(userId: string): Promise<{ token: string } | { error: AksaError }> {
  if (!googleStatus().configured) {
    return { error: createAksaError("not_configured") };
  }

  const connectionState = await getGoogleConnectionState(userId);
  if (connectionState === "needs_reconnect" || connectionState === "revoked") {
    return { error: createAksaError("connection_required") };
  }
  if (connectionState !== "connected") {
    return { error: createAksaError("connection_required") };
  }

  const token = await getValidAccessToken(userId);
  if (!token) {
    const nextState = await getGoogleConnectionState(userId);
    return {
      error: createAksaError(nextState === "needs_reconnect" ? "connection_required" : "unavailable")
    };
  }
  return { token };
}

async function beginTask(
  context: WorkflowContext,
  commandText: string,
  intent: "read_document" | "edit_document",
  item: ActivityItem,
  toolName: string,
  toolKind: "read" | "write",
  requiresConfirmation: boolean
): Promise<{ taskId: string; stepId: string; toolCallId: string; startedAt: number }> {
  await ensureLocalSchema();
  const now = Date.now();
  const taskId = id("task");
  const stepId = id("step");
  const toolCallId = id("tool");

  await db.insert(tasks).values({
    id: taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    inputMode: "text",
    commandText,
    intent,
    state: requiresConfirmation ? "waiting_for_confirmation" : "executing",
    resultSummary: null,
    errorCategory: null,
    itemsTotal: 1,
    itemsCompleted: 0,
    idempotencyKey: id("docs"),
    startedAt: now,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });

  await db.insert(taskSteps).values({
    id: stepId,
    taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    sequence: 1,
    label: requiresConfirmation ? "documents_activity_review" : "documents_activity_read",
    state: requiresConfirmation ? "waiting_for_confirmation" : "executing",
    requiresConfirmation: requiresConfirmation ? 1 : 0,
    startedAt: now,
    endedAt: null,
    createdAt: now
  });

  await db.insert(toolCalls).values({
    id: toolCallId,
    taskId,
    taskStepId: stepId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    toolName,
    toolKind,
    argumentsSummary: JSON.stringify({ documentId: item.id }),
    outcome: requiresConfirmation ? "awaiting_confirmation" : "executing",
    errorCategory: null,
    affectedItemCount: 1,
    verified: 0,
    durationMs: null,
    confirmationId: null,
    createdAt: now
  });

  await insertActivity(context, taskId, "task_started", "documents_activity_read", [item], null);
  await insertActivity(
    context,
    taskId,
    "step_started",
    requiresConfirmation ? "documents_activity_review" : "documents_activity_read",
    [item],
    toolCallId
  );

  return { taskId, stepId, toolCallId, startedAt: now };
}

async function nextSequence(taskId: string): Promise<number> {
  const existing = await db.query.activityEvents.findMany({
    where: eq(activityEvents.taskId, taskId)
  });
  return existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;
}

async function insertActivity(
  context: WorkflowContext,
  taskId: string,
  eventType: ActivityEventType,
  label: string,
  items: ActivityItem[],
  toolCallId: string | null
): Promise<void> {
  await db.insert(activityEvents).values({
    id: id("event"),
    taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    sequence: await nextSequence(taskId),
    eventType,
    label,
    affectedItems: JSON.stringify(items),
    toolCallId,
    createdAt: Date.now()
  });
}

async function updateActivityItems(taskId: string, items: ActivityItem[]): Promise<void> {
  await db
    .update(activityEvents)
    .set({ affectedItems: JSON.stringify(items) })
    .where(eq(activityEvents.taskId, taskId));
}

async function finishRead(
  context: WorkflowContext,
  record: ReadRecord,
  item: ActivityItem,
  error: AksaError | null
): Promise<void> {
  const now = Date.now();
  const succeeded = error === null;
  await db
    .update(toolCalls)
    .set({
      outcome: succeeded ? "succeeded" : "failed",
      errorCategory: error?.category ?? null,
      verified: succeeded ? 1 : 0,
      durationMs: Math.max(0, now - record.startedAt)
    })
    .where(eq(toolCalls.id, record.toolCallId));
  await db
    .update(taskSteps)
    .set({ state: succeeded ? "completed" : "failed", endedAt: now })
    .where(eq(taskSteps.id, record.stepId));
  await db
    .update(tasks)
    .set({
      state: succeeded ? "completed" : "failed",
      resultSummary: succeeded ? "verified" : null,
      errorCategory: error?.category ?? null,
      itemsCompleted: succeeded ? 1 : 0,
      endedAt: now,
      updatedAt: now
    })
    .where(eq(tasks.id, record.taskId));
  await updateActivityItems(record.taskId, [item]);
  await insertActivity(
    context,
    record.taskId,
    succeeded ? "step_succeeded" : "step_failed",
    "documents_activity_read",
    [item],
    record.toolCallId
  );
  await insertActivity(
    context,
    record.taskId,
    succeeded ? "task_completed" : "task_failed",
    "documents_activity_read",
    [item],
    record.toolCallId
  );
}

export async function listDocumentsForUser(
  context: WorkflowContext,
  query = "",
  pageToken: string | null = null
): Promise<ResourceState<DriveListing>> {
  const access = await accessTokenOrError(context.userId);
  if ("error" in access) return blockedResource(access.error);

  try {
    const listing = await listGoogleDocuments(access.token, query, pageToken);
    return listing.items.length === 0 && !listing.nextPageToken
      ? emptyResource("no_results")
      : readyResource(listing);
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    return blockedResource(errorFromGoogle(error));
  }
}

export async function readDriveItemForUser(
  context: WorkflowContext,
  itemId: string
): Promise<ResourceState<DriveItem>> {
  const access = await accessTokenOrError(context.userId);
  if ("error" in access) return blockedResource(access.error);

  try {
    return readyResource(await getGoogleDriveItem(access.token, itemId));
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    return blockedResource(errorFromGoogle(error));
  }
}

export async function readDocumentForUser(
  context: WorkflowContext,
  documentId: string
): Promise<ResourceState<AksaDocumentModel>> {
  const item = affectedDocument(documentId, "Google document");
  const access = await accessTokenOrError(context.userId);
  if ("error" in access) {
    return blockedResource(access.error);
  }
  const record = await beginTask(
    context,
    "Read a Google Doc",
    "read_document",
    item,
    "docs.read",
    "read",
    false
  );

  try {
    const raw = await getDocument(access.token, documentId);
    const document = adaptGoogleDocument(raw);
    await finishRead(context, record, affectedDocument(documentId, document.title), null);
    return readyResource(document);
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    const mapped = errorFromGoogle(error);
    await finishRead(context, record, item, mapped);
    return blockedResource(mapped);
  }
}

function appendIndex(raw: GoogleDocsGetResponse): number {
  const maxEndIndex = raw.body.content.reduce(
    (max, element) => Math.max(max, element.endIndex),
    1
  );
  return Math.max(1, maxEndIndex - 1);
}

function documentPlainText(document: AksaDocumentModel): string {
  return document.blocks.map((block) => block.plainText).filter(Boolean).join("\n");
}

function toConfirmation(
  row: typeof confirmations.$inferSelect,
  item: ActivityItem,
  appendText: string
): Confirmation {
  return confirmationSchema.parse({
    id: row.id,
    taskId: row.taskId,
    action: "docs_apply_edit",
    scopeItems: [item],
    scopeItemsTotal: 1,
    destinationName: null,
    changesExternalData: true,
    externalSystem: "google_docs",
    undoSupported: false,
    undoUnsupportedReasonKey: "documents_append_undo_unavailable",
    expiresAt: row.expiresAt,
    canApprove: row.state === "pending" && row.expiresAt > Date.now(),
    canEdit: row.state === "pending" && row.expiresAt > Date.now(),
    canCancel: row.state === "pending" && row.expiresAt > Date.now(),
    illustrative: false,
    preview: appendText
  });
}

export async function proposeDocumentAppend(
  context: WorkflowContext,
  input: AppendRequest
): Promise<ProposalResult> {
  const parsed = appendRequestSchema.safeParse(input);
  if (!parsed.success) return { outcome: "blocked", error: createAksaError("validation_failed") };

  const access = await accessTokenOrError(context.userId);
  if ("error" in access) return { outcome: "blocked", error: access.error };

  let raw: GoogleDocsGetResponse;
  try {
    raw = await getDocument(access.token, parsed.data.documentId);
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    return { outcome: "blocked", error: errorFromGoogle(error) };
  }

  const document = adaptGoogleDocument(raw);
  if (document.revisionId !== parsed.data.expectedRevisionId) {
    return { outcome: "blocked", error: createAksaError("verification_failed") };
  }

  const item = affectedDocument(parsed.data.documentId, document.title);
  const record = await beginTask(
    context,
    "Review an append edit for a Google Doc",
    "edit_document",
    item,
    "docs.apply_edit",
    "write",
    true
  );
  const confirmationId = id("confirmation");
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await db.insert(confirmations).values({
    id: confirmationId,
    taskId: record.taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    actionKey: "docs_apply_edit",
    actionSummary: "Append text to a Google Doc",
    scopeItems: JSON.stringify([item]),
    changesExternalData: 1,
    undoSupported: 0,
    state: "pending",
    expiresAt,
    answeredAt: null,
    consumedAt: null,
    createdAt: Date.now()
  });

  await db.insert(artifacts).values({
    id: id("artifact"),
    taskId: record.taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    kind: "google_docs_pending_edit",
    title: document.title,
    body: JSON.stringify({
      documentId: parsed.data.documentId,
      expectedRevisionId: parsed.data.expectedRevisionId,
      appendText: parsed.data.appendText
    }),
    bodyFormat: "application/json",
    language: null,
    provider: "google_docs",
    retrievedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null
  });

  await db
    .update(toolCalls)
    .set({ confirmationId })
    .where(eq(toolCalls.id, record.toolCallId));
  await insertActivity(
    context,
    record.taskId,
    "confirmation_requested",
    "documents_activity_review",
    [item],
    record.toolCallId
  );

  return {
    outcome: "confirmation_required",
    confirmation: toConfirmation(
      {
        id: confirmationId,
        taskId: record.taskId,
        userId: context.userId,
        workspaceId: context.workspaceId,
        actionKey: "docs_apply_edit",
        actionSummary: "Append text to a Google Doc",
        scopeItems: JSON.stringify([item]),
        changesExternalData: 1,
        undoSupported: 0,
        state: "pending",
        expiresAt,
        answeredAt: null,
        consumedAt: null,
        createdAt: Date.now()
      },
      item,
      parsed.data.appendText
    )
  };
}

async function taskForUser(taskId: string, context: WorkflowContext): Promise<Task> {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, context.userId), eq(tasks.workspaceId, context.workspaceId))
  });
  if (!task) {
    throw new Error("Task not found");
  }
  const taskArtifacts = await db.query.artifacts.findMany({
    where: and(eq(artifacts.taskId, taskId), eq(artifacts.userId, context.userId))
  });
  const taskToolCalls = await db.query.toolCalls.findMany({
    where: and(eq(toolCalls.taskId, taskId), eq(toolCalls.userId, context.userId))
  });
  const firstItem = taskArtifacts[0] ? { id: taskArtifacts[0].title, name: taskArtifacts[0].title, kind: "document" as const } : null;
  const error = task.errorCategory && [
    "not_configured", "connection_required", "scope_required", "authentication_required", "session_expired",
    "permission_denied", "not_found", "unsupported", "unavailable", "rate_limited", "timeout",
    "validation_failed", "verification_failed", "partial_failure", "cancelled", "undo_unavailable", "internal_error"
  ].includes(task.errorCategory)
    ? createAksaError(task.errorCategory as Parameters<typeof createAksaError>[0])
    : null;

  return {
    id: task.id,
    title: task.intent === "edit_document" ? "Update a Google Doc" : "Read a Google Doc",
    intentCategory: intentCategorySchema.safeParse(task.intent).success
      ? (task.intent as Task["intentCategory"])
      : null,
    state: taskStateSchema.parse(task.state),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    affectedItems: firstItem ? [firstItem] : [],
    artifactIds: taskArtifacts.map((artifact) => artifact.id),
    confirmationId: taskToolCalls.find((call) => call.confirmationId)?.confirmationId ?? null,
    undoId: null,
    cancellationAvailable: false,
    itemsTotal: task.itemsTotal,
    itemsCompleted: task.itemsCompleted,
    resultSummaryKey: task.resultSummary,
    error
  };
}

export async function readPersistedTaskHistory(
  userId: string,
  workspaceId: string
): Promise<ResourceState<TaskList>> {
  await ensureLocalSchema();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)))
    .orderBy(desc(tasks.createdAt))
    .limit(50);
  if (rows.length === 0) return emptyResource("no_tasks");

  const context = { userId, workspaceId };
  const history = await Promise.all(rows.map((task) => taskForUser(task.id, context)));
  return readyResource({ tasks: history, nextCursor: null });
}

async function finishMutation(
  context: WorkflowContext,
  taskId: string,
  error: AksaError | null,
  item: ActivityItem,
  verified: boolean,
  verificationToolCallId: string | null = null
): Promise<Task> {
  const now = Date.now();
  await db
    .update(tasks)
    .set({
      state: error ? "failed" : "completed",
      resultSummary: error ? null : "verified",
      errorCategory: error?.category ?? null,
      itemsCompleted: error ? 0 : 1,
      endedAt: now,
      updatedAt: now
    })
    .where(eq(tasks.id, taskId));
  await insertActivity(
    context,
    taskId,
    error ? "task_failed" : "task_completed",
    "documents_activity_verify",
    [item],
    verificationToolCallId
  );
  void verified;
  return taskForUser(taskId, context);
}

async function markConfirmationExpired(
  context: WorkflowContext,
  row: typeof confirmations.$inferSelect,
  item: ActivityItem
): Promise<DocsConfirmationResult> {
  const now = Date.now();
  await db
    .update(confirmations)
    .set({ state: "expired", answeredAt: now })
    .where(eq(confirmations.id, row.id));
  await db
    .update(tasks)
    .set({ state: "failed", errorCategory: "cancelled", endedAt: now, updatedAt: now })
    .where(eq(tasks.id, row.taskId));
  await insertActivity(context, row.taskId, "confirmation_expired", "documents_activity_review", [item], null);
  await insertActivity(context, row.taskId, "task_failed", "documents_activity_review", [item], null);
  return { outcome: "expired", error: createAksaError("cancelled") };
}

async function cancelConfirmation(
  context: WorkflowContext,
  row: typeof confirmations.$inferSelect,
  item: ActivityItem,
  edited: boolean,
  appendText: string | null
): Promise<DocsConfirmationResult> {
  const now = Date.now();
  await db
    .update(confirmations)
    .set({ state: "cancelled", answeredAt: now })
    .where(eq(confirmations.id, row.id));
  await db
    .update(tasks)
    .set({ state: "cancelled", errorCategory: "cancelled", endedAt: now, updatedAt: now })
    .where(eq(tasks.id, row.taskId));
  await db
    .update(artifacts)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(artifacts.taskId, row.taskId), eq(artifacts.userId, context.userId)));
  await insertActivity(
    context,
    row.taskId,
    edited ? "confirmation_edited" : "confirmation_cancelled",
    "documents_activity_review",
    [item],
    null
  );
  await insertActivity(context, row.taskId, "task_cancelled", "documents_activity_review", [item], null);
  if (edited && appendText) {
    return {
      outcome: "edit_requested",
      confirmation: toConfirmation(row, item, appendText)
    };
  }
  return { outcome: "cancelled", task: await taskForUser(row.taskId, context) };
}

export async function respondToDocumentConfirmation(
  context: WorkflowContext,
  confirmationId: string,
  decision: "approve" | "edit" | "cancel"
): Promise<DocsConfirmationResult> {
  await ensureLocalSchema();
  const row = await db.query.confirmations.findFirst({
    where: and(
      eq(confirmations.id, confirmationId),
      eq(confirmations.userId, context.userId),
      eq(confirmations.workspaceId, context.workspaceId)
    )
  });
  if (!row) return { outcome: "already_consumed", error: createAksaError("not_found") };

  const artifact = await db.query.artifacts.findFirst({
    where: and(eq(artifacts.taskId, row.taskId), eq(artifacts.userId, context.userId), eq(artifacts.kind, "google_docs_pending_edit"))
  });
  const payload = pendingEditSchema.safeParse(safeJson(artifact?.body, null));
  const item = affectedDocument(payload.success ? payload.data.documentId : "document", artifact?.title ?? "Google document");

  if (row.state !== "pending") {
    return { outcome: "already_consumed", error: createAksaError("unavailable") };
  }
  if (row.expiresAt <= Date.now()) {
    return markConfirmationExpired(context, row, item);
  }
  if (decision === "cancel" || decision === "edit") {
    return cancelConfirmation(
      context,
      row,
      item,
      decision === "edit",
      payload.success ? payload.data.appendText : null
    );
  }
  if (!payload.success) {
    return { outcome: "failed", error: createAksaError("internal_error"), task: await taskForUser(row.taskId, context) };
  }

  const claimed = await db
    .update(confirmations)
    .set({ state: "consumed", answeredAt: Date.now(), consumedAt: Date.now() })
    .where(
      and(
        eq(confirmations.id, confirmationId),
        eq(confirmations.userId, context.userId),
        eq(confirmations.state, "pending"),
        gt(confirmations.expiresAt, Date.now())
      )
    )
    .returning({ id: confirmations.id });
  if (claimed.length !== 1) {
    return { outcome: "already_consumed", error: createAksaError("unavailable") };
  }

  const reviewItem = item;
  await insertActivity(context, row.taskId, "confirmation_approved", "documents_activity_review", [reviewItem], null);
  const access = await accessTokenOrError(context.userId);
  if ("error" in access) {
    const task = await finishMutation(context, row.taskId, access.error, reviewItem, false);
    return { outcome: "failed", error: access.error, task };
  }

  await db
    .update(tasks)
    .set({ state: "executing", updatedAt: Date.now() })
    .where(eq(tasks.id, row.taskId));
  const writeStepId = id("step");
  const writeToolCallId = id("tool");
  await db.insert(taskSteps).values({
    id: writeStepId,
    taskId: row.taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    sequence: 2,
    label: "documents_activity_write",
    state: "executing",
    requiresConfirmation: 0,
    startedAt: Date.now(),
    endedAt: null,
    createdAt: Date.now()
  });
  await db.insert(toolCalls).values({
    id: writeToolCallId,
    taskId: row.taskId,
    taskStepId: writeStepId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    toolName: "docs.apply_edit",
    toolKind: "write",
    argumentsSummary: JSON.stringify({ documentId: payload.data.documentId, operation: "appendText" }),
    outcome: "executing",
    errorCategory: null,
    affectedItemCount: 1,
    verified: 0,
    durationMs: null,
    confirmationId,
    createdAt: Date.now()
  });
  await insertActivity(context, row.taskId, "step_started", "documents_activity_write", [reviewItem], writeToolCallId);

  let raw: GoogleDocsGetResponse;
  try {
    raw = await getDocument(access.token, payload.data.documentId);
    const current = adaptGoogleDocument(raw);
    if (current.revisionId !== payload.data.expectedRevisionId) {
      throw new GoogleApiError(400, "documents.batchUpdate");
    }

    const prefix = current.blocks.length > 0 ? "\n" : "";
    await batchUpdateDocument(access.token, payload.data.documentId, {
      requests: [{
        insertText: {
          text: `${prefix}${payload.data.appendText}`,
          location: { index: appendIndex(raw) }
        }
      }],
      writeControl: { requiredRevisionId: payload.data.expectedRevisionId }
    });
    await db
      .update(toolCalls)
      .set({ outcome: "succeeded", durationMs: Math.max(0, Date.now() - row.createdAt) })
      .where(eq(toolCalls.id, writeToolCallId));
    await db
      .update(taskSteps)
      .set({ state: "completed", endedAt: Date.now() })
      .where(eq(taskSteps.id, writeStepId));
    await insertActivity(context, row.taskId, "step_succeeded", "documents_activity_write", [reviewItem], writeToolCallId);
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    const mapped = errorFromGoogle(error);
    await db
      .update(toolCalls)
      .set({ outcome: "failed", errorCategory: mapped.category, durationMs: Math.max(0, Date.now() - row.createdAt) })
      .where(eq(toolCalls.id, writeToolCallId));
    await db
      .update(taskSteps)
      .set({ state: "failed", endedAt: Date.now() })
      .where(eq(taskSteps.id, writeStepId));
    await insertActivity(context, row.taskId, "step_failed", "documents_activity_write", [reviewItem], writeToolCallId);
    const task = await finishMutation(context, row.taskId, mapped, reviewItem, false);
    return { outcome: "failed", error: mapped, task };
  }

  const verifyStepId = id("step");
  const verifyToolCallId = id("tool");
  await db.insert(taskSteps).values({
    id: verifyStepId,
    taskId: row.taskId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    sequence: 3,
    label: "documents_activity_verify",
    state: "executing",
    requiresConfirmation: 0,
    startedAt: Date.now(),
    endedAt: null,
    createdAt: Date.now()
  });
  await db.insert(toolCalls).values({
    id: verifyToolCallId,
    taskId: row.taskId,
    taskStepId: verifyStepId,
    userId: context.userId,
    workspaceId: context.workspaceId,
    toolName: "docs.read",
    toolKind: "read",
    argumentsSummary: JSON.stringify({ documentId: payload.data.documentId, purpose: "verify" }),
    outcome: "executing",
    errorCategory: null,
    affectedItemCount: 1,
    verified: 0,
    durationMs: null,
    confirmationId,
    createdAt: Date.now()
  });
  await insertActivity(context, row.taskId, "step_started", "documents_activity_verify", [reviewItem], verifyToolCallId);

  try {
    const verifiedRaw = await getDocument(access.token, payload.data.documentId);
    const verifiedDocument = adaptGoogleDocument(verifiedRaw);
    const verified =
      verifiedRaw.revisionId !== payload.data.expectedRevisionId &&
      documentPlainText(verifiedDocument).endsWith(payload.data.appendText);
    if (!verified) throw new GoogleApiError(400, "documents.get");

    await db
      .update(toolCalls)
      .set({ outcome: "succeeded", verified: 1, durationMs: Math.max(0, Date.now() - row.createdAt) })
      .where(eq(toolCalls.id, verifyToolCallId));
    await db
      .update(taskSteps)
      .set({ state: "completed", endedAt: Date.now() })
      .where(eq(taskSteps.id, verifyStepId));
    await insertActivity(context, row.taskId, "step_succeeded", "documents_activity_verify", [reviewItem], verifyToolCallId);
    const task = await finishMutation(context, row.taskId, null, reviewItem, true, verifyToolCallId);
    return { outcome: "completed", document: verifiedDocument, task };
  } catch (error) {
    if (error instanceof GoogleApiError && error.isUnauthorized) {
      await markGoogleNeedsReconnect(context.userId);
    }
    const mapped = errorFromGoogle(error);
    await db
      .update(toolCalls)
      .set({ outcome: "failed", errorCategory: mapped.category, durationMs: Math.max(0, Date.now() - row.createdAt) })
      .where(eq(toolCalls.id, verifyToolCallId));
    await db
      .update(taskSteps)
      .set({ state: "failed", endedAt: Date.now() })
      .where(eq(taskSteps.id, verifyStepId));
    await insertActivity(context, row.taskId, "step_failed", "documents_activity_verify", [reviewItem], verifyToolCallId);
    const task = await finishMutation(context, row.taskId, mapped, reviewItem, false);
    return { outcome: "failed", error: mapped, task };
  }
}

function activityOutcome(eventType: ActivityEventType): ActivityOutcome {
  if (eventType === "confirmation_requested") return "awaiting_confirmation";
  if (eventType === "task_started" || eventType === "step_started") return "started";
  if (eventType === "step_succeeded" || eventType === "task_completed" || eventType === "undo_completed") return "succeeded";
  if (eventType === "step_failed" || eventType === "task_failed" || eventType === "undo_failed") return "failed";
  if (eventType === "step_skipped") return "skipped";
  return "cancelled";
}

export async function readPersistedActivity(userId: string, workspaceId: string): Promise<ResourceState<{ events: ActivityEvent[]; evidenceBacked: true }>> {
  await ensureLocalSchema();
  const rows = await db
    .select({ event: activityEvents, toolCall: toolCalls })
    .from(activityEvents)
    .leftJoin(toolCalls, eq(activityEvents.toolCallId, toolCalls.id))
    .where(and(eq(activityEvents.userId, userId), eq(activityEvents.workspaceId, workspaceId)))
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);
  if (rows.length === 0) return emptyResource("no_activity");

  const events: ActivityEvent[] = [];
  for (const row of rows) {
    const eventTypeResult = activityEventTypeSchema.safeParse(row.event.eventType);
    if (!eventTypeResult.success) continue;
    const itemsResult = z.array(affectedItemSchema).safeParse(safeJson(row.event.affectedItems, []));
    const errorResult = row.toolCall?.errorCategory
      ? z.string().safeParse(row.toolCall.errorCategory)
      : null;
    const errorCategory = errorResult?.success && [
      "not_configured", "connection_required", "scope_required", "authentication_required", "session_expired",
      "permission_denied", "not_found", "unsupported", "unavailable", "rate_limited", "timeout",
      "validation_failed", "verification_failed", "partial_failure", "cancelled", "undo_unavailable", "internal_error"
    ].includes(errorResult.data)
      ? errorResult.data as ActivityEvent["errorCategory"]
      : null;
    events.push({
      id: row.event.id,
      taskId: row.event.taskId,
      sequence: row.event.sequence,
      eventType: eventTypeResult.data,
      outcome: activityOutcome(eventTypeResult.data),
      actionLabel: row.event.label,
      affectedItems: itemsResult.success ? itemsResult.data : [],
      resultSummaryKey: null,
      verified: Boolean(row.toolCall?.verified),
      createdAt: row.event.createdAt,
      durationMs: row.toolCall?.durationMs ?? null,
      errorCategory
    });
  }
  return readyResource({ events, evidenceBacked: true });
}
