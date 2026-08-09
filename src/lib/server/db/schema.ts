import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Aksa Database Schema (SQLite / Turso)
 *
 * Implements the contract in `.agents/db_schema.md` reconciled with Better Auth.
 */

/* 1. Core Auth Tables (Better Auth + Aksa identity) */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    name: text("name"),
    image: text("image_url"),
    defaultWorkspaceId: text("default_workspace_id"),
    locale: text("locale").default("en"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" })
  },
  (table) => [index("idx_users_email").on(table.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt)
  ]
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
  },
  (table) => [
    uniqueIndex("idx_accounts_provider_account").on(table.providerId, table.accountId),
    index("idx_accounts_user_id").on(table.userId)
  ]
);

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});

/* 2. Workspace & Membership */

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    locale: text("locale"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "number" })
  },
  (table) => [index("idx_workspaces_owner_deleted").on(table.ownerUserId, table.deletedAt)]
);

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    removedAt: integer("removed_at", { mode: "number" })
  },
  (table) => [uniqueIndex("idx_workspace_members_unique").on(table.workspaceId, table.userId)]
);

/* 3. Accessibility Profiles & Consents */

export const accessibilityProfiles = sqliteTable(
  "accessibility_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    pointerSensitivity: integer("pointer_sensitivity").notNull().default(50),
    deadZone: integer("dead_zone").notNull().default(20),
    smoothing: integer("smoothing").notNull().default(40),
    selectionMode: text("selection_mode").notNull().default("dwell"),
    dwellDurationMs: integer("dwell_duration_ms").default(1200),
    gestureType: text("gesture_type"),
    gestureThreshold: integer("gesture_threshold"),
    gestureCooldownMs: integer("gesture_cooldown_ms"),
    reacquisitionPointerBehavior: text("reacquisition_pointer_behavior")
      .notNull()
      .default("keep_position"),
    reducedMotion: integer("reduced_motion").notNull().default(0),
    uiPreferences: text("ui_preferences"),
    calibratedAt: integer("calibrated_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_accessibility_profiles_user_id").on(table.userId)]
);

export const consentRecords = sqliteTable(
  "consent_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consentType: text("consent_type").notNull(),
    granted: integer("granted", { mode: "number" }).notNull(),
    policyVersion: text("policy_version").notNull(),
    grantedAt: integer("granted_at", { mode: "number" }),
    revokedAt: integer("revoked_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_consent_records_user_type").on(table.userId, table.consentType)]
);

/* 4. Google OAuth Connections (User-Scoped & Encrypted Refresh Token) */

export const oauthConnections = sqliteTable(
  "oauth_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id"),
    providerEmail: text("provider_email"),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    refreshTokenKeyVersion: integer("refresh_token_key_version").default(1),
    grantedScopes: text("granted_scopes"),
    status: text("status").notNull(), // 'active' | 'needs_reconnect' | 'revoked'
    lastVerifiedAt: integer("last_verified_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull()
  },
  (table) => [uniqueIndex("idx_oauth_conn_user_provider").on(table.userId, table.provider)]
);

/* 5. Tasks, Steps, Tool Calls, Artifacts */

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    inputMode: text("input_mode"),
    commandText: text("command_text").notNull(),
    intent: text("intent"),
    state: text("state").notNull(),
    resultSummary: text("result_summary"),
    errorCategory: text("error_category"),
    itemsTotal: integer("items_total"),
    itemsCompleted: integer("items_completed"),
    idempotencyKey: text("idempotency_key").notNull(),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    endedAt: integer("ended_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "number" })
  },
  (table) => [
    uniqueIndex("idx_tasks_user_idempotency").on(table.userId, table.idempotencyKey),
    index("idx_tasks_user_workspace_created").on(table.userId, table.workspaceId, table.createdAt)
  ]
);

export const taskSteps = sqliteTable(
  "task_steps",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    label: text("label").notNull(),
    state: text("state").notNull(),
    requiresConfirmation: integer("requires_confirmation").default(0),
    startedAt: integer("started_at", { mode: "number" }),
    endedAt: integer("ended_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [uniqueIndex("idx_task_steps_task_seq").on(table.taskId, table.sequence)]
);

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    taskStepId: text("task_step_id").references(() => taskSteps.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    toolKind: text("tool_kind"),
    argumentsSummary: text("arguments_summary"),
    outcome: text("outcome"),
    errorCategory: text("error_category"),
    affectedItemCount: integer("affected_item_count"),
    verified: integer("verified").default(0),
    durationMs: integer("duration_ms"),
    confirmationId: text("confirmation_id"),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_tool_calls_task_created").on(table.taskId, table.createdAt)]
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    bodyFormat: text("body_format"),
    language: text("language"),
    provider: text("provider"),
    retrievedAt: integer("retrieved_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "number" })
  },
  (table) => [index("idx_artifacts_user_workspace_created").on(table.userId, table.workspaceId, table.createdAt)]
);

export const artifactSources = sqliteTable(
  "artifact_sources",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sourceType: text("source_type"),
    title: text("title").notNull(),
    url: text("url"),
    domain: text("domain"),
    snippet: text("snippet"),
    retrievedAt: integer("retrieved_at", { mode: "number" }).notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [uniqueIndex("idx_artifact_sources_pos").on(table.artifactId, table.position)]
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    eventType: text("event_type").notNull(),
    label: text("label").notNull(),
    affectedItems: text("affected_items"),
    toolCallId: text("tool_call_id").references(() => toolCalls.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [uniqueIndex("idx_activity_events_seq").on(table.taskId, table.sequence)]
);

export const confirmations = sqliteTable(
  "confirmations",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actionKey: text("action_key").notNull(),
    actionSummary: text("action_summary").notNull(),
    scopeItems: text("scope_items").notNull(),
    changesExternalData: integer("changes_external_data").default(0),
    undoSupported: integer("undo_supported").default(0),
    state: text("state").notNull(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    answeredAt: integer("answered_at", { mode: "number" }),
    consumedAt: integer("consumed_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_confirmations_task_state").on(table.taskId, table.state)]
);

export const undoRecords = sqliteTable(
  "undo_records",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    toolCallId: text("tool_call_id")
      .notNull()
      .references(() => toolCalls.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    undoKind: text("undo_kind").notNull(),
    reversePayload: text("reverse_payload").notNull(),
    state: text("state").notNull(),
    itemsTotal: integer("items_total").notNull(),
    itemsReverted: integer("items_reverted"),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    appliedAt: integer("applied_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [uniqueIndex("idx_undo_records_tool_call").on(table.toolCallId)]
);

export const providerUsage = sqliteTable(
  "provider_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    provider: text("provider"),
    model: text("model"),
    operation: text("operation"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicros: integer("cost_micros"),
    latencyMs: integer("latency_ms"),
    outcome: text("outcome"),
    retryCount: integer("retry_count").notNull().default(0),
    fallbackUsed: integer("fallback_used").default(0),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_provider_usage_user_created").on(table.userId, table.createdAt)]
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id"),
    eventType: text("event_type").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    detail: text("detail"),
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => [index("idx_audit_logs_user_created").on(table.userId, table.createdAt)]
);
