"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import { blocksToTiptapHtml } from "@/lib/client/editor/blocks-to-tiptap";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * Aksa document work surface (PoC version).
 *
 * Renders a real Google Docs document in TipTap, supports direct editing with
 * structured save-to-Google and conflict detection.
 */

type SaveState = "saved" | "unsaved" | "saving" | "conflict" | "error";

export function DocumentSurface({
  document,
  locale,
}: {
  document: AksaDocumentModel;
  locale: Locale;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const editingRef = useRef(false);
  const currentRevisionRef = useRef(document.revisionId);
  const originalHtmlRef = useRef("");
  const options = { locale };

  const html = useMemo(() => blocksToTiptapHtml(document.blocks), [document.blocks]);

  useEffect(() => {
    originalHtmlRef.current = html;
    currentRevisionRef.current = document.revisionId;
  }, [html, document.revisionId]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: html,
    editable: false,
    immediatelyRender: false,
    onUpdate: () => {
      if (editingRef.current) {
        setSaveState("unsaved");
      }
    },
    editorProps: {
      attributes: {
        "aria-label": m.documents_editor_label({}, options),
        class: "aksa-editor__content",
        role: "textbox",
        "aria-multiline": "true"
      }
    }
  });

  useEffect(() => {
    editingRef.current = editing;
    editor?.setEditable(editing);
  }, [editing, editor]);

  const handleStartEditing = useCallback(() => {
    if (!document.canEdit) return;
    setEditing(true);
    setSaveState("saved");
    setConflictMessage(null);
  }, [document.canEdit]);

  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setSaveState("saved");
    setConflictMessage(null);
    /** Restore original content. */
    editor?.commands.setContent(originalHtmlRef.current);
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!editor || saveState !== "unsaved") return;

    setSaveState("saving");
    setConflictMessage(null);

    try {
      /** Extract plain text for a basic replaceText operation. */
      const currentText = editor.getText();
      const originalText = document.blocks.map((b) => b.plainText).join("\n");

      if (currentText === originalText) {
        setSaveState("saved");
        return;
      }

      /**
       * Build a replace operation for the full document body.
       * This is a simplified approach for the PoC. Pass 3 will implement
       * per-block granular edit tracking.
       */
      const bodyStart = document.blocks.length > 0 ? document.blocks[0].sourceStartIndex : 1;
      const bodyEnd = document.blocks.length > 0
        ? document.blocks[document.blocks.length - 1].sourceEndIndex
        : 1;

      const response = await fetch(`/api/google/docs/${document.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operations: [
            {
              type: "replaceText",
              startIndex: bodyStart,
              endIndex: bodyEnd - 1, /** Exclude trailing newline. */
              newText: currentText
            }
          ],
          requiredRevisionId: currentRevisionRef.current
        })
      });

      const result = await response.json();

      if (result.outcome === "completed" && result.document) {
        /** Update with the verified document from the re-read. */
        currentRevisionRef.current = result.document.revisionId;
        const newHtml = blocksToTiptapHtml(result.document.blocks);
        originalHtmlRef.current = newHtml;
        editor.commands.setContent(newHtml);
        setEditing(false);
        setSaveState("saved");
      } else if (result.outcome === "conflict") {
        setSaveState("conflict");
        setConflictMessage("Document was modified externally. Reload to see the latest version.");
      } else {
        setSaveState("error");
        setConflictMessage(result.error?.category ?? "Save failed");
      }
    } catch {
      setSaveState("error");
      setConflictMessage("Network error. Check your connection and retry.");
    }
  }, [editor, saveState, document]);

  const handleReload = useCallback(async () => {
    try {
      const response = await fetch(`/api/google/docs/${document.id}`);
      const result = await response.json();

      if (result.status === "ready" && result.data) {
        const newDoc = result.data as AksaDocumentModel;
        currentRevisionRef.current = newDoc.revisionId;
        const newHtml = blocksToTiptapHtml(newDoc.blocks);
        originalHtmlRef.current = newHtml;
        editor?.commands.setContent(newHtml);
        setEditing(false);
        setSaveState("saved");
        setConflictMessage(null);
      }
    } catch {
      setConflictMessage("Failed to reload document.");
    }
  }, [document.id, editor]);

  const saveTone = saveState === "saved" ? "ready" as const
    : saveState === "unsaved" ? "attention" as const
    : saveState === "saving" ? "pending" as const
    : "blocked" as const;

  const saveLabel = saveState === "saved" ? m.documents_saved({}, options)
    : saveState === "unsaved" ? m.documents_unsaved({}, options)
    : saveState === "saving" ? "Saving..."
    : saveState === "conflict" ? "Conflict"
    : "Error";

  return (
    <div className="aksa-document">
      {/* Title bar */}
      <div className="aksa-doc-titlebar">
        <h3 className="aksa-document__title">{document.title}</h3>
        <div className="aksa-doc-titlebar__status">
          <StatusChip
            label={m.documents_source_label({}, options)}
            tone={document.sourceSystem === "google_docs" ? "info" : "neutral"}
            value={
              document.sourceSystem === "google_docs"
                ? m.documents_source_google({}, options)
                : m.documents_source_illustrative({}, options)
            }
          />
          <StatusChip
            label={m.documents_mode_label({}, options)}
            tone={editing ? "attention" : "neutral"}
            value={editing ? m.documents_mode_edit({}, options) : m.documents_mode_read({}, options)}
          />
          <StatusChip tone={saveTone} value={saveLabel} />
        </div>
      </div>

      {/* Formatting toolbar (visible in edit mode) */}
      {editing ? (
        <div className="aksa-doc-toolbar" role="toolbar" aria-label="Formatting">
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("bold") ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Bold"
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("italic") ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italic"
            type="button"
          >
            <em>I</em>
          </button>
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("underline") ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            title="Underline"
            type="button"
          >
            <u>U</u>
          </button>
          <span className="aksa-toolbar-divider" aria-hidden="true" />
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("heading", { level: 1 }) ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
            type="button"
          >
            H1
          </button>
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("heading", { level: 2 }) ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            type="button"
          >
            H2
          </button>
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("heading", { level: 3 }) ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
            type="button"
          >
            H3
          </button>
          <span className="aksa-toolbar-divider" aria-hidden="true" />
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("bulletList") ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="Bullet list"
            type="button"
          >
            &bull;
          </button>
          <button
            className={`aksa-toolbar-btn ${editor?.isActive("orderedList") ? "aksa-toolbar-btn--active" : ""}`}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
            type="button"
          >
            1.
          </button>
        </div>
      ) : null}

      {/* Editor canvas */}
      <div className="aksa-editor">
        <EditorContent editor={editor} />
      </div>

      {/* Conflict resolution */}
      {conflictMessage ? (
        <div className="aksa-doc-conflict" role="alert">
          <p className="aksa-doc-conflict__message">{conflictMessage}</p>
          <div className="aksa-doc-conflict__actions">
            <button
              className="aksa-button aksa-button--secondary"
              onClick={handleReload}
              type="button"
            >
              Reload document
            </button>
            <button
              className="aksa-button aksa-button--quiet"
              onClick={() => {
                if (editor) {
                  navigator.clipboard?.writeText(editor.getText());
                }
              }}
              type="button"
            >
              Copy my text
            </button>
          </div>
        </div>
      ) : null}

      {/* Action bar */}
      <div className="aksa-document__actions">
        {!editing ? (
          <button
            className="aksa-button aksa-button--secondary"
            disabled={!document.canEdit}
            onClick={handleStartEditing}
            type="button"
          >
            {m.documents_enable_edit({}, options)}
          </button>
        ) : (
          <>
            <button
              className="aksa-button aksa-button--quiet"
              onClick={handleCancelEditing}
              type="button"
            >
              {m.documents_cancel_edit({}, options)}
            </button>
            <button
              className="aksa-button aksa-button--primary"
              disabled={saveState !== "unsaved"}
              onClick={handleSave}
              type="button"
            >
              {saveState === "saving" ? "Saving..." : "Save to Google Docs"}
            </button>
          </>
        )}
        <a
          className="aksa-button aksa-button--quiet"
          href={`https://docs.google.com/document/d/${document.id}/edit`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open in Google Docs
        </a>
      </div>

      <p className="aksa-hint">{m.documents_write_note({}, options)}</p>
    </div>
  );
}
