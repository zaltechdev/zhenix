"use client";

import { useId, useState, type FormEvent } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/contracts/auth";
import { Button } from "@/components/shared/button";
import { FormField } from "@/components/shared/form-field";
import { TextInput } from "@/components/shared/text-input";

type ResetState = "idle" | "short" | "mismatch" | "complete";

export function DemoPasswordResetForm({
  newPasswordLabel,
  confirmLabel,
  passwordRequirement,
  shortMessage,
  mismatchMessage,
  submitLabel,
  successMessage
}: {
  newPasswordLabel: string;
  confirmLabel: string;
  passwordRequirement: string;
  shortMessage: string;
  mismatchMessage: string;
  submitLabel: string;
  successMessage: string;
}) {
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [state, setState] = useState<ResetState>("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setState("short");
      return;
    }
    if (newPassword !== confirmPassword) {
      setState("mismatch");
      return;
    }
    setState("complete");
    event.currentTarget.reset();
  }

  const error = state === "short" ? shortMessage : state === "mismatch" ? mismatchMessage : undefined;

  return (
    <form className="aksa-auth-form" noValidate onSubmit={handleSubmit}>
      <FormField
        controlId={newPasswordId}
        description={passwordRequirement}
        error={error}
        label={newPasswordLabel}
        required
      >
        <TextInput
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          name="newPassword"
          required
          type="password"
        />
      </FormField>
      <FormField controlId={confirmPasswordId} label={confirmLabel} required>
        <TextInput
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          name="confirmPassword"
          required
          type="password"
        />
      </FormField>
      <Button size="md" type="submit" variant="secondary">
        {submitLabel}
      </Button>
      {state === "complete" ? <p className="aksa-hint" role="status">{successMessage}</p> : null}
    </form>
  );
}
