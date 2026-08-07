import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { readTaskHistory } from "@/lib/server/tasks/service";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { TaskList } from "@/components/workspace/task-list";

export default async function HistoryPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const state = await readTaskHistory();

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.history_heading({}, options)} intro={m.history_intro({}, options)} />

      <Panel heading={m.history_list_label({}, options)} locale={locale}>
        <SurfaceState locale={locale} state={state}>
          {(data) => <TaskList locale={locale} tasks={data.tasks} />}
        </SurfaceState>
      </Panel>
    </div>
  );
}
