"use client";

import { useCallback, useState, type FormEvent } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { DriveItem } from "@/lib/contracts/google";

type PickerState = "idle" | "loading" | "ready" | "error";

type GooglePickerProps = {
  onDocumentSelected: (documentId: string, title: string) => void;
  disabled?: boolean;
  label: string;
  locale: Locale;
  className?: string;
};

/**
 * Server-backed Docs chooser. Google access tokens never enter this component;
 * the server returns only real, user-scoped Drive metadata.
 */
export function GooglePicker({ onDocumentSelected, disabled, label, locale, className }: GooglePickerProps) {
  const [state, setState] = useState<PickerState>("idle");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const options = { locale };

  const loadDocuments = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    setState("loading");
    try {
      const response = await fetch(`/api/google/docs?query=${encodeURIComponent(query.trim())}`);
      const result = await response.json() as {
        status?: string;
        data?: { items?: DriveItem[] };
      };
      if (!response.ok || (result.status !== "ready" && result.status !== "empty")) {
        throw new Error("documents_unavailable");
      }
      setItems(result.data?.items ?? []);
      setState("ready");
    } catch {
      setItems([]);
      setState("error");
    }
  }, [query]);

  if (state === "idle") {
    return (
      <button
        className={className ?? "aksa-button aksa-button--primary"}
        disabled={disabled}
        onClick={() => void loadDocuments()}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="aksa-picker-container">
      <form className="aksa-picker-search" onSubmit={(event) => void loadDocuments(event)}>
        <label htmlFor="google-docs-search" className="aksa-sr-only">
          {m.documents_search_label({}, options)}
        </label>
        <input
          className="aksa-input"
          id="google-docs-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.documents_search_placeholder({}, options)}
          type="search"
          value={query}
        />
        <button className="aksa-button aksa-button--secondary" disabled={state === "loading"} type="submit">
          {m.documents_search_submit({}, options)}
        </button>
      </form>

      {state === "loading" ? (
        <p className="aksa-hint" role="status">{m.documents_documents_loading({}, options)}</p>
      ) : null}
      {state === "error" ? (
        <p className="aksa-hint aksa-hint--error" role="alert">{m.documents_documents_error({}, options)}</p>
      ) : null}
      {state === "ready" && items.length === 0 ? (
        <p className="aksa-hint">{m.documents_documents_empty({}, options)}</p>
      ) : null}
      {items.length > 0 ? (
        <ul aria-label={m.documents_title_label({}, options)} className="aksa-picker-results">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="aksa-button aksa-button--quiet"
                onClick={() => onDocumentSelected(item.id, item.name)}
                type="button"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
