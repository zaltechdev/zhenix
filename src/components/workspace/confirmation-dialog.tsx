"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { Confirmation, ConfirmationDecision } from "@/lib/contracts/confirmation";
import { confirmationActionCopy, externalSystemCopy, formatCount } from "@/lib/i18n/copy";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * The single confirmation surface for every consequential action.
 *
 * It states the action, the named items, the destination, the consequence, and
 * whether Undo will exist, then offers Confirm, Edit, and Cancel. Initial focus lands
 * on the dialog body rather than the confirming control, so momentum cannot approve
 * anything. See `.agents/rules.md` section 9 and `.agents/design.md` section 7.
 */
export function ConfirmationDialog({
  confirmation,
  locale,
  onDecision,
  onClose,
  result
}: {
  confirmation: Confirmation;
  locale: Locale;
  onDecision: (decision: ConfirmationDecision) => void;
  onClose: () => void;
  /** Rendered after a decision, so the outcome is never assumed. */
  result?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const options = { locale };

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    bodyRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        /** Escape cancels, which is the safe direction for a pending change. */
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable || focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  return (
    <div className="aksa-dialog-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="aksa-dialog"
        data-aksa-confirmation-guard="true"
        ref={dialogRef}
        role="dialog"
      >
        <div aria-live="assertive" className="sr-only">
          {m.announce_confirmation_required({}, options)}
        </div>

        <div className="aksa-dialog__body" ref={bodyRef} tabIndex={0}>
          <div className="aksa-dialog__header">
            <h2 className="aksa-dialog__title" id={titleId}>
              {m.confirmation_heading({}, options)}
            </h2>
            {confirmation.illustrative ? (
              <span className="aksa-badge">{m.illustrative_label({}, options)}</span>
            ) : null}
          </div>

          <p className="aksa-dialog__action" id={descriptionId}>
            {confirmationActionCopy(confirmation.action, locale)}
          </p>

          {confirmation.preview ? (
            <>
              <h3 className="aksa-dialog__subheading">{m.confirmation_preview_heading({}, options)}</h3>
              <pre className="aksa-dialog__preview">{confirmation.preview}</pre>
            </>
          ) : null}

          <h3 className="aksa-dialog__subheading">{m.confirmation_scope_heading({}, options)}</h3>
          <p className="aksa-dialog__count">
            {m.confirmation_scope_count(
              { count: formatCount(confirmation.scopeItemsTotal, locale) },
              options
            )}
          </p>
          <ul className="aksa-dialog__items">
            {confirmation.scopeItems.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>

          {confirmation.destinationName !== null ? (
            <p className="aksa-dialog__destination">
              {m.confirmation_destination({ destination: confirmation.destinationName }, options)}
            </p>
          ) : null}

          <h3 className="aksa-dialog__subheading">
            {m.confirmation_consequence_heading({}, options)}
          </h3>
          <p>
            {confirmation.changesExternalData
              ? m.confirmation_consequence_external(
                  { system: externalSystemCopy(confirmation.externalSystem, locale) },
                  options
                )
              : m.confirmation_consequence_internal({}, options)}
          </p>

          <h3 className="aksa-dialog__subheading">{m.confirmation_recovery_heading({}, options)}</h3>
          <StatusChip
            tone={confirmation.undoSupported ? "ready" : "attention"}
            value={
              confirmation.undoSupported
                ? m.confirmation_undo_supported({}, options)
                : m.confirmation_undo_unsupported({}, options)
            }
          />

          {result ? (
            <div className="aksa-dialog__result">
              <h3 className="aksa-dialog__subheading">
                {m.confirmation_result_heading({}, options)}
              </h3>
              {result}
            </div>
          ) : null}
        </div>

        <div className="aksa-dialog__actions">
          <button
            className="aksa-button aksa-button--quiet"
            disabled={!confirmation.canCancel}
            onClick={() => onDecision("cancel")}
            type="button"
          >
            {m.confirmation_cancel({}, options)}
          </button>
          <button
            className="aksa-button aksa-button--secondary"
            disabled={!confirmation.canEdit}
            onClick={() => onDecision("edit")}
            type="button"
          >
            {m.confirmation_edit({}, options)}
          </button>
          <button
            className="aksa-button aksa-button--primary"
            disabled={!confirmation.canApprove}
            onClick={() => onDecision("approve")}
            type="button"
          >
            {m.confirmation_approve({}, options)}
          </button>
        </div>
      </div>
    </div>
  );
}
