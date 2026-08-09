import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { readSessionState } from "@/lib/server/auth/service";
import { createAksaError } from "@/lib/contracts/errors";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { BlockedState } from "@/components/workspace/state-panel";
import { StatusChip } from "@/components/workspace/status-chip";
import { signOutAction } from "@/app/(auth)/actions";

export default async function AccountPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const session = await readSessionState();

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.auth_account_heading({}, options)}
        intro={m.auth_account_intro({}, options)}
      />

      <Panel heading={m.workspace_session_label({}, options)} locale={locale}>
        {session.status === "authenticated" ? (
          <>
            <StatusChip
              label={m.workspace_session_label({}, options)}
              tone="ready"
              value={m.workspace_session_signed_in({ email: session.session.email }, options)}
            />
            <form action={signOutAction}>
              <button className="aksa-button aksa-button--secondary" type="submit">
                {m.auth_sign_out({}, options)}
              </button>
            </form>
          </>
        ) : (
          <>
            <BlockedState
              error={
                session.status === "unavailable"
                  ? session.error
                  : createAksaError(
                      session.status === "expired" ? "session_expired" : "authentication_required"
                    )
              }
              locale={locale}
            />
            <Link className="aksa-button aksa-button--secondary" href="/sign-in">
              {m.auth_submit_sign_in({}, options)}
            </Link>
          </>
        )}
      </Panel>
    </div>
  );
}
