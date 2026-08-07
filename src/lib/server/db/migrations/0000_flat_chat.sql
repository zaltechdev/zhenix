CREATE TABLE `accessibility_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pointer_sensitivity` integer DEFAULT 50 NOT NULL,
	`dead_zone` integer DEFAULT 20 NOT NULL,
	`smoothing` integer DEFAULT 40 NOT NULL,
	`selection_mode` text DEFAULT 'dwell' NOT NULL,
	`dwell_duration_ms` integer DEFAULT 1200,
	`gesture_type` text,
	`gesture_threshold` integer,
	`gesture_cooldown_ms` integer,
	`reduced_motion` integer DEFAULT 0 NOT NULL,
	`calibrated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accessibility_profiles_user_id_unique` ON `accessibility_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_accessibility_profiles_user_id` ON `accessibility_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounts_provider_account` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_id` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`label` text NOT NULL,
	`affected_items` text,
	`tool_call_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_call_id`) REFERENCES `tool_calls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activity_events_seq` ON `activity_events` (`task_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `artifact_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`position` integer NOT NULL,
	`source_type` text,
	`title` text NOT NULL,
	`url` text,
	`domain` text,
	`snippet` text,
	`retrieved_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_artifact_sources_pos` ON `artifact_sources` (`artifact_id`,`position`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`body_format` text,
	`language` text,
	`provider` text,
	`retrieved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_user_workspace_created` ON `artifacts` (`user_id`,`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`workspace_id` text,
	`event_type` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`detail` text,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_created` ON `audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`action_key` text NOT NULL,
	`action_summary` text NOT NULL,
	`scope_items` text NOT NULL,
	`changes_external_data` integer DEFAULT 0,
	`undo_supported` integer DEFAULT 0,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL,
	`answered_at` integer,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_confirmations_task_state` ON `confirmations` (`task_id`,`state`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`consent_type` text NOT NULL,
	`granted` integer NOT NULL,
	`policy_version` text NOT NULL,
	`granted_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_consent_records_user_type` ON `consent_records` (`user_id`,`consent_type`);--> statement-breakpoint
CREATE TABLE `oauth_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text,
	`provider_email` text,
	`refresh_token_ciphertext` text,
	`refresh_token_key_version` integer DEFAULT 1,
	`granted_scopes` text,
	`status` text NOT NULL,
	`last_verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_conn_user_provider` ON `oauth_connections` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `provider_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`task_id` text,
	`provider` text,
	`model` text,
	`operation` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_micros` integer,
	`latency_ms` integer,
	`outcome` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`fallback_used` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_provider_usage_user_created` ON `provider_usage` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `task_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`label` text NOT NULL,
	`state` text NOT NULL,
	`requires_confirmation` integer DEFAULT 0,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_steps_task_seq` ON `task_steps` (`task_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`input_mode` text,
	`command_text` text NOT NULL,
	`intent` text,
	`state` text NOT NULL,
	`result_summary` text,
	`error_category` text,
	`items_total` integer,
	`items_completed` integer,
	`idempotency_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_user_idempotency` ON `tasks` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_workspace_created` ON `tasks` (`user_id`,`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_step_id` text,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`tool_kind` text,
	`arguments_summary` text,
	`outcome` text,
	`error_category` text,
	`affected_item_count` integer,
	`verified` integer DEFAULT 0,
	`duration_ms` integer,
	`confirmation_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_step_id`) REFERENCES `task_steps`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tool_calls_task_created` ON `tool_calls` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `undo_records` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`undo_kind` text NOT NULL,
	`reverse_payload` text NOT NULL,
	`state` text NOT NULL,
	`items_total` integer NOT NULL,
	`items_reverted` integer,
	`expires_at` integer NOT NULL,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_call_id`) REFERENCES `tool_calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_undo_records_tool_call` ON `undo_records` (`tool_call_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text,
	`image_url` text,
	`default_workspace_id` text,
	`locale` text DEFAULT 'en',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_members_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`locale` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner_deleted` ON `workspaces` (`owner_user_id`,`deleted_at`);