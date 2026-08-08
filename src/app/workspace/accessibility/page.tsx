import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { authGateway } from "@/lib/server/auth/service";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { AccessibilityPreferences } from "@/components/workspace/controls-settings";

export default async function AccessibilityPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const profile = await authGateway().readAccessibilityProfile();

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.a11y_page_heading({}, options)}
        intro={m.a11y_page_intro({}, options)}
      />

      <Panel heading={m.a11y_fallback_heading({}, options)} locale={locale}>
        <p>{m.a11y_fallback_body({}, options)}</p>
      </Panel>

      <Panel heading={m.a11y_motion_heading({}, options)} locale={locale}>
        <p>{m.a11y_motion_body({}, options)}</p>
        <AccessibilityPreferences initialProfile={profile} locale={locale} />
      </Panel>
    </div>
  );
}
