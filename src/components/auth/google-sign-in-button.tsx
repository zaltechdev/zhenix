"use client";

import { useMemo, useState } from "react";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { createGoogleAuthClient } from "@/lib/client/auth/auth-client";
import { Button } from "@/components/shared/button";

export function GoogleSignInButton({
  clientId,
  locale,
  mode
}: {
  clientId?: string | null;
  locale: Locale;
  mode: "sign_in" | "sign_up";
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const options = { locale };
  const authClient = useMemo(
    () => (clientId ? createGoogleAuthClient(clientId) : null),
    [clientId]
  );

  async function openGoogleDialog() {
    if (!authClient || pending) return;

    setFailed(false);
    setPending(true);

    let promptClosed = false;
    try {
      await authClient.oneTap({
        autoSelect: false,
        callbackURL: "/api/google/auth?returnTo=/onboarding",
        context: mode === "sign_up" ? "signup" : "signin",
        uxMode: "popup",
        onPromptNotification: () => {
          promptClosed = true;
          setFailed(true);
          setPending(false);
        }
      });
      if (!promptClosed) setPending(false);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="aksa-oauth-section">
      <Button
        aria-describedby={!authClient || failed ? "google-sign-in-status" : undefined}
        aria-haspopup="dialog"
        className="aksa-oauth-button"
        disabled={!authClient || pending}
        loading={pending}
        onClick={openGoogleDialog}
        size="lg"
        type="button"
        variant="primary"
      >
        <SiGoogle aria-hidden="true" className="aksa-oauth-icon" size={20} />
        {pending
          ? m.auth_google_signing_in({}, options)
          : m.auth_continue_google({}, options)}
      </Button>
      {!authClient || failed ? (
        <p className="aksa-hint" id="google-sign-in-status" role={failed ? "alert" : undefined}>
          {failed
            ? m.auth_google_failed({}, options)
            : m.auth_google_unavailable({}, options)}
        </p>
      ) : null}
    </div>
  );
}
