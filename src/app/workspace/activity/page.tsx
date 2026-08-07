import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { readWorkspaceActivity } from "@/lib/server/activity/service";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { ActivityList } from "@/components/workspace/activity-list";

export default async function ActivityPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const state = await readWorkspaceActivity();

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.activity_heading({}, options)}
        intro={m.activity_intro({}, options)}
      />

      <Panel heading={m.activity_list_label({}, options)} locale={locale}>
        <SurfaceState locale={locale} state={state}>
          {(feed) => <ActivityList events={feed.events} locale={locale} />}
        </SurfaceState>
        <p className="aksa-hint">{m.activity_no_reasoning_note({}, options)}</p>
      </Panel>
    </div>
  );
}
