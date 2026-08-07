import { getRequestLocale } from "@/lib/i18n/request";
import { readTaskHistory } from "@/lib/server/tasks/service";
import { readWorkspaceContext } from "@/lib/server/workspace/service";
import { WelcomeHeader } from "@/components/workspace/welcome-header";
import { CommandComposer } from "@/components/workspace/command-composer";
import { QuickStartSuggestions } from "@/components/workspace/quick-start-suggestions";
import { RecentWorkColumn } from "@/components/workspace/recent-work-column";
import { GoogleWorkspaceLaunchpad } from "@/components/workspace/google-workspace-launchpad";
import { CompactSetupState } from "@/components/workspace/compact-setup-state";

export default async function WorkspaceHomePage() {
  const locale = await getRequestLocale();
  const [history, context] = await Promise.all([
    readTaskHistory(),
    readWorkspaceContext()
  ]);

  const tasks =
    history.status === "ready" || history.status === "partial"
      ? history.data.tasks
      : [];

  return (
    <div className="aksa-home-dashboard">
      <CompactSetupState connection={context.connection} locale={locale} session={context.session} />

      <WelcomeHeader locale={locale} />

      <div className="aksa-home-dashboard__composer-area">
        <CommandComposer inflow locale={locale} mode="welcome" />
        <QuickStartSuggestions locale={locale} />
      </div>

      <div className="aksa-home-dashboard__grid">
        <RecentWorkColumn locale={locale} tasks={tasks} />
        <GoogleWorkspaceLaunchpad locale={locale} />
      </div>
    </div>
  );
}
