"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/contracts/auth";
import { Button } from "@/components/shared/button";
import { FormField } from "@/components/shared/form-field";
import { TextInput } from "@/components/shared/text-input";

type ResetState =
  | "idle"
  | "submitting"
  | "invalid_email"
  | "short"
  | "mismatch"
  | "not_found"
  | "server_error"
  | "complete";

export function DemoPasswordResetForm({
  emailLabel,
  emailPlaceholder = "you@example.com",
  emailInvalidMessage,
  newPasswordLabel,
  confirmLabel,
  passwordRequirement,
  shortMessage,
  mismatchMessage,
  notFoundMessage = "No account found with this email address.",
  failedMessage = "Unable to update password. Please try again.",
  submitLabel,
  successMessage,
  signInActionLabel = "Sign in with new password"
}: {
  emailLabel: string;
  emailPlaceholder?: string;
  emailInvalidMessage: string;
  newPasswordLabel: string;
  confirmLabel: string;
  passwordRequirement: string;
  shortMessage: string;
  mismatchMessage: string;
  notFoundMessage?: string;
  failedMessage?: string;
  submitLabel: string;
  successMessage: string;
  signInActionLabel?: string;
}) {
  const emailId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [state, setState] = useState<ResetState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!email || !email.includes("@")) {
      setState("invalid_email");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setState("short");
      return;
    }
    if (newPassword !== confirmPassword) {
      setState("mismatch");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, newPassword })
      });

      if (res.ok) {
        setState("complete");
        return;
      }

      if (res.status === 404) {
        setState("not_found");
        return;
      }

      setState("server_error");
    } catch {
      setState("server_error");
    }
  }

  const error =
    state === "invalid_email"
      ? emailInvalidMessage
      : state === "not_found"
        ? notFoundMessage
        : state === "short"
          ? shortMessage
          : state === "mismatch"
            ? mismatchMessage
            : state === "server_error"
              ? failedMessage
              : undefined;

  return (
    <form className="aksa-auth-form" noValidate onSubmit={(e) => void handleSubmit(e)}>
      {state === "complete" ? (
        <div className="aksa-auth-success-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p className="aksa-hint" role="status" style={{ color: "var(--color-aksa-teal)", fontWeight: 600 }}>
            {successMessage}
          </p>
          <Link className="aksa-button aksa-button--primary" href="/sign-in" style={{ textAlign: "center" }}>
            {signInActionLabel}
          </Link>
        </div>
      ) : (
        <>
          <FormField
            controlId={emailId}
            error={state === "invalid_email" || state === "not_found" ? error : undefined}
            label={emailLabel}
            required
          >
            <TextInput
              autoComplete="email"
              disabled={state === "submitting"}
              name="email"
              placeholder={emailPlaceholder}
              required
              type="email"
            />
          </FormField>
          <FormField
            controlId={newPasswordId}
            description={passwordRequirement}
            error={state === "short" || state === "mismatch" ? error : undefined}
            label={newPasswordLabel}
            required
          >
            <TextInput
              autoComplete="new-password"
              disabled={state === "submitting"}
              minLength={PASSWORD_MIN_LENGTH}
              name="newPassword"
              required
              type="password"
            />
          </FormField>
          <FormField controlId={confirmPasswordId} label={confirmLabel} required>
            <TextInput
              autoComplete="new-password"
              disabled={state === "submitting"}
              minLength={PASSWORD_MIN_LENGTH}
              name="confirmPassword"
              required
              type="password"
            />
          </FormField>
          {state === "server_error" ? (
            <p className="aksa-error" role="alert">{failedMessage}</p>
          ) : null}
          <Button disabled={state === "submitting"} size="md" type="submit" variant="secondary">
            {state === "submitting" ? "..." : submitLabel}
          </Button>
        </>
      )}
    </form>
  );
}
