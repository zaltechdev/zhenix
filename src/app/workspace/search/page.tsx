import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { StatePanel } from "@/components/workspace/state-panel";

export default async function SearchPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.search_heading({}, options)} intro={m.search_intro({}, options)} />

      <Panel heading={m.search_artifact_heading({}, options)} locale={locale}>
        <StatePanel
          body={m.search_unavailable({}, options)}
          statusLabel={m.capability_state_unavailable({}, options)}
          tone="neutral"
        />
      </Panel>
    </div>
  );
}
