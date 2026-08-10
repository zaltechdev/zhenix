import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { Task } from "@/lib/contracts/task";
import { CommandProvider } from "@/components/workspace/command-context";
import { CommandComposer } from "@/components/workspace/command-composer";
import { GoogleWorkspaceLaunchpad } from "@/components/workspace/google-workspace-launchpad";
import { QuickStartSuggestions } from "@/components/workspace/quick-start-suggestions";
import { RecentWorkColumn } from "@/components/workspace/recent-work-column";
import { WelcomeHeader } from "@/components/workspace/welcome-header";

export function ProductPreviewPanel({ locale }: { locale: Locale }) {
  const messageOptions = { locale };
  const taskTimestamp = Date.UTC(2026, 7, 7, 9, 0, 0);
  const landingTasks: Task[] = [
    {
      id: "landing-research-notes",
      title: m.landing_task_research_notes({}, messageOptions),
      intentCategory: "research",
      state: "completed",
      createdAt: taskTimestamp,
      updatedAt: taskTimestamp,
      affectedItems: [],
      artifactIds: [],
      confirmationId: null,
      undoId: null,
      cancellationAvailable: false,
      itemsTotal: 1,
      itemsCompleted: 1,
      resultSummaryKey: null,
      error: null
    },
    {
      id: "landing-project-files",
      title: m.landing_task_project_files({}, messageOptions),
      intentCategory: "find_files",
      state: "completed",
      createdAt: taskTimestamp - 86_400_000,
      updatedAt: taskTimestamp - 86_400_000,
      affectedItems: [],
      artifactIds: [],
      confirmationId: null,
      undoId: null,
      cancellationAvailable: false,
      itemsTotal: 1,
      itemsCompleted: 1,
      resultSummaryKey: null,
      error: null
    },
    {
      id: "landing-document-edits",
      title: m.landing_task_document_edits({}, messageOptions),
      intentCategory: "edit_document",
      state: "waiting_for_confirmation",
      createdAt: taskTimestamp - 172_800_000,
      updatedAt: taskTimestamp - 172_800_000,
      affectedItems: [],
      artifactIds: [],
      confirmationId: "landing-document-confirmation",
      undoId: null,
      cancellationAvailable: false,
      itemsTotal: 1,
      itemsCompleted: 0,
      resultSummaryKey: null,
      error: null
    }
  ];

  return (
    <figure
      aria-label={m.landing_workspace_label({}, messageOptions)}
      aria-describedby="product-preview-description"
      className="landing-preview"
      data-preview-type="workspace"
      id="product-preview"
      inert
    >
      <div className="landing-preview__surface">
        <div className="landing-preview__workspace">
          <CommandProvider>
            <WelcomeHeader headingId="product-preview-title" headingLevel="h2" locale={locale} />

            <div className="landing-preview__workspace-composer">
              <CommandComposer
                inputLabel={m.composer_input_label({}, messageOptions)}
                locale={locale}
                mode="welcome"
                preview
              />
              <p className="aksa-ai-disclaimer" role="note">
                {m.workspace_ai_disclaimer({}, messageOptions)}
              </p>
              <QuickStartSuggestions locale={locale} />
            </div>

            <div className="aksa-home-dashboard__grid landing-preview__workspace-grid">
              <RecentWorkColumn
                locale={locale}
                statusCopy={{
                  completed: m.landing_task_completed({}, messageOptions),
                  waiting_for_confirmation: m.landing_task_waiting_confirmation({}, messageOptions)
                }}
                tasks={landingTasks}
              />
              <GoogleWorkspaceLaunchpad locale={locale} />
            </div>
          </CommandProvider>
        </div>
      </div>

      <figcaption className="sr-only" id="product-preview-description">
        {m.landing_workspace_description({}, messageOptions)}
      </figcaption>
    </figure>
  );
}

export const ProductPreview = ProductPreviewPanel;
