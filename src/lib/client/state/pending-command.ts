/**
 * Handoff for the command typed during onboarding.
 *
 * Per tab only, so the copy shown to the user stays accurate. The composer reads it
 * once and clears it. The command is only placed in the box; it never runs.
 */
export const PENDING_COMMAND_STORAGE_KEY = "aksa-pending-command";

export function takePendingCommand(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(PENDING_COMMAND_STORAGE_KEY);
  if (value === null) {
    return null;
  }

  window.sessionStorage.removeItem(PENDING_COMMAND_STORAGE_KEY);
  return value.trim() === "" ? null : value;
}
