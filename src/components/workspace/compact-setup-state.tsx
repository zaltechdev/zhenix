import Link from "next/link";
import { Info } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";

export function CompactSetupState({
  session,
  locale
}: {
  session: SessionState;
  connection?: GoogleConnection;
  locale: Locale;
}) {
  const options = { locale };
  const needsAccount = session.status !== "authenticated";

  if (!needsAccount) {
    return null;
  }

  return (
    <aside aria-label={m.home_anon_notice_text({}, options)} className="aksa-message-bar">
      <div className="aksa-message-bar__content">
        <Info aria-hidden="true" className="aksa-icon aksa-message-bar__icon" />
        <span className="aksa-message-bar__text">
          {m.home_anon_notice_text({}, options)}
        </span>
      </div>

      <div className="aksa-message-bar__action">
        <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/sign-in">
          {m.home_anon_notice_action({}, options)}
        </Link>
      </div>
    </aside>
  );
}
