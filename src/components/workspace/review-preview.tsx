"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { createAksaError } from "@/lib/contracts/errors";
import {
  ILLUSTRATIVE_CONFIRMATION_PREFIX,
  ILLUSTRATIVE_TASK_ID,
  type Confirmation,
  type ConfirmationDecision
} from "@/lib/contracts/confirmation";
import { ConfirmationDialog } from "@/components/workspace/confirmation-dialog";
import { BlockedState } from "@/components/workspace/state-panel";

/**
 * Labelled confirmation preview.
 *
 * It shows exactly what a real review looks like, including the external-change
 * disclosure and the Undo statement. Confirming it reports the honest unavailable
 * state instead of a success, and it creates no task and no activity record.
 */
export function ReviewPreview({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<ConfirmationDecision | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = { locale };

  const confirmation = useMemo<Confirmation>(() => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `${ILLUSTRATIVE_CONFIRMATION_PREFIX}item-${index + 1}`,
      name: m.home_review_item_prefix({ week: index + 1 }, options),
      kind: "drive_file" as const
    }));

    return {
      id: `${ILLUSTRATIVE_CONFIRMATION_PREFIX}drive-move`,
      taskId: ILLUSTRATIVE_TASK_ID,
      action: "drive_move",
      scopeItems: items,
      scopeItemsTotal: items.length,
      destinationName: m.home_review_destination({}, options),
      changesExternalData: true,
      externalSystem: "google_drive",
      undoSupported: true,
      undoUnsupportedReasonKey: null,
      expiresAt: 0,
      canApprove: true,
      canEdit: true,
      canCancel: true,
      illustrative: true
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleDecision = useCallback(
    (next: ConfirmationDecision) => {
      setDecision(next);
      if (next !== "approve") {
        close();
      }
    },
    [close]
  );

  return (
    <>
      <button
        className="aksa-button aksa-button--secondary"
        onClick={() => {
          setDecision(null);
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <ShieldCheck aria-hidden="true" className="aksa-icon" />
        <span>{m.home_review_open({}, options)}</span>
      </button>

      {decision === "cancel" ? (
        <p className="aksa-inline-note" role="status">
          {m.home_review_cancelled({}, options)}
        </p>
      ) : null}

      {decision === "edit" ? (
        <p className="aksa-inline-note" role="status">
          {m.home_review_edited({}, options)}
        </p>
      ) : null}

      {open ? (
        <ConfirmationDialog
          confirmation={confirmation}
          locale={locale}
          onClose={close}
          onDecision={handleDecision}
          result={
            decision === "approve" ? (
              <BlockedState error={createAksaError("not_configured")} locale={locale} />
            ) : null
          }
        />
      ) : null}
    </>
  );
}
