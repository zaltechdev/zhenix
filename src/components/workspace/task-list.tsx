import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { Task } from "@/lib/contracts/task";
import { formatDateTime, formatCount, taskStateCopy } from "@/lib/i18n/copy";
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

/**
 * Task list used by Home and History.
 *
 * A native table keeps rows and headers programmatically associated, and counts are
 * rendered as localized text rather than as a chart or colour.
 */
export function TaskList({ tasks, locale }: { tasks: Task[]; locale: Locale }) {
  const options = { locale };

  return (
    <div className="aksa-table-scroll">
      <table className="aksa-table">
        <caption className="sr-only">{m.history_list_label({}, options)}</caption>
        <thead>
          <tr>
            <th scope="col">{m.history_column_command({}, options)}</th>
            <th scope="col">{m.history_column_state({}, options)}</th>
            <th scope="col">{m.history_column_created({}, options)}</th>
            <th scope="col">{m.history_column_items({}, options)}</th>
            <th scope="col">{m.history_column_artifacts({}, options)}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <th className="aksa-table__row-header" scope="row">
                {task.title}
              </th>
              <td>
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
              </td>
              <td>{formatDateTime(task.createdAt, locale)}</td>
              <td>{formatCount(task.itemsTotal ?? task.affectedItems.length, locale)}</td>
              <td>{formatCount(task.artifactIds.length, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
