import { getRequestLocale } from "@/lib/i18n/request";
import { m } from "@/paraglide/messages.js";
import { readTaskHistory } from "@/lib/server/tasks/service";
import { WelcomeHeader } from "@/components/workspace/welcome-header";
import { CommandComposer } from "@/components/workspace/command-composer";
import { QuickStartSuggestions } from "@/components/workspace/quick-start-suggestions";
import { RecentWorkColumn } from "@/components/workspace/recent-work-column";
import { GoogleWorkspaceLaunchpad } from "@/components/workspace/google-workspace-launchpad";

export default async function WorkspaceHomePage() {
  const locale = await getRequestLocale();
  const history = await readTaskHistory();

  const tasks =
    history.status === "ready" || history.status === "partial"
      ? history.data.tasks
      : [];

  return (
    <div className="aksa-home-dashboard">
      <WelcomeHeader locale={locale} />

      <div className="aksa-home-dashboard__composer-area">
        <CommandComposer inflow locale={locale} mode="welcome" />
        <p className="aksa-ai-disclaimer" role="note">
          {m.workspace_ai_disclaimer({}, { locale })}
        </p>
        <QuickStartSuggestions locale={locale} />
      </div>

      <div className="aksa-home-dashboard__grid">
        <RecentWorkColumn locale={locale} tasks={tasks} />
        <GoogleWorkspaceLaunchpad locale={locale} />
      </div>
    </div>
  );
}
