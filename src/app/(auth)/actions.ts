"use server";

import {
  PASSWORD_MIN_LENGTH,
  signInInputSchema,
  signUpInputSchema,
  type AuthFieldError,
  type AuthResult
} from "@/lib/contracts/auth";
import { authGateway } from "@/lib/server/auth/service";

/**
 * Account form actions.
 *
 * A Server Action is the simplest correct boundary for a form mutation. Each action
 * is treated as a public endpoint: input is validated here before any other work, and
 * the authenticated caller is derived inside the gateway rather than from the form.
 */

function fieldErrorsFrom(paths: string[]): AuthFieldError[] {
  const errors: AuthFieldError[] = [];

  if (paths.includes("email")) {
    errors.push({ field: "email", messageKey: "auth_field_email_invalid" });
  }

  if (paths.includes("password")) {
    errors.push({ field: "password", messageKey: "auth_field_password_short" });
  }

  if (errors.length === 0) {
    errors.push({ field: "form", messageKey: "auth_field_form_invalid" });
  }

  return errors;
}

function readLocale(formData: FormData): "en" | "id" {
  return formData.get("locale") === "id" ? "id" : "en";
}

export async function signInAction(
  _previous: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: readLocale(formData)
  });

  if (!parsed.success) {
    return {
      outcome: "invalid_input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues.map((issue) => String(issue.path[0])))
    };
  }

  return authGateway().signIn(parsed.data);
}

export async function signUpAction(
  _previous: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const displayName = formData.get("displayName");

  const parsed = signUpInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: typeof displayName === "string" && displayName.trim() !== "" ? displayName : undefined,
    locale: readLocale(formData)
  });

  if (!parsed.success) {
    return {
      outcome: "invalid_input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues.map((issue) => String(issue.path[0])))
    };
  }

  return authGateway().signUp(parsed.data);
}

export async function passwordMinimumLength(): Promise<number> {
  return PASSWORD_MIN_LENGTH;
}
