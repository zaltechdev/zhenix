"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const buttonHostRef = useRef<HTMLDivElement>(null);
  const options = { locale };
  const authClient = useMemo(
    () => (clientId ? createGoogleAuthClient(clientId) : null),
    [clientId]
  );

  useEffect(() => {
    const buttonHost = buttonHostRef.current;
    if (!authClient || !buttonHost) return;

    let cancelled = false;
    buttonHost.replaceChildren();
    setFailed(false);
    setPending(true);

    const renderTimer = window.setTimeout(() => {
      void authClient.oneTap({
        autoSelect: false,
        callbackURL: mode === "sign_up" ? "/onboarding" : "/workspace",
        context: mode === "sign_up" ? "signup" : "signin",
        button: {
          container: buttonHost,
          config: {
            type: "standard",
            locale,
            logo_alignment: "left",
            shape: "rectangular",
            size: "large",
            text: "continue_with",
            theme: "outline",
            width: 400
          }
        }
        })
        .then(() => {
          if (!cancelled) setPending(false);
        })
        .catch(() => {
          if (cancelled) return;
          setFailed(true);
          setPending(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(renderTimer);
      buttonHost.replaceChildren();
    };
  }, [authClient, locale, mode]);

  return (
    <div className="aksa-oauth-section">
      {authClient && !failed ? (
        <div
          aria-busy={pending}
          className="aksa-google-button-host"
          ref={buttonHostRef}
        />
      ) : (
        <Button
          aria-describedby="google-sign-in-status"
          className="aksa-oauth-button"
          disabled
          size="md"
          type="button"
          variant="secondary"
        >
          <SiGoogle aria-hidden="true" className="aksa-oauth-icon" size={20} />
          {m.auth_continue_google({}, options)}
        </Button>
      )}
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
