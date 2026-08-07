"use client";

import { Undo2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { isUndoOfferable, type UndoRecord } from "@/lib/contracts/undo";
import { formatCount, formatDateTime, undoReasonCopy, undoStateCopy } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";

const toneForState: Record<UndoRecord["state"], StatusTone> = {
  available: "ready",
  running: "pending",
  completed: "ready",
  partially_completed: "attention",
  failed: "blocked",
  unavailable: "neutral",
  expired: "neutral"
};

/**
 * Undo presentation.
 *
 * The control appears only when the server reports an available record. Remaining
 * availability is stated as text, with no animated countdown pressuring the user, and
 * an unsupported reverse operation states why.
 */
export function UndoPanel({
  record,
  locale,
  onUndo,
  onDismiss
}: {
  record: UndoRecord;
  locale: Locale;
  onUndo?: (undoId: string) => void;
  onDismiss?: () => void;
}) {
  const options = { locale };
  const offerable = isUndoOfferable(record) && onUndo !== undefined;

  return (
    <div className="aksa-undo">
      <div className="aksa-undo__status">
        <StatusChip
          label={m.undo_heading({}, options)}
          tone={toneForState[record.state]}
          value={undoStateCopy(record.state, locale)}
        />
        {record.itemsReverted === null ? null : (
          <StatusChip
            tone={record.itemsReverted === record.itemsTotal ? "ready" : "attention"}
            value={m.undo_reverted_count(
              {
                reverted: formatCount(record.itemsReverted, locale),
                total: formatCount(record.itemsTotal, locale)
              },
              options
            )}
          />
        )}
      </div>

      {record.supported ? null : (
        <p className="aksa-inline-note">
          {undoReasonCopy(record.unsupportedReasonKey ?? "", locale)}
        </p>
      )}

      {record.expiresAt === null ? null : (
        <p className="aksa-hint">{formatDateTime(record.expiresAt, locale)}</p>
      )}

      {record.affectedItems.length > 0 ? (
        <ul className="aksa-undo__items">
          {record.affectedItems.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      ) : null}

      <div className="aksa-undo__actions">
        <button
          className="aksa-button aksa-button--secondary"
          disabled={!offerable}
          onClick={() => onUndo?.(record.id)}
          type="button"
        >
          <Undo2 aria-hidden="true" className="aksa-icon" />
          <span>{m.undo_apply({}, options)}</span>
        </button>
        {onDismiss === undefined ? null : (
          <button className="aksa-button aksa-button--quiet" onClick={onDismiss} type="button">
            {m.undo_dismiss({}, options)}
          </button>
        )}
      </div>
    </div>
  );
}
