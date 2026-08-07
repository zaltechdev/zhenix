"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { PASSWORD_MIN_LENGTH, type AuthFieldError, type AuthResult } from "@/lib/contracts/auth";
import { BlockedState } from "@/components/workspace/state-panel";
import { createAksaError } from "@/lib/contracts/errors";
import { Button } from "@/components/shared/button";
import { Divider } from "@/components/shared/divider";
import { FormField } from "@/components/shared/form-field";
import { TextInput } from "@/components/shared/text-input";

type Mode = "sign_in" | "sign_up";

function fieldErrorCopy(error: AuthFieldError, locale: Locale): string {
  const options = { locale };
  switch (error.messageKey) {
    case "auth_field_email_invalid":
      return m.auth_field_email_invalid({}, options);
    case "auth_field_password_short":
      return m.auth_field_password_short({ min: String(PASSWORD_MIN_LENGTH) }, options);
    default:
      return m.auth_field_form_invalid({}, options);
  }
}

export function AuthForm({
  mode,
  locale,
  action,
  notice,
  links,
  workspaceNote
}: {
  mode: Mode;
  locale: Locale;
  action: (previous: AuthResult | null, formData: FormData) => Promise<AuthResult>;
  notice?: React.ReactNode;
  links?: React.ReactNode;
  workspaceNote?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(action, null);
  const [googleState, setGoogleState] = useState<AuthResult | null>(null);

  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const options = { locale };

  const fieldErrors = state?.outcome === "invalid_input" ? state.fieldErrors : [];
  const emailError = fieldErrors.find((error) => error.field === "email") ?? null;
  const passwordError = fieldErrors.find((error) => error.field === "password") ?? null;

  useEffect(() => {
    if (fieldErrors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [fieldErrors.length]);

  function handleGoogleClick() {
    // Honest boundary status when OAuth backend is unconfigured
    setGoogleState({
      outcome: "unavailable",
      error: createAksaError("not_configured")
    });
  }

  return (
    <div className="aksa-auth-form-wrapper">
      <div className="aksa-oauth-section">
        <Button className="aksa-oauth-button" onClick={handleGoogleClick} size="md" type="button" variant="primary">
          <SiGoogle aria-hidden="true" className="aksa-oauth-icon" size={18} />
          <span>{m.auth_continue_google({}, options)}</span>
        </Button>
      </div>

      <Divider label={m.auth_or({}, options)} />

      {googleState !== null && (googleState.outcome === "unavailable" || googleState.outcome === "rejected") ? (
        <BlockedState error={googleState.error} locale={locale} />
      ) : null}

      <form action={formAction} className="aksa-auth-form" noValidate>
        <input name="locale" type="hidden" value={locale} />

        {fieldErrors.length > 0 ? (
          <div
            className="aksa-error-summary"
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
          >
            <h2 className="aksa-error-summary__heading">
              {m.auth_error_summary_heading({}, options)}
            </h2>
            <ul>
              {fieldErrors.map((error) => (
                <li key={`${error.field}-${error.messageKey}`}>{fieldErrorCopy(error, locale)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {mode === "sign_up" ? (
          <FormField
            controlId={nameId}
            label={
              <>
                {m.auth_display_name_label({}, options)}
                <span className="aksa-label__optional">
                  {m.auth_display_name_optional({}, options)}
                </span>
              </>
            }
          >
            <TextInput
              autoComplete="name"
              name="displayName"
              placeholder={m.auth_display_name_placeholder({}, options)}
              type="text"
            />
          </FormField>
        ) : null}

        <FormField controlId={emailId} label={m.auth_email_label({}, options)} error={emailError ? fieldErrorCopy(emailError, locale) : undefined} required>
          <TextInput
            autoComplete="email"
            name="email"
            placeholder={m.auth_email_placeholder({}, options)}
            required
            type="email"
          />
        </FormField>

        <FormField
          controlId={passwordId}
          description={mode === "sign_up" ? m.auth_password_requirement({ min: String(PASSWORD_MIN_LENGTH) }, options) : undefined}
          error={passwordError ? fieldErrorCopy(passwordError, locale) : undefined}
          label={m.auth_password_label({}, options)}
          required
        >
          <TextInput
            autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
            minLength={PASSWORD_MIN_LENGTH}
            name="password"
            placeholder={m.auth_password_placeholder({}, options)}
            required
            type="password"
          />
        </FormField>

        <Button disabled={pending} loading={pending} size="md" type="submit" variant="secondary">
          {pending
            ? m.auth_submitting({}, options)
            : mode === "sign_up"
              ? m.auth_submit_sign_up({}, options)
              : m.auth_submit_sign_in({}, options)}
        </Button>

        {state !== null && (state.outcome === "unavailable" || state.outcome === "rejected") ? (
          <BlockedState error={state.error} locale={locale} />
        ) : null}

        {links}

        {workspaceNote}

        {notice ? <p className="aksa-auth-tos aksa-auth-tos--inline">{notice}</p> : null}
      </form>
    </div>
  );
}
