import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { MailSurface } from "@/components/workspace/mail-surface";
import { createPreviewMailInbox } from "@/lib/preview/workspace";

export default async function MailPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const inbox = createPreviewMailInbox(locale);

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.mail_heading({}, options)}
        intro={m.mail_intro({}, options)}
        locale={locale}
        mode="preview"
      />
      <MailSurface inbox={inbox} locale={locale} preview />
    </div>
  );
}
