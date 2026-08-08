"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import type { Confirmation, ConfirmationDecision } from "@/lib/contracts/confirmation";
import { errorCategorySchema } from "@/lib/contracts/errors";
import { errorCopy } from "@/lib/i18n/copy";
import { blocksToTiptapHtml } from "@/lib/client/editor/blocks-to-tiptap";
import { StatusChip } from "@/components/workspace/status-chip";
import { ConfirmationDialog } from "@/components/workspace/confirmation-dialog";

type SaveState = "saved" | "proposing" | "waiting" | "writing" | "verified" | "error";

function documentErrorCopy(category: unknown, locale: Locale): string {
  const parsed = errorCategorySchema.safeParse(category);
  return parsed.success
    ? errorCopy(parsed.data, locale)
    : m.documents_append_failed({}, { locale });
}

export function DocumentSurface({
  document,
  locale
}: {
  document: AksaDocumentModel;
  locale: Locale;
}) {
  const options = { locale };
  const [savedDocument, setSavedDocument] = useState<AksaDocumentModel | null>(null);
  const currentDocument = savedDocument?.id === document.id ? savedDocument : document;
  const [appendText, setAppendText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);

  const html = useMemo(
    () => blocksToTiptapHtml(currentDocument.blocks),
    [currentDocument.blocks]
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": m.documents_editor_label({}, options),
        class: "aksa-editor__content",
        role: "document"
      }
    }
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== html) {
      editor.commands.setContent(html);
    }
  }, [editor, html]);

  const handleReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = appendText.trim();
    if (!text) {
      setSaveState("error");
      setErrorMessage(m.documents_append_empty({}, options));
      return;
    }

    setSaveState("proposing");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/google/docs/${currentDocument.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendText: text,
          expectedRevisionId: currentDocument.revisionId
        })
      });
      const result = await response.json() as {
        outcome?: string;
        confirmation?: Confirmation;
        error?: { category?: unknown };
      };
      if (result.outcome === "confirmation_required" && result.confirmation) {
        setConfirmation(result.confirmation);
        setSaveState("waiting");
        return;
      }
      setSaveState("error");
      setErrorMessage(documentErrorCopy(result.error?.category, locale));
    } catch {
      setSaveState("error");
      setErrorMessage(m.documents_append_failed({}, options));
    }
  };

  const handleDecision = async (decision: ConfirmationDecision) => {
    if (!confirmation || decisionPending) return;
    setDecisionPending(true);
    setErrorMessage(null);
    if (decision === "approve") setSaveState("writing");

    try {
      const response = await fetch("/api/google/docs/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId: confirmation.id, decision })
      });
      const result = await response.json() as {
        outcome?: string;
        document?: AksaDocumentModel;
        error?: { category?: unknown };
      };

      if (result.outcome === "completed" && result.document) {
        setSavedDocument(result.document);
        setAppendText("");
        setSaveState("verified");
        setConfirmation(null);
      } else if (result.outcome === "cancelled" || result.outcome === "edit_requested") {
        setSaveState("saved");
        setConfirmation(null);
      } else {
        setSaveState("error");
        setErrorMessage(documentErrorCopy(result.error?.category, locale));
        setConfirmation(null);
      }
    } catch {
      setSaveState("error");
      setErrorMessage(m.documents_append_failed({}, options));
      setConfirmation(null);
    } finally {
      setDecisionPending(false);
    }
  };

  const saveTone = saveState === "saved" || saveState === "verified" ? "ready" as const
    : saveState === "waiting" ? "attention" as const
    : saveState === "proposing" || saveState === "writing" ? "pending" as const
    : "blocked" as const;
  const saveLabel = saveState === "saved" ? m.documents_saved({}, options)
    : saveState === "proposing" ? m.documents_review_edit({}, options)
    : saveState === "waiting" ? m.documents_append_pending({}, options)
    : saveState === "writing" ? m.documents_append_saving({}, options)
    : saveState === "verified" ? m.documents_append_verified({}, options)
    : m.documents_append_failed({}, options);
  const sourceLabel = currentDocument.sourceSystem === "illustrative_preview"
    ? m.documents_source_illustrative({}, options)
    : m.documents_source_google({}, options);

  return (
    <div className="aksa-document">
      <div className="aksa-doc-titlebar">
        <h3 className="aksa-document__title">{currentDocument.title}</h3>
        <div className="aksa-doc-titlebar__status">
          <StatusChip
            label={m.documents_source_label({}, options)}
            tone="info"
            value={sourceLabel}
          />
          <StatusChip
            label={m.documents_mode_label({}, options)}
            tone="neutral"
            value={m.documents_mode_read({}, options)}
          />
          <StatusChip tone={saveTone} value={saveLabel} />
        </div>
      </div>

      <div className="aksa-editor">
        <EditorContent editor={editor} />
        {currentDocument.blocks.length === 0 ? (
          <p className="aksa-hint">{m.documents_empty_content({}, options)}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="aksa-hint aksa-hint--error" role="alert">{errorMessage}</p>
      ) : null}

      <form className="aksa-document__append" onSubmit={handleReview}>
        <label htmlFor="google-doc-append">{m.documents_append_label({}, options)}</label>
        <textarea
          className="aksa-input"
          disabled={saveState === "proposing" || saveState === "waiting" || saveState === "writing"}
          id="google-doc-append"
          onChange={(event) => setAppendText(event.target.value)}
          placeholder={m.documents_append_placeholder({}, options)}
          rows={3}
          value={appendText}
        />
        <button
          className="aksa-button aksa-button--primary"
          disabled={!currentDocument.canEdit || saveState === "proposing" || saveState === "waiting" || saveState === "writing"}
          type="submit"
        >
          {m.documents_append_action({}, options)}
        </button>
      </form>

      {!currentDocument.canEdit ? (
        <button className="aksa-button aksa-button--secondary" disabled type="button">
          {m.documents_enable_edit({}, options)}
        </button>
      ) : null}

      <div className="aksa-document__actions">
        <a
          className="aksa-button aksa-button--quiet"
          href={`https://docs.google.com/document/d/${currentDocument.id}/edit`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {m.documents_open_google({}, options)}
        </a>
      </div>

      <p className="aksa-hint">{m.documents_write_note({}, options)}</p>

      {confirmation ? (
        <ConfirmationDialog
          confirmation={{
            ...confirmation,
            canApprove: !decisionPending && confirmation.canApprove,
            canCancel: !decisionPending && confirmation.canCancel,
            canEdit: !decisionPending && confirmation.canEdit
          }}
          locale={locale}
          onClose={() => void handleDecision("cancel")}
          onDecision={(decision) => void handleDecision(decision)}
        />
      ) : null}
    </div>
  );
}
