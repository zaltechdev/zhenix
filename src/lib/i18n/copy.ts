import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { ErrorCategory, NextAction } from "@/lib/contracts/errors";
import type { CapabilityAvailability, CapabilityName } from "@/lib/contracts/capability";
import type { EmptyReason } from "@/lib/contracts/resource-state";
import type { TaskState } from "@/lib/contracts/task";
import type { ActivityEventType } from "@/lib/contracts/activity";
import type { ConfirmationAction, ExternalSystem } from "@/lib/contracts/confirmation";
import type { UndoState } from "@/lib/contracts/undo";
import type { ExampleCommandKey } from "@/lib/contracts/command";
import type { GoogleConnectionState } from "@/lib/contracts/google";

/**
 * Contract enum to localized copy.
 *
 * Every mapping is an exhaustive switch, so adding a contract value without copy
 * is a type error rather than an untranslated string in the interface. No sentence
 * here is built by concatenating fragments.
 */

export function errorCopy(category: ErrorCategory, locale: Locale): string {
  const options = { locale };
  switch (category) {
    case "not_configured":
      return m.error_not_configured({}, options);
    case "connection_required":
      return m.error_connection_required({}, options);
    case "scope_required":
      return m.error_scope_required({}, options);
    case "authentication_required":
      return m.error_authentication_required({}, options);
    case "session_expired":
      return m.error_session_expired({}, options);
    case "permission_denied":
      return m.error_permission_denied({}, options);
    case "not_found":
      return m.error_not_found({}, options);
    case "unsupported":
      return m.error_unsupported({}, options);
    case "unavailable":
      return m.error_unavailable({}, options);
    case "rate_limited":
      return m.error_rate_limited({}, options);
    case "timeout":
      return m.error_timeout({}, options);
    case "validation_failed":
      return m.error_validation_failed({}, options);
    case "verification_failed":
      return m.error_verification_failed({}, options);
    case "partial_failure":
      return m.error_partial_failure({}, options);
    case "cancelled":
      return m.error_cancelled({}, options);
    case "undo_unavailable":
      return m.error_undo_unavailable({}, options);
    case "internal_error":
      return m.error_internal_error({}, options);
  }
}

/** Compact status label. Never derived by splitting a translated sentence. */
export function errorShortCopy(category: ErrorCategory, locale: Locale): string {
  const options = { locale };
  switch (category) {
    case "not_configured":
      return m.error_short_not_configured({}, options);
    case "connection_required":
      return m.error_short_connection_required({}, options);
    case "scope_required":
      return m.error_short_scope_required({}, options);
    case "authentication_required":
      return m.error_short_authentication_required({}, options);
    case "session_expired":
      return m.error_short_session_expired({}, options);
    case "permission_denied":
      return m.error_short_permission_denied({}, options);
    case "not_found":
      return m.error_short_not_found({}, options);
    case "unsupported":
      return m.error_short_unsupported({}, options);
    case "unavailable":
      return m.error_short_unavailable({}, options);
    case "rate_limited":
      return m.error_short_rate_limited({}, options);
    case "timeout":
      return m.error_short_timeout({}, options);
    case "validation_failed":
      return m.error_short_validation_failed({}, options);
    case "verification_failed":
      return m.error_short_verification_failed({}, options);
    case "partial_failure":
      return m.error_short_partial_failure({}, options);
    case "cancelled":
      return m.error_short_cancelled({}, options);
    case "undo_unavailable":
      return m.error_short_undo_unavailable({}, options);
    case "internal_error":
      return m.error_short_internal_error({}, options);
  }
}

export function nextActionCopy(action: NextAction, locale: Locale): string | null {
  const options = { locale };
  switch (action) {
    case "retry":
      return m.action_retry({}, options);
    case "sign_in":
      return m.action_sign_in({}, options);
    case "connect_google":
      return m.action_connect_google({}, options);
    case "grant_capability":
      return m.action_grant_capability({}, options);
    case "narrow_scope":
      return m.action_narrow_scope({}, options);
    case "wait_and_retry":
      return m.action_wait_and_retry({}, options);
    case "use_text_input":
      return m.action_use_text_input({}, options);
    case "use_keyboard":
      return m.action_use_keyboard({}, options);
    case "configure_deployment":
      return m.action_configure_deployment({}, options);
    case "cancel_task":
      return m.action_cancel_task({}, options);
    case "none":
      return null;
  }
}

export function capabilityCopy(name: CapabilityName, locale: Locale): string {
  const options = { locale };
  switch (name) {
    case "account_session":
      return m.capability_account_session({}, options);
    case "settings_persistence":
      return m.capability_settings_persistence({}, options);
    case "agent_execution":
      return m.capability_agent_execution({}, options);
    case "voice_input":
      return m.capability_voice_input({}, options);
    case "camera_input":
      return m.capability_camera_input({}, options);
    case "head_pointer":
      return m.capability_head_pointer({}, options);
    case "grounded_search":
      return m.capability_grounded_search({}, options);
    case "drive_read":
      return m.capability_drive_read({}, options);
    case "drive_write":
      return m.capability_drive_write({}, options);
    case "drive_picker":
      return m.capability_drive_picker({}, options);
    case "docs_read":
      return m.capability_docs_read({}, options);
    case "docs_write":
      return m.capability_docs_write({}, options);
    case "sheets_read":
      return m.capability_sheets_read({}, options);
    case "sheets_write":
      return m.capability_sheets_write({}, options);
    case "gmail_read":
      return m.capability_gmail_read({}, options);
    case "gmail_compose":
      return m.capability_gmail_compose({}, options);
  }
}

export function capabilityStateCopy(
  availability: CapabilityAvailability,
  locale: Locale
): string {
  const options = { locale };
  switch (availability) {
    case "available":
      return m.capability_state_available({}, options);
    case "connection_required":
      return m.capability_state_connection_required({}, options);
    case "scope_required":
      return m.capability_state_scope_required({}, options);
    case "not_configured":
      return m.capability_state_not_configured({}, options);
    case "unsupported":
      return m.capability_state_unsupported({}, options);
    case "unavailable":
      return m.capability_state_unavailable({}, options);
  }
}

export function emptyReasonCopy(reason: EmptyReason, locale: Locale): string {
  const options = { locale };
  switch (reason) {
    case "no_items":
      return m.empty_no_items({}, options);
    case "no_results":
      return m.empty_no_results({}, options);
    case "no_reliable_source":
      return m.empty_no_reliable_source({}, options);
    case "no_recent_messages":
      return m.empty_no_recent_messages({}, options);
    case "no_tasks":
      return m.empty_no_tasks({}, options);
    case "no_activity":
      return m.empty_no_activity({}, options);
    case "nothing_selected":
      return m.empty_nothing_selected({}, options);
  }
}

export type TaskStateCopyInput = {
  state: TaskState;
  title?: string;
  completed?: number;
  remaining?: number;
};

export function taskStateCopy(input: TaskStateCopyInput, locale: Locale): string {
  const options = { locale };
  switch (input.state) {
    case "idle":
      return m.task_state_idle({}, options);
    case "listening":
      return m.task_state_listening({}, options);
    case "transcribing":
      return m.task_state_transcribing({}, options);
    case "understanding":
      return m.task_state_understanding({}, options);
    case "executing":
      return m.task_state_executing({ title: input.title ?? "" }, options);
    case "waiting_for_confirmation":
      return m.task_state_waiting_for_confirmation({}, options);
    case "completed":
      return m.task_state_completed({}, options);
    case "partially_completed":
      return m.task_state_partially_completed(
        { completed: input.completed ?? 0, remaining: input.remaining ?? 0 },
        options
      );
    case "failed":
      return m.task_state_failed({}, options);
    case "cancelled":
      return m.task_state_cancelled({}, options);
    case "undo_available":
      return m.task_state_undo_available({}, options);
  }
}

export function taskStateAnnouncement(state: TaskState, locale: Locale): string | null {
  const options = { locale };
  switch (state) {
    case "idle":
      return null;
    case "listening":
      return m.announce_listening({}, options);
    case "transcribing":
      return m.announce_transcribing({}, options);
    case "understanding":
      return m.announce_understanding({}, options);
    case "executing":
      return m.announce_executing({}, options);
    case "waiting_for_confirmation":
      return m.announce_confirmation_required({}, options);
    case "completed":
      return m.announce_completed({}, options);
    case "partially_completed":
      return m.announce_partially_completed({}, options);
    case "failed":
      return m.announce_failed({}, options);
    case "cancelled":
      return m.announce_cancelled({}, options);
    case "undo_available":
      return m.announce_undo_available({}, options);
  }
}

/** Assertive announcements are reserved for confirmation and failure. */
export function isAssertiveState(state: TaskState): boolean {
  return state === "waiting_for_confirmation" || state === "failed";
}

export function activityEventCopy(eventType: ActivityEventType, locale: Locale): string {
  const options = { locale };
  switch (eventType) {
    case "task_started":
      return m.activity_event_task_started({}, options);
    case "step_started":
      return m.activity_event_step_started({}, options);
    case "step_succeeded":
      return m.activity_event_step_succeeded({}, options);
    case "step_failed":
      return m.activity_event_step_failed({}, options);
    case "step_skipped":
      return m.activity_event_step_skipped({}, options);
    case "confirmation_requested":
      return m.activity_event_confirmation_requested({}, options);
    case "confirmation_approved":
      return m.activity_event_confirmation_approved({}, options);
    case "confirmation_edited":
      return m.activity_event_confirmation_edited({}, options);
    case "confirmation_cancelled":
      return m.activity_event_confirmation_cancelled({}, options);
    case "confirmation_expired":
      return m.activity_event_confirmation_expired({}, options);
    case "task_completed":
      return m.activity_event_task_completed({}, options);
    case "task_partially_completed":
      return m.activity_event_task_partially_completed({}, options);
    case "task_failed":
      return m.activity_event_task_failed({}, options);
    case "task_cancelled":
      return m.activity_event_task_cancelled({}, options);
    case "undo_requested":
      return m.activity_event_undo_requested({}, options);
    case "undo_completed":
      return m.activity_event_undo_completed({}, options);
    case "undo_failed":
      return m.activity_event_undo_failed({}, options);
  }
}

export function activityActionCopy(label: string, locale: Locale): string {
  const options = { locale };
  switch (label) {
    case "documents_activity_read":
      return m.documents_activity_read({}, options);
    case "documents_activity_review":
      return m.documents_activity_review({}, options);
    case "documents_activity_write":
      return m.documents_activity_write({}, options);
    case "documents_activity_verify":
      return m.documents_activity_verify({}, options);
    default:
      return label;
  }
}

export function confirmationActionCopy(action: ConfirmationAction, locale: Locale): string {
  const options = { locale };
  switch (action) {
    case "drive_move":
      return m.confirmation_action_drive_move({}, options);
    case "drive_rename":
      return m.confirmation_action_drive_rename({}, options);
    case "drive_create_folder":
      return m.confirmation_action_drive_create_folder({}, options);
    case "docs_apply_edit":
      return m.confirmation_action_docs_apply_edit({}, options);
    case "sheets_write_range":
      return m.confirmation_action_sheets_write_range({}, options);
    case "gmail_create_draft":
      return m.confirmation_action_gmail_create_draft({}, options);
  }
}

export function externalSystemCopy(system: ExternalSystem, locale: Locale): string {
  const options = { locale };
  switch (system) {
    case "google_drive":
      return m.external_system_google_drive({}, options);
    case "google_docs":
      return m.external_system_google_docs({}, options);
    case "google_sheets":
      return m.external_system_google_sheets({}, options);
    case "gmail":
      return m.external_system_gmail({}, options);
    case "aksa_only":
      return m.external_system_aksa_only({}, options);
  }
}

export function undoStateCopy(state: UndoState, locale: Locale): string {
  const options = { locale };
  switch (state) {
    case "available":
      return m.undo_state_available({}, options);
    case "running":
      return m.undo_state_running({}, options);
    case "completed":
      return m.undo_state_completed({}, options);
    case "partially_completed":
      return m.undo_state_partially_completed({}, options);
    case "failed":
      return m.undo_state_failed({}, options);
    case "unavailable":
      return m.undo_state_unavailable({}, options);
    case "expired":
      return m.undo_state_expired({}, options);
  }
}

export function undoReasonCopy(reasonKey: string, locale: Locale): string {
  const options = { locale };
  switch (reasonKey) {
    case "undo_reason_folder_create":
      return m.undo_reason_folder_create({}, options);
    case "undo_reason_not_captured":
      return m.undo_reason_not_captured({}, options);
    default:
      return m.undo_reason_no_execution({}, options);
  }
}

export function googleConnectionCopy(state: GoogleConnectionState, locale: Locale): string {
  const options = { locale };
  switch (state) {
    case "not_connected":
      return m.google_state_not_connected({}, options);
    case "connecting":
      return m.google_state_connecting({}, options);
    case "connected":
      return m.google_state_connected({}, options);
    case "needs_reconnect":
      return m.google_state_needs_reconnect({}, options);
    case "revoked":
      return m.google_state_revoked({}, options);
    case "disconnecting":
      return m.google_state_disconnecting({}, options);
    case "error":
      return m.google_state_error({}, options);
  }
}

export function exampleCommandCopy(key: ExampleCommandKey, locale: Locale): string {
  const options = { locale };
  switch (key) {
    case "open_latest_assignment":
      return m.example_open_latest_assignment({}, options);
    case "find_project_files":
      return m.example_find_project_files({}, options);
    case "summarize_document":
      return m.example_summarize_document({}, options);
    case "read_sheet_range":
      return m.example_read_sheet_range({}, options);
    case "search_with_sources":
      return m.example_search_with_sources({}, options);
  }
}

/**
 * UTC formatting keeps server and client output identical, so a localized date
 * cannot cause a hydration mismatch.
 */
export function formatDateTime(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(timestamp)
  );
}

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatFileSize(bytes: number, locale: Locale): string {
  const units: Intl.NumberFormatOptions["unit"][] = ["byte", "kilobyte", "megabyte", "gigabyte"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[unitIndex],
    unitDisplay: "short",
    maximumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0
  }).format(value);
}
