"use client";

import Link from "next/link";
import { Activity, FileText, FolderOpen, Globe, Mail, Table2, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { Task } from "@/lib/contracts/task";
import { formatDateTime, taskStateCopy } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";

const toneForState: Record<Task["state"], StatusTone> = {
  idle: "neutral",
  listening: "pending",
  transcribing: "pending",
  understanding: "pending",
  executing: "pending",
  waiting_for_confirmation: "attention",
  completed: "ready",
  partially_completed: "attention",
  failed: "blocked",
  cancelled: "neutral",
  undo_available: "ready"
};

function iconForTask(title: string): LucideIcon {
  const lower = title.toLowerCase();
  if (lower.includes("sheet") || lower.includes("spreadsheet") || lower.includes("tabel")) {
    return Table2;
  }
  if (lower.includes("mail") || lower.includes("draft") || lower.includes("surel") || lower.includes("gmail")) {
    return Mail;
  }
  if (lower.includes("drive") || lower.includes("folder") || lower.includes("file") || lower.includes("pindahkan")) {
    return FolderOpen;
  }
  if (lower.includes("search") || lower.includes("web") || lower.includes("cari")) {
    return Globe;
  }
  if (lower.includes("doc") || lower.includes("document") || lower.includes("tugas") || lower.includes("dokumen")) {
    return FileText;
  }
  return Activity;
}

export function RecentWorkColumn({
  tasks,
  locale
}: {
  tasks: Task[];
  locale: Locale;
}) {
  const options = { locale };
  const recentTasks = tasks.slice(0, 3);

  return (
    <section aria-labelledby="recent-work-heading" className="aksa-dashboard-card">
      <div className="aksa-dashboard-card__header">
        <h2 className="aksa-dashboard-card__title" id="recent-work-heading">
          {m.home_continue_heading({}, options)}
        </h2>
      </div>

      {recentTasks.length === 0 ? (
        <div className="aksa-recent-work__empty">
          <h3 className="aksa-recent-work__empty-title">
            {m.home_empty_work_title({}, options)}
          </h3>
          <p className="aksa-recent-work__empty-text">
            {m.home_empty_work_desc({}, options)}
          </p>
        </div>
      ) : (
        <ul aria-label={m.home_continue_heading({}, options)} className="aksa-recent-work__list">
          {recentTasks.map((task) => {
            const Icon = iconForTask(task.title);
            const isCompleted = task.state === "completed" || task.state === "undo_available";

            return (
              <li className="aksa-recent-work__item" key={task.id}>
                <div className="aksa-recent-work__item-icon">
                  <Icon aria-hidden="true" className="aksa-icon" />
                </div>

                <div className="aksa-recent-work__item-content">
                  <h3 className="aksa-recent-work__item-title">{task.title}</h3>
                  <div className="aksa-recent-work__item-meta">
                    <StatusChip
                      tone={toneForState[task.state]}
                      value={taskStateCopy(
                        {
                          state: task.state,
                          title: task.title,
                          completed: task.itemsCompleted ?? 0,
                          remaining: (task.itemsTotal ?? 0) - (task.itemsCompleted ?? 0)
                        },
                        locale
                      )}
                    />
                    <time className="aksa-recent-work__item-time" dateTime={new Date(task.updatedAt).toISOString()}>
                      {formatDateTime(task.updatedAt, locale)}
                    </time>
                  </div>
                </div>

                <div className="aksa-recent-work__item-action">
                  <Link className="aksa-button aksa-button--quiet aksa-button--sm" href={`/workspace/history?id=${task.id}`}>
                    {isCompleted ? m.home_action_view_result({}, options) : m.home_action_continue({}, options)}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
