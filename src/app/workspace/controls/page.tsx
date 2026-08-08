import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { authGateway } from "@/lib/server/auth/service";
import { HeadControlSettings, VoiceControlSettings } from "@/components/workspace/controls-settings";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";

export default async function ControlsPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const profile = await authGateway().readAccessibilityProfile();

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.controls_page_heading({}, options)}
        intro={m.controls_page_intro({}, options)}
      />

      <Panel
        description={m.controls_head_intro({}, options)}
        heading={m.controls_head_heading({}, options)}
        locale={locale}
      >
        <HeadControlSettings initialProfile={profile} locale={locale} />
      </Panel>

      <Panel
        description={m.controls_voice_intro({}, options)}
        heading={m.controls_voice_heading({}, options)}
        locale={locale}
      >
        <VoiceControlSettings locale={locale} />
      </Panel>
    </div>
  );
}
