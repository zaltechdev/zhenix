"use client";

import { useState } from "react";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { authClient } from "@/lib/client/auth/auth-client";
import { Button } from "@/components/shared/button";

export function GoogleSignInButton({
  enabled,
  locale
}: {
  enabled: boolean;
  locale: Locale;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const options = { locale };

  async function signInWithGoogle() {
    if (!enabled || pending) return;

    setPending(true);
    setFailed(false);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/workspace",
      newUserCallbackURL: "/onboarding",
      errorCallbackURL: "/sign-in?oauth_error=google"
    });

    if (result.error) {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="aksa-oauth-section">
      <Button
        aria-describedby={!enabled || failed ? "google-sign-in-status" : undefined}
        className="aksa-oauth-button"
        disabled={!enabled}
        loading={pending}
        onClick={signInWithGoogle}
        size="md"
        type="button"
        variant="secondary"
      >
        <SiGoogle aria-hidden="true" className="aksa-oauth-icon" size={20} />
        {m.auth_continue_google({}, options)}
      </Button>
      {!enabled || failed ? (
        <p className="aksa-hint" id="google-sign-in-status" role={failed ? "alert" : undefined}>
          {failed
            ? m.auth_google_failed({}, options)
            : m.auth_google_unavailable({}, options)}
        </p>
      ) : null}
    </div>
  );
}
