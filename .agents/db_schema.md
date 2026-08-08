# Aksa Database Schema

| Field | Value |
| --- | --- |
| Engine | Turso hosted libSQL, SQLite-compatible |
| Access layer | Drizzle ORM with Drizzle migrations |
| Driver | `@libsql/client`, the driver Drizzle supports for production Turso access |
| Owner | Zaltech |
| Status | Design 1.0, no migration code yet |

This document is the schema contract. It does not contain migration code. Write migrations only after this design is accepted.

Authorization requirements come from `.agents/security.md`. Product behavior comes from `.agents/prd.md`.

## 1. Design Rules

1. Every product record is scoped by `user_id`. Every workspace-scoped record also carries `workspace_id`.
2. Ownership columns are denormalized onto child tables so a row can be authorized without traversing a join chain that a developer might forget.
3. Externally visible identifiers are unguessable text identifiers, not sequential integers.
4. Timestamps are stored as integer Unix milliseconds in UTC. SQLite has no native timestamp type.
5. Booleans are stored as integer `0` or `1`.
6. Structured payloads are stored as `text` containing JSON, validated with Zod on read and write.
7. Enumerated values are stored as `text` with a `CHECK` constraint listing the allowed values.
8. Money and token counts are stored as integers. No floating point for cost.
9. Foreign keys are declared with explicit `ON DELETE` behavior. Enable `PRAGMA foreign_keys` on every connection.
10. No table stores raw camera frames, plaintext OAuth refresh tokens, API keys, model reasoning traces, or personal data the product does not need.

### SQLite type mapping

| Concept | Column type | Note |
| --- | --- | --- |
| Identifier | `text` | UUID v4 or equivalent, primary key |
| Short label | `text` | |
| Long content | `text` | Length capped in application code |
| JSON payload | `text` | Zod-validated |
| Timestamp | `integer` | Unix milliseconds |
| Boolean | `integer` | `0` or `1`, `CHECK (col IN (0,1))` |
| Count or token total | `integer` | |
| Cost | `integer` | Micro-units of the billing currency |
| Encrypted value | `text` | Base64 ciphertext plus a separate key version column |

## 2. Table Overview

| Table | Purpose | Tenant scope |
| --- | --- | --- |
| `users` | Account identity | Self |
| `accounts` | Authentication provider links | `user_id` |
| `sessions` | Active sessions | `user_id` |
| `workspaces` | Container for a user's tasks and data | `user_id` |
| `workspace_members` | Membership and role, single owner in MVP | `user_id`, `workspace_id` |
| `accessibility_profiles` | Saved head control and selection settings | `user_id` |
| `oauth_connections` | Google connection and granted scopes | `user_id` |
| `tasks` | One user request and its lifecycle | `user_id`, `workspace_id` |
| `task_steps` | Ordered plan steps of a task | `user_id`, `workspace_id` |
| `tool_calls` | Real executed tool invocations | `user_id`, `workspace_id` |
| `artifacts` | Stored readable results | `user_id`, `workspace_id` |
| `artifact_sources` | Citations backing an artifact | `user_id`, `workspace_id` |
| `activity_events` | User-visible action record | `user_id`, `workspace_id` |
| `confirmations` | Single-use approval for a consequential action | `user_id`, `workspace_id` |
| `undo_records` | Reversal capability for a completed action | `user_id`, `workspace_id` |
| `provider_usage` | Model and search cost attribution | `user_id`, `workspace_id` |
| `audit_logs` | Append-only security record | `user_id` |
| `consent_records` | Camera, microphone, and search consent | `user_id` |

## 3. Tables

### 3.1 `users`

Account identity. The authentication library owns the exact column set; the columns below are the minimum Aksa needs. Reconcile with the chosen library before writing migrations.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `email` | `text` | Not null, unique, stored lowercase |
| `email_verified` | `integer` | `0` or `1` |
| `name` | `text` | Nullable, user-supplied display name |
| `image_url` | `text` | Nullable |
| `default_workspace_id` | `text` | Nullable, set after first workspace creation |
| `locale` | `text` | `id` or `en`, `CHECK` constrained |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |
| `deleted_at` | `integer` | Nullable, soft delete marker |

- Primary key: `id`
- Unique: `email`
- Indexes: `email`
- Deletion: soft delete first, then a hard purge job that cascades to all owned data
- Retention: purge 30 days after account deletion request
- Sensitive fields: `email`, `name`, `image_url`. Never include in a log line.
- Not stored: password hash lives in the authentication library's own table, not here

### 3.2 `accounts`

Links a user to an authentication provider identity. Owned by the authentication library.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `provider_id` | `text` | For example `credential` or `google` |
| `account_id` | `text` | Provider-side subject identifier |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |

- Foreign keys: `user_id` references `users.id` `ON DELETE CASCADE`
- Unique: `(provider_id, account_id)`
- Indexes: `user_id`
- Sensitive fields: `account_id`
- Not stored here: Google API tokens. Those live in `oauth_connections` with encryption. Sign-in provider tokens are not reused for Google Workspace API access.

### 3.3 `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `token_hash` | `text` | Hash of the session token, never the token itself |
| `expires_at` | `integer` | Not null |
| `ip_hash` | `text` | Nullable, hashed address for abuse detection |
| `user_agent` | `text` | Nullable, truncated |
| `created_at` | `integer` | Not null |
| `revoked_at` | `integer` | Nullable |

- Foreign keys: `user_id` references `users.id` `ON DELETE CASCADE`
- Unique: `token_hash`
- Indexes: `user_id`, `expires_at`
- Deletion: hard delete on sign out or expiry sweep
- Retention: delete expired rows daily
- Sensitive fields: `token_hash`, `ip_hash`. Never returned to a client.

### 3.4 `workspaces`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `owner_user_id` | `text` | Not null, FK to `users.id` |
| `name` | `text` | Not null |
| `locale` | `text` | Nullable, overrides user locale |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |
| `deleted_at` | `integer` | Nullable |

- Foreign keys: `owner_user_id` references `users.id` `ON DELETE CASCADE`
- Indexes: `owner_user_id`, `(owner_user_id, deleted_at)`
- Ownership: `owner_user_id` is the authorization anchor for the whole workspace subtree
- Deletion: soft delete, then cascade purge of all workspace-scoped rows
- MVP note: exactly one workspace is created per user during onboarding

### 3.5 `workspace_members`

Present so membership is a first-class concept and future sharing does not require a schema rewrite. MVP writes exactly one `owner` row per workspace.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `workspace_id` | `text` | Not null, FK to `workspaces.id` |
| `user_id` | `text` | Not null, FK to `users.id` |
| `role` | `text` | `CHECK (role IN ('owner','editor','viewer'))`, MVP writes `owner` only |
| `created_at` | `integer` | Not null |
| `removed_at` | `integer` | Nullable |

- Foreign keys: both `ON DELETE CASCADE`
- Unique: `(workspace_id, user_id)`
- Indexes: `user_id`, `workspace_id`
- Authorization: workspace access is granted only through an active row here

### 3.6 `accessibility_profiles`

Saved control settings. Contains no biometric data and no camera imagery.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `pointer_sensitivity` | `integer` | Normalized 0 to 100 |
| `dead_zone` | `integer` | Normalized 0 to 100 |
| `smoothing` | `integer` | Normalized 0 to 100 |
| `selection_mode` | `text` | `CHECK (selection_mode IN ('dwell','gesture','both','off'))` |
| `dwell_duration_ms` | `integer` | Nullable when dwell is off |
| `gesture_type` | `text` | Nullable, `CHECK (gesture_type IN ('mouth_open','brow_raise','eye_blink_long','smile'))` |
| `gesture_threshold` | `integer` | Nullable, normalized 0 to 100 |
| `gesture_cooldown_ms` | `integer` | Nullable |
| `reacquisition_pointer_behavior` | `text` | `keep_position` or `reset_center` |
| `reduced_motion` | `integer` | `0` or `1`, user override of the system preference |
| `ui_preferences` | `text` | JSON for validated presentation, language, theme, sidebar, and control preferences |
| `calibrated_at` | `integer` | Nullable, last successful calibration |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |

- Foreign keys: `user_id` references `users.id` `ON DELETE CASCADE`
- Unique: `user_id`, one active profile per user in MVP
- Indexes: `user_id`
- Deletion: hard delete with the account
- Retention: retained while the account exists
- Not stored: landmark coordinates, blendshape series, frames, face geometry, calibration imagery
- Note: the client may cache these values in IndexedDB for immediate startup. The server row is authoritative.
- Preference reconciliation: anonymous preferences use a safe client cache; changed fields merge into the account snapshot at sign-in, then the account row is authoritative.

### 3.7 `oauth_connections`

Google Workspace connection. Separate from sign-in identity.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `provider` | `text` | `CHECK (provider IN ('google'))` in MVP |
| `provider_account_id` | `text` | Google subject identifier |
| `provider_email` | `text` | Nullable, shown so the user knows which account is connected |
| `refresh_token_ciphertext` | `text` | Encrypted at rest, never returned to a client |
| `refresh_token_key_version` | `integer` | Supports key rotation |
| `granted_scopes` | `text` | JSON array of scope strings |
| `status` | `text` | `CHECK (status IN ('active','needs_reconnect','revoked'))` |
| `last_verified_at` | `integer` | Nullable, last successful API call |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |

- Foreign keys: `user_id` references `users.id` `ON DELETE CASCADE`
- Unique: `(user_id, provider)`
- Indexes: `user_id`, `status`
- Deletion: hard delete on disconnect, after revoking the token with Google
- Retention: deleted immediately on disconnect or account deletion
- Sensitive fields: `refresh_token_ciphertext`, `provider_account_id`, `provider_email`
- Not stored: access tokens. Access tokens are held in memory for the duration of a request only.

### 3.8 `tasks`

One user request and its lifecycle.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `workspace_id` | `text` | Not null, FK to `workspaces.id` |
| `input_mode` | `text` | `CHECK (input_mode IN ('voice','text'))` |
| `command_text` | `text` | Not null, the submitted or edited transcript |
| `intent` | `text` | Nullable, resolved intent key |
| `state` | `text` | `CHECK (state IN ('understanding','waiting_confirmation','executing','completed','partially_completed','failed','cancelled'))` |
| `result_summary` | `text` | Nullable, short user-facing outcome |
| `error_category` | `text` | Nullable, stable category, never a raw provider message |
| `items_total` | `integer` | Nullable, planned affected item count |
| `items_completed` | `integer` | Nullable |
| `idempotency_key` | `text` | Not null, prevents duplicate execution from a double submit |
| `started_at` | `integer` | Not null |
| `ended_at` | `integer` | Nullable |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |
| `deleted_at` | `integer` | Nullable |

- Foreign keys: `user_id` `ON DELETE CASCADE`, `workspace_id` `ON DELETE CASCADE`
- Unique: `(user_id, idempotency_key)`
- Indexes: `(user_id, workspace_id, created_at)`, `(workspace_id, state)`, `(user_id, deleted_at)`
- Deletion: soft delete, then cascade purge of steps, tool calls, artifacts, sources, activity, confirmations, undo records
- Retention: configurable, default 90 days after completion
- Sensitive fields: `command_text` may contain personal content. Redact from logs.
- Not stored: model reasoning, prompt text, provider raw responses
- Note: `state` values map one-to-one to the product agent states in `.agents/design.md` section 8, except `Idle`, `Listening`, and `Transcribing`, which are client-only and never persisted

### 3.9 `task_steps`

The ordered plan. A step row exists once the step is planned; its outcome is written only after real execution.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `sequence` | `integer` | Not null, 1-based order |
| `label` | `text` | Not null, product-language step name |
| `state` | `text` | `CHECK (state IN ('pending','running','succeeded','failed','skipped','cancelled'))` |
| `requires_confirmation` | `integer` | `0` or `1` |
| `started_at` | `integer` | Nullable |
| `ended_at` | `integer` | Nullable |
| `created_at` | `integer` | Not null |

- Foreign keys: `task_id` `ON DELETE CASCADE`, `user_id` `ON DELETE CASCADE`, `workspace_id` `ON DELETE CASCADE`
- Unique: `(task_id, sequence)`
- Indexes: `(task_id, sequence)`, `(user_id, workspace_id)`
- Deletion: cascade with the task
- Retention: same as the parent task

### 3.10 `tool_calls`

A row exists only after a tool actually ran. This table is the evidence behind every claim the interface makes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `task_step_id` | `text` | Nullable, FK to `task_steps.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `tool_name` | `text` | Not null, registry key |
| `tool_kind` | `text` | `CHECK (tool_kind IN ('read','write','search'))` |
| `arguments_summary` | `text` | JSON of non-content arguments plus counts. Content is summarized, never stored verbatim |
| `outcome` | `text` | `CHECK (outcome IN ('succeeded','failed','timed_out','cancelled','rejected'))` |
| `error_category` | `text` | Nullable, stable category |
| `affected_item_count` | `integer` | Nullable |
| `verified` | `integer` | `0` or `1`, whether the result was read back and checked |
| `duration_ms` | `integer` | Nullable |
| `confirmation_id` | `text` | Nullable, FK to `confirmations.id` for consequential calls |
| `created_at` | `integer` | Not null |

- Foreign keys: `task_id` `ON DELETE CASCADE`, `task_step_id` `ON DELETE SET NULL`, `confirmation_id` `ON DELETE SET NULL`, ownership columns `ON DELETE CASCADE`
- Indexes: `(task_id, created_at)`, `(user_id, workspace_id, created_at)`, `tool_name`
- Deletion: cascade with the task
- Retention: same as the parent task
- Sensitive fields: `arguments_summary`. Never include document bodies, email bodies, or tokens.
- Constraint in application code: a `write` tool call must reference a `confirmation_id` whose state is `consumed`

### 3.11 `artifacts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `kind` | `text` | `CHECK (kind IN ('search_summary','document_summary','sheet_summary','email_summary'))` |
| `title` | `text` | Not null |
| `body` | `text` | Not null, safe structured text |
| `body_format` | `text` | `CHECK (body_format IN ('markdown_safe','plain'))` |
| `language` | `text` | `id` or `en` |
| `provider` | `text` | Nullable, which model or search family produced it |
| `retrieved_at` | `integer` | Nullable, when the underlying sources were fetched |
| `created_at` | `integer` | Not null |
| `updated_at` | `integer` | Not null |
| `deleted_at` | `integer` | Nullable |

- Foreign keys: `task_id` `ON DELETE CASCADE`, ownership columns `ON DELETE CASCADE`
- Indexes: `(user_id, workspace_id, created_at)`, `task_id`, `(workspace_id, kind)`
- Deletion: soft delete, purged with the task
- Retention: configurable, default 90 days
- Sensitive fields: `body` may summarize private documents or email
- Rendering rule: `markdown_safe` means a restricted subset rendered without raw HTML. See `.agents/security.md` section 5.

### 3.12 `artifact_sources`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `artifact_id` | `text` | Not null, FK to `artifacts.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `position` | `integer` | Not null, citation order |
| `source_type` | `text` | `CHECK (source_type IN ('web','drive_file','doc','sheet','email'))` |
| `title` | `text` | Not null |
| `url` | `text` | Nullable for internal sources |
| `domain` | `text` | Nullable, shown on the source card |
| `snippet` | `text` | Nullable, capped length, treated as untrusted text |
| `retrieved_at` | `integer` | Not null |
| `created_at` | `integer` | Not null |

- Foreign keys: `artifact_id` `ON DELETE CASCADE`, ownership columns `ON DELETE CASCADE`
- Unique: `(artifact_id, position)`
- Indexes: `artifact_id`, `(user_id, workspace_id)`
- Deletion: cascade with the artifact
- Retention: same as the artifact
- Rendering rule: `title`, `snippet`, and `domain` are untrusted. Escape before display and never execute.

### 3.13 `activity_events`

The user-visible record. Append-only within a task.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `sequence` | `integer` | Not null |
| `event_type` | `text` | `CHECK (event_type IN ('task_started','step_started','step_succeeded','step_failed','step_skipped','confirmation_requested','confirmation_approved','confirmation_edited','confirmation_cancelled','confirmation_expired','task_completed','task_partially_completed','task_failed','task_cancelled','undo_requested','undo_completed','undo_failed'))` |
| `label` | `text` | Not null, localized product-language description key or text |
| `affected_items` | `text` | Nullable, JSON array of item names and identifiers |
| `tool_call_id` | `text` | Nullable, FK to `tool_calls.id` |
| `created_at` | `integer` | Not null |

- Foreign keys: `task_id` `ON DELETE CASCADE`, `tool_call_id` `ON DELETE SET NULL`, ownership columns `ON DELETE CASCADE`
- Unique: `(task_id, sequence)`
- Indexes: `(task_id, sequence)`, `(user_id, workspace_id, created_at)`
- Deletion: cascade with the task
- Retention: same as the parent task
- Not stored: reasoning traces, prompts, provider payloads
- Rule: an event referencing a tool must have a real `tool_call_id` or a `null` value, never a synthesized reference

### 3.14 `confirmations`

Single-use approval for one consequential action.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, unguessable |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `action_key` | `text` | Not null, the tool the approval authorizes |
| `action_summary` | `text` | Not null, exactly what the user was shown |
| `scope_items` | `text` | Not null, JSON array of the named items and counts shown |
| `changes_external_data` | `integer` | `0` or `1` |
| `undo_supported` | `integer` | `0` or `1`, stated before approval |
| `state` | `text` | `CHECK (state IN ('pending','approved','consumed','edited','cancelled','expired'))` |
| `expires_at` | `integer` | Not null |
| `answered_at` | `integer` | Nullable |
| `consumed_at` | `integer` | Nullable |
| `created_at` | `integer` | Not null |

- Foreign keys: `task_id` `ON DELETE CASCADE`, ownership columns `ON DELETE CASCADE`
- Indexes: `(task_id, state)`, `(user_id, workspace_id)`, `expires_at`
- Deletion: cascade with the task
- Retention: same as the parent task; the record is kept as evidence that approval happened
- Lifecycle rules:
  - `pending` to `approved` requires the authenticated owner
  - `approved` to `consumed` happens once, inside the same transaction as the tool execution record
  - a request against a `consumed`, `cancelled`, or `expired` row is rejected
  - `expires_at` is enforced server-side, not by a client timer
  - an `edited` confirmation is terminal; editing creates a new `pending` row

### 3.15 `undo_records`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `task_id` | `text` | Not null, FK to `tasks.id` |
| `tool_call_id` | `text` | Not null, FK to `tool_calls.id` |
| `user_id` | `text` | Not null, denormalized owner |
| `workspace_id` | `text` | Not null, denormalized owner |
| `undo_kind` | `text` | `CHECK (undo_kind IN ('drive_move','drive_rename','sheets_range_write','docs_edit','gmail_draft_delete'))` |
| `reverse_payload` | `text` | Not null, JSON describing the exact reverse operation, including prior values needed to restore |
| `state` | `text` | `CHECK (state IN ('available','applied','partially_applied','failed','expired'))` |
| `items_total` | `integer` | Not null |
| `items_reverted` | `integer` | Nullable |
| `expires_at` | `integer` | Not null |
| `applied_at` | `integer` | Nullable |
| `created_at` | `integer` | Not null |

- Foreign keys: `task_id` `ON DELETE CASCADE`, `tool_call_id` `ON DELETE CASCADE`, ownership columns `ON DELETE CASCADE`
- Unique: `tool_call_id`, one undo record per executed action
- Indexes: `(user_id, workspace_id, state)`, `expires_at`
- Deletion: cascade with the task
- Retention: same as the parent task, but `state` becomes `expired` after `expires_at`
- Sensitive fields: `reverse_payload` may contain prior document or cell content. Cap size, redact from logs, and never return it to the client.
- Lifecycle rules:
  - a record is created in the same transaction as the successful tool call it reverses
  - `available` to `applied` or `partially_applied` happens once
  - a repeated undo request against a non-`available` record is a no-op with an honest response
  - `undo_supported = 0` on the confirmation means no record is created

### 3.16 `provider_usage`

Cost and limit attribution. One row per provider call.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `workspace_id` | `text` | Nullable, FK to `workspaces.id` |
| `task_id` | `text` | Nullable, FK to `tasks.id` |
| `provider` | `text` | For example `vertex_ai` or `dahl_inference` |
| `model` | `text` | Model identifier used |
| `operation` | `text` | `CHECK (operation IN ('orchestrate','summarize','search_grounded','classify'))` |
| `input_tokens` | `integer` | Nullable |
| `output_tokens` | `integer` | Nullable |
| `cost_micros` | `integer` | Nullable, integer micro-units |
| `latency_ms` | `integer` | Nullable |
| `outcome` | `text` | `CHECK (outcome IN ('succeeded','failed','timed_out','rate_limited','budget_blocked','circuit_open'))` |
| `retry_count` | `integer` | Not null, default `0` |
| `fallback_used` | `integer` | `0` or `1` |
| `created_at` | `integer` | Not null |

- Foreign keys: `user_id` `ON DELETE CASCADE`, `workspace_id` `ON DELETE SET NULL`, `task_id` `ON DELETE SET NULL`
- Indexes: `(user_id, created_at)`, `(workspace_id, created_at)`, `(provider, created_at)`, `outcome`
- Deletion: retained after task deletion for cost accounting, with identifiers set to null
- Retention: configurable, default 180 days
- Not stored: prompt text, completion text, reasoning traces
- Use: per-user, per-workspace, and daily ceiling checks read aggregates from this table before a provider call

### 3.17 `audit_logs`

Append-only security record. Never updated, never deleted by product code.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Nullable, FK to `users.id`, null for pre-authentication events |
| `workspace_id` | `text` | Nullable |
| `event_type` | `text` | `CHECK (event_type IN ('sign_in','sign_in_failed','sign_out','session_revoked','google_connected','google_disconnected','scope_granted','scope_denied','confirmation_approved','consequential_tool_executed','undo_applied','record_deleted','data_exported','budget_blocked','authorization_denied'))` |
| `subject_type` | `text` | Nullable, for example `task` or `artifact` |
| `subject_id` | `text` | Nullable |
| `detail` | `text` | Nullable, JSON with non-sensitive facts only |
| `ip_hash` | `text` | Nullable |
| `created_at` | `integer` | Not null |

- Foreign keys: `user_id` references `users.id` `ON DELETE SET NULL`, so the audit trail survives account deletion
- Indexes: `(user_id, created_at)`, `(event_type, created_at)`, `(subject_type, subject_id)`
- Deletion: no product-code deletion. Purged only by a documented retention job.
- Retention: configurable, default 365 days
- Sensitive fields: `detail` and `ip_hash`. Never expose to a client.
- Not stored: tokens, secrets, document content, email content, transcripts, reasoning traces

### 3.18 `consent_records`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `user_id` | `text` | Not null, FK to `users.id` |
| `consent_type` | `text` | `CHECK (consent_type IN ('camera','microphone','grounded_search','google_connection','settings_persistence'))` |
| `granted` | `integer` | `0` or `1` |
| `policy_version` | `text` | Not null, the disclosure text version shown |
| `granted_at` | `integer` | Nullable |
| `revoked_at` | `integer` | Nullable |
| `created_at` | `integer` | Not null |

- Foreign keys: `user_id` references `users.id` `ON DELETE CASCADE`
- Indexes: `(user_id, consent_type, created_at)`
- Deletion: hard delete with the account
- Retention: retained while the account exists as evidence of consent
- Rule: consent is recorded per type. Camera and microphone are never recorded as a single combined consent.
- Rule: a new `policy_version` requires a new row, not an update

## 4. IDOR-Safe Query Rules

1. Never accept `user_id` or `workspace_id` from client input. Derive both from the session. **Rule from `.agents/security.md` section 1.**
2. Every read filters by the session's `user_id`, and by `workspace_id` for workspace-scoped tables.
3. A missing or foreign row returns a not-found result. Never a distinguishable forbidden response.
4. Reading a child verifies the parent chain in the same query using the denormalized ownership columns.
5. Every write filters the target row by ownership in the `WHERE` clause and then checks the affected row count. Zero affected rows is an authorization failure, not a silent success.
6. Bulk operations authorize every identifier. If any item fails ownership, the whole operation is rejected.
7. Soft-deleted rows are excluded from every read path by default.
8. Expired rows are excluded from every read path that treats expiry as absence, including confirmations and undo records.
9. All queries are parameterized. No string interpolation of identifiers or values.

### Ownership query examples

Expressed as intent, not as final code. Drizzle syntax is Zaltech's call at implementation time.

Read one task:

```sql
SELECT id, state, command_text, result_summary, items_total, items_completed, started_at, ended_at
FROM tasks
WHERE id = :taskId
  AND user_id = :sessionUserId
  AND workspace_id = :sessionWorkspaceId
  AND deleted_at IS NULL;
```

Read an artifact with its sources, verifying ownership on both sides:

```sql
SELECT a.id, a.title, a.body, s.position, s.title, s.url, s.domain, s.retrieved_at
FROM artifacts a
JOIN artifact_sources s
  ON s.artifact_id = a.id
 AND s.user_id = a.user_id
 AND s.workspace_id = a.workspace_id
WHERE a.id = :artifactId
  AND a.user_id = :sessionUserId
  AND a.workspace_id = :sessionWorkspaceId
  AND a.deleted_at IS NULL
ORDER BY s.position;
```

Consume a confirmation, safe against replay:

```sql
UPDATE confirmations
SET state = 'consumed', consumed_at = :now
WHERE id = :confirmationId
  AND user_id = :sessionUserId
  AND workspace_id = :sessionWorkspaceId
  AND state = 'approved'
  AND expires_at > :now;
-- zero affected rows means replayed, expired, foreign, or never approved
```

Delete a task and its subtree:

```sql
DELETE FROM tasks
WHERE id = :taskId
  AND user_id = :sessionUserId
  AND workspace_id = :sessionWorkspaceId;
-- child rows removed by ON DELETE CASCADE
```

## 5. Recommended Indexes

| Table | Index | Serves |
| --- | --- | --- |
| `users` | `email` unique | Sign in |
| `sessions` | `user_id`, `expires_at` | Session lookup and expiry sweep |
| `workspaces` | `(owner_user_id, deleted_at)` | Workspace listing |
| `workspace_members` | `(workspace_id, user_id)` unique | Access check |
| `accessibility_profiles` | `user_id` unique | Profile load at sign in |
| `oauth_connections` | `(user_id, provider)` unique, `status` | Connection check and reconnect sweep |
| `tasks` | `(user_id, workspace_id, created_at)` | History list, newest first |
| `tasks` | `(workspace_id, state)` | Active task lookup |
| `tasks` | `(user_id, idempotency_key)` unique | Duplicate submit protection |
| `task_steps` | `(task_id, sequence)` unique | Ordered plan render |
| `tool_calls` | `(task_id, created_at)` | Task evidence trail |
| `artifacts` | `(user_id, workspace_id, created_at)` | Artifact list |
| `artifact_sources` | `(artifact_id, position)` unique | Citation render |
| `activity_events` | `(task_id, sequence)` unique | Activity render |
| `confirmations` | `(task_id, state)`, `expires_at` | Pending lookup and expiry sweep |
| `undo_records` | `(user_id, workspace_id, state)`, `expires_at` | Undo availability and expiry sweep |
| `provider_usage` | `(user_id, created_at)`, `(workspace_id, created_at)` | Budget aggregation |
| `audit_logs` | `(user_id, created_at)`, `(event_type, created_at)` | Security review |
| `consent_records` | `(user_id, consent_type, created_at)` | Current consent state |

Add an index only when a documented query needs it. Do not pre-index speculative access patterns.

## 6. Transaction Boundaries

libSQL is SQLite-compatible, so transactions are the correct tool for keeping evidence and effect consistent.

| Boundary | Must be atomic |
| --- | --- |
| Task creation | `tasks` insert plus the first `activity_events` row |
| Plan creation | all `task_steps` rows for one plan |
| Confirmation request | `confirmations` insert plus the `confirmation_requested` activity event |
| Consequential execution | `confirmations` state to `consumed`, `tool_calls` insert, `undo_records` insert where supported, `task_steps` state update, and the matching activity event |
| Task completion | `tasks` state and `result_summary`, final `activity_events` row |
| Artifact creation | `artifacts` insert plus all `artifact_sources` rows |
| Undo application | `undo_records` state and counts, `tool_calls` insert for the reversal, and the matching activity event |
| Task deletion | `tasks` delete, relying on cascade for children |
| Google disconnect | `oauth_connections` delete plus `audit_logs` insert, after Google revocation succeeds |

Rules:

- The external effect happens before the success record is written. Never write `succeeded` and then call the API.
- The external call itself is not inside the database transaction. Call the API, then open a short transaction to record the verified outcome.
- If the API succeeded but the recording transaction failed, the next read reconciles by verifying with the provider before reporting a state.
- `provider_usage` is written outside the task transaction so a usage-write failure cannot roll back a real result.

## 7. Lifecycles

### Task lifecycle

```
understanding
  -> waiting_confirmation -> executing
  -> executing
executing
  -> completed
  -> partially_completed
  -> failed
  -> cancelled
```

Rules: `completed` requires every planned step in `succeeded`. Any mix of `succeeded` and `failed` or `skipped` is `partially_completed`. A task with zero successful steps and at least one failure is `failed`. `cancelled` is terminal and preserves completed steps. Terminal states never transition again.

### Artifact lifecycle

```
created (with sources) -> readable -> soft deleted -> purged
```

Rules: an artifact is never created without at least one source row when `kind = 'search_summary'`. An artifact is never updated in place after creation; a revision is a new artifact linked to a new task.

### Confirmation lifecycle

```
pending
  -> approved -> consumed
  -> edited      (terminal, spawns a new pending row)
  -> cancelled   (terminal)
  -> expired     (terminal, server-side)
```

Rules: only the authenticated owner can move `pending` to `approved`. `approved` to `consumed` happens once, inside the execution transaction. Every other transition from a terminal state is rejected.

### Undo lifecycle

```
available
  -> applied
  -> partially_applied
  -> failed
  -> expired
```

Rules: created only alongside a verified successful consequential tool call. Created only when the reverse operation is genuinely supported. A repeated request against a non-`available` record is a no-op with an honest response.

## 8. Retention Strategy

All values are configuration with the defaults below. Retention runs as a scheduled purge, not on read.

| Data | Default retention | Method |
| --- | --- | --- |
| Expired sessions | 1 day after expiry | Hard delete |
| Tasks, steps, tool calls, activity events | 90 days after terminal state | Soft delete then hard purge |
| Artifacts and artifact sources | 90 days, or immediately on user deletion | Soft delete then hard purge |
| Confirmations | With the parent task | Cascade |
| Undo records | With the parent task, `expired` after the window | Cascade |
| Transcripts | Stored only as `tasks.command_text`, so same as tasks | Cascade |
| Provider usage | 180 days | Hard delete, identifiers nulled earlier on task deletion |
| Audit logs | 365 days | Hard delete by the retention job only |
| Consent records | Life of the account | Hard delete with the account |
| Accessibility profiles | Life of the account | Hard delete with the account |
| OAuth connections | Deleted on disconnect | Hard delete after Google revocation |
| Deleted accounts | 30 days after the deletion request | Full cascade purge |

## 9. Soft Delete Versus Hard Delete

| Use soft delete | Use hard delete |
| --- | --- |
| `users`, `workspaces`, `tasks`, `artifacts` | `sessions`, `oauth_connections`, `accessibility_profiles`, `consent_records` |
| Reason: a user-visible undo of deletion is plausible and cascade purges are expensive to do inline | Reason: these hold credentials, consent state, or settings where lingering rows are a liability |

Rules:

- A soft-deleted row is invisible to every read path. Add `deleted_at IS NULL` to every query, and prefer a shared query helper that adds it automatically.
- Soft delete is never a substitute for the retention purge. Every soft-deleted row is eventually hard deleted.
- Child tables of a soft-deleted parent do not need their own `deleted_at`. Parent invisibility is sufficient because every read enters through the parent.
- `audit_logs` is never soft deleted and never hard deleted by product code.

## 10. Database Per User

Recorded as a future option, not an MVP requirement.

| Aspect | Assessment |
| --- | --- |
| Benefit | Strong tenant isolation, simple per-tenant export and deletion |
| Cost | Per-tenant provisioning, migration fan-out, connection management, cross-tenant reporting becomes hard |
| Turso status | The shared multi-database schema feature is deprecated, so provisioning and migrating each tenant database would be application responsibility |
| MVP decision | Single shared database with row-level ownership scoping and a central data access layer |
| Migration path | Ownership columns are already denormalized onto every child table, so a per-tenant split would not require a schema redesign |

Do not build per-tenant provisioning during the competition window.

## 11. Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| DQ-1 | Which authentication library is chosen, and which of `users`, `accounts`, `sessions` does it own versus Aksa? Reconcile before the first migration. | Sections 3.1 to 3.3 |
| DQ-2 | Encryption approach and key storage for `oauth_connections.refresh_token_ciphertext` in the Vercel deployment. Tracked as SQ-2 in `.agents/security.md`. | Section 3.7 |
| DQ-3 | Final retention values. Tracked as SQ-3 in `.agents/security.md`. | Section 8 |
| DQ-4 | Undo availability window duration and whether it survives a reload. Tracked as OQ-6 in `.agents/prd.md`. | Sections 3.15 and 7 |
| DQ-5 | Maximum stored size for `undo_records.reverse_payload` before Undo is declared unsupported for a large edit. | Section 3.15 |
| DQ-6 | Whether `activity_events.label` stores a localization key or pre-rendered text per locale. | Section 3.13 |
| DQ-7 | Whether guest or demo accounts exist and how their rows expire. Tracked as OQ-9 in `.agents/prd.md`. | Sections 3.1 and 8 |
| DQ-8 | Whether `provider_usage` needs a pre-aggregated daily table for budget checks, or whether direct aggregation is fast enough at demo scale. | Section 3.16 |
