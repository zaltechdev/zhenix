import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleGateway } from "@/lib/server/google/service";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { MailSurface } from "@/components/workspace/mail-surface";

export default async function MailPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const state = await googleGateway().listRecentMail();

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.mail_heading({}, options)} intro={m.mail_intro({}, options)} />

      <SurfaceState locale={locale} state={state}>
        {(inbox) => <MailSurface inbox={inbox} locale={locale} />}
      </SurfaceState>
    </div>
  );
}
