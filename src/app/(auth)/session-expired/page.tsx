import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { createAksaError } from "@/lib/contracts/errors";
import { BlockedState } from "@/components/workspace/state-panel";

export default async function SessionExpiredPage() {
  const locale = await getRequestLocale();
  const options = { locale };

  return (
    <section className="aksa-auth-card">
      <h1 className="aksa-auth-card__heading">{m.auth_session_expired_heading({}, options)}</h1>
      <p className="aksa-auth-card__intro">{m.auth_session_expired_intro({}, options)}</p>

      <BlockedState error={createAksaError("session_expired")} locale={locale} />

      <div className="aksa-auth-card__links">
        <Link className="aksa-link" href="/sign-in">
          {m.auth_submit_sign_in({}, options)}
        </Link>
      </div>
    </section>
  );
}
