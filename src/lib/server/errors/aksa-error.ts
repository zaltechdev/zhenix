import { createAksaError, type AksaError } from "@/lib/contracts/errors";

/**
 * Server-side error helpers.
 *
 * The factory itself lives in the contracts layer so the browser can also build a
 * well-formed error. These helpers name the cases the server boundary returns most.
 */
export { createAksaError };

export function notConfiguredError(): AksaError {
  return createAksaError("not_configured");
}

export function connectionRequiredError(): AksaError {
  return createAksaError("connection_required");
}

export function authenticationRequiredError(): AksaError {
  return createAksaError("authentication_required");
}

export function authFailedError(): AksaError {
  return createAksaError("authentication_required");
}

export function validationFailedError(): AksaError {
  return createAksaError("validation_failed");
}
