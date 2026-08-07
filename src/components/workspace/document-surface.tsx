"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { DocumentBlock, DocumentResource } from "@/lib/contracts/google";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * Aksa document work surface.
 *
 * An original Aksa surface built on the installed Tiptap packages. It renders the
 * normalized blocks it receives, stays read only until editing is deliberately
 * started, and never applies an edit without a review step.
 *
 * Google Docs supports document tabs, so the tab selector is part of the contract
 * rather than an assumption that a document has one body.
 */
function blocksToHtml(blocks: DocumentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
        case "paragraph":
          return `<p>${escapeHtml(block.text)}</p>`;
        case "bullet_list":
          return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
        case "ordered_list":
          return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
      }
    })
    .join("");
}

/**
 * Document content is untrusted data. Escaping before it reaches the editor keeps
 * markup from a document inert.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function DocumentSurface({
  document,
  locale,
  onReviewEdit
}: {
  document: DocumentResource;
  locale: Locale;
  /** Provided once a reviewed write path exists. Absent means editing cannot be sent. */
  onReviewEdit?: (blocks: DocumentBlock[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTabId, setActiveTabId] = useState(document.activeTabId);
  /**
   * Read through a ref inside the editor callback, because loading the document
   * content also fires an update and must not count as an unsaved change.
   */
  const editingRef = useRef(false);
  const options = { locale };

  const html = useMemo(() => blocksToHtml(document.blocks), [document.blocks]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    editable: false,
    /** Required for server rendering with Tiptap 3. */
    immediatelyRender: false,
    onUpdate: () => {
      if (editingRef.current) {
        setDirty(true);
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

  const canEdit = document.canEdit && onReviewEdit !== undefined;

  return (
    <div className="aksa-document">
      <div className="aksa-document__meta">
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
        <StatusChip
          tone={dirty ? "attention" : "ready"}
          value={dirty ? m.documents_unsaved({}, options) : m.documents_saved({}, options)}
        />
      </div>

      <h3 className="aksa-document__title">{document.title}</h3>

      {document.tabs.length > 1 ? (
        <div className="aksa-field">
          <label className="aksa-label" htmlFor="document-tab">
            {m.documents_tab_label({}, options)}
          </label>
          <select
            className="aksa-select"
            id="document-tab"
            onChange={(event) => setActiveTabId(event.target.value)}
            value={activeTabId}
          >
            {document.tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="aksa-editor">
        <EditorContent editor={editor} />
      </div>

      <div className="aksa-document__actions">
        <button
          className="aksa-button aksa-button--secondary"
          disabled={!canEdit}
          onClick={() => setEditing((previous) => !previous)}
          type="button"
        >
          {editing ? m.documents_cancel_edit({}, options) : m.documents_enable_edit({}, options)}
        </button>
        <button
          className="aksa-button aksa-button--primary"
          disabled={!canEdit || !dirty}
          onClick={() => onReviewEdit?.(document.blocks)}
          type="button"
        >
          {m.documents_review_edit({}, options)}
        </button>
      </div>

      <p className="aksa-hint">{m.documents_write_note({}, options)}</p>
    </div>
  );
}
