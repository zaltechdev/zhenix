import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { ActivityEvent, ActivityOutcome } from "@/lib/contracts/activity";
import { activityEventCopy, errorShortCopy, formatDateTime } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";

const toneForOutcome: Record<ActivityOutcome, StatusTone> = {
  started: "pending",
  succeeded: "ready",
  failed: "blocked",
  skipped: "neutral",
  cancelled: "neutral",
  awaiting_confirmation: "attention"
};

/**
 * Activity feed.
 *
 * Every entry is an ordered, real recorded step with its affected items, verified
 * flag, and timestamp. No reasoning trace appears anywhere.
 */
export function ActivityList({ events, locale }: { events: ActivityEvent[]; locale: Locale }) {
  const options = { locale };

  return (
    <ol aria-label={m.activity_list_label({}, options)} className="aksa-activity">
      {events.map((event) => (
        <li className="aksa-activity__item" key={event.id}>
          <div className="aksa-activity__row">
            <span className="aksa-activity__label">{event.actionLabel}</span>
            <StatusChip tone={toneForOutcome[event.outcome]} value={activityEventCopy(event.eventType, locale)} />
            <StatusChip
              tone={event.verified ? "ready" : "neutral"}
              value={
                event.verified ? m.activity_verified({}, options) : m.activity_unverified({}, options)
              }
            />
          </div>

          {event.affectedItems.length > 0 ? (
            <ul className="aksa-activity__items">
              {event.affectedItems.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : null}

          <p className="aksa-activity__meta">
            <span>{formatDateTime(event.createdAt, locale)}</span>
            {event.errorCategory === null ? null : (
              <span>{errorShortCopy(event.errorCategory, locale)}</span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
