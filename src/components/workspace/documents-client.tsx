"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import { GooglePicker } from "@/components/workspace/google-picker";
import { DocumentSurface } from "@/components/workspace/document-surface";
import { SurfaceHeader } from "@/components/workspace/surface-layout";

/**
 * Documents page client component.
 *
 * Handles three states:
 * 1. Not connected to Google - shows connect prompt
 * 2. Connected, no document selected - shows Picker
 * 3. Document selected - loads and renders it
 */

type ConnectionState = {
  state: "connected" | "not_connected";
  accountEmail: string | null;
  configured: boolean;
};

type PageState =
  | { status: "checking_connection" }
  | { status: "not_configured" }
  | { status: "not_connected" }
  | { status: "connected_no_doc" }
  | { status: "loading_doc"; documentId: string }
  | { status: "doc_loaded"; document: AksaDocumentModel }
  | { status: "doc_error"; error: string; documentId: string };

export function DocumentsClient({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("id");
  const [pageState, setPageState] = useState<PageState>({ status: "checking_connection" });
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);
  const options = { locale };

  /** Check connection on mount. */
  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/google/connection");
        const data: ConnectionState = await response.json();

        if (!data.configured) {
          setPageState({ status: "not_configured" });
          return;
        }

        if (data.state === "connected") {
          setConnectionEmail(data.accountEmail);
          if (documentId) {
            setPageState({ status: "loading_doc", documentId });
          } else {
            setPageState({ status: "connected_no_doc" });
          }
        } else {
          setPageState({ status: "not_connected" });
        }
      } catch {
        setPageState({ status: "not_configured" });
      }
    }

    checkConnection();
  }, [documentId]);

  /** Load document when status transitions to loading_doc. */
  const loadingDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (pageState.status !== "loading_doc") {
      loadingDocIdRef.current = null;
      return;
    }

    const id = pageState.documentId;

    /** Prevent duplicate fetches for the same document. */
    if (loadingDocIdRef.current === id) return;
    loadingDocIdRef.current = id;

    async function loadDocument() {
      try {
        const response = await fetch(`/api/google/docs/${id}`);
        const result = await response.json();

        if (result.status === "ready" && result.data) {
          setPageState({ status: "doc_loaded", document: result.data });
        } else {
          setPageState({
            status: "doc_error",
            error: result.error?.category ?? "Failed to load document",
            documentId: id
          });
        }
      } catch {
        setPageState({
          status: "doc_error",
          error: "Network error",
          documentId: id
        });
      }
    }

    loadDocument();
  }, [pageState]);

  const handleDocumentSelected = useCallback((docId: string) => {
    router.push(`/workspace/documents?id=${docId}`);
  }, [router]);

  const handleDisconnect = useCallback(async () => {
    await fetch("/api/google/connection", { method: "DELETE" });
    setPageState({ status: "not_connected" });
    setConnectionEmail(null);
  }, []);

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.documents_heading({}, options)}
        intro={m.documents_intro({}, options)}
      />

      {/* Checking connection */}
      {pageState.status === "checking_connection" ? (
        <div className="aksa-state-panel" data-tone="pending" role="status">
          <p className="aksa-state-panel__body">Checking Google connection...</p>
        </div>
      ) : null}

      {/* Not configured */}
      {pageState.status === "not_configured" ? (
        <div className="aksa-state-panel" data-tone="blocked">
          <p className="aksa-state-panel__body">
            Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and
            GOOGLE_REDIRECT_URI in your environment.
          </p>
        </div>
      ) : null}

      {/* Not connected */}
      {pageState.status === "not_connected" ? (
        <div className="aksa-state-panel" data-tone="attention">
          <h2 className="aksa-state-panel__heading">{m.documents_blocked_title({}, options)}</h2>
          <p className="aksa-state-panel__body">{m.documents_blocked_desc({}, options)}</p>
          <div className="aksa-state-panel__actions">
            <a className="aksa-button aksa-button--primary" href="/api/google/auth">
              Connect Google
            </a>
          </div>
        </div>
      ) : null}

      {/* Connected, no document selected */}
      {pageState.status === "connected_no_doc" ? (
        <div className="aksa-state-panel" data-tone="neutral">
          {connectionEmail ? (
            <p className="aksa-state-panel__body">
              Connected as <strong>{connectionEmail}</strong>
            </p>
          ) : null}
          <h2 className="aksa-state-panel__heading">{m.documents_empty_title({}, options)}</h2>
          <p className="aksa-state-panel__body">{m.documents_empty_desc({}, options)}</p>
          <div className="aksa-state-panel__actions">
            <GooglePicker
              label="Choose a document"
              onDocumentSelected={handleDocumentSelected}
            />
            <Link className="aksa-button aksa-button--quiet" href="/workspace/files">
              {m.documents_action_open_drive({}, options)}
            </Link>
          </div>
          <div className="aksa-state-panel__actions">
            <button
              className="aksa-button aksa-button--quiet"
              onClick={handleDisconnect}
              type="button"
            >
              Disconnect Google
            </button>
          </div>
        </div>
      ) : null}

      {/* Loading document */}
      {pageState.status === "loading_doc" ? (
        <div className="aksa-state-panel" data-tone="pending" role="status">
          <p className="aksa-state-panel__body">Loading document...</p>
        </div>
      ) : null}

      {/* Document loaded */}
      {pageState.status === "doc_loaded" ? (
        <div className="aksa-doc-workspace">
          <div className="aksa-doc-workspace__header">
            <GooglePicker
              className="aksa-button aksa-button--quiet aksa-button--sm"
              label="Open another"
              onDocumentSelected={handleDocumentSelected}
            />
          </div>
          <DocumentSurface
            document={pageState.document}
            locale={locale}
          />
        </div>
      ) : null}

      {/* Document error */}
      {pageState.status === "doc_error" ? (
        <div className="aksa-state-panel" data-tone="blocked">
          <p className="aksa-state-panel__body">{pageState.error}</p>
          <div className="aksa-state-panel__actions">
            <button
              className="aksa-button aksa-button--secondary"
              onClick={() => setPageState({ status: "loading_doc", documentId: pageState.documentId })}
              type="button"
            >
              Retry
            </button>
            <GooglePicker
              label="Choose another document"
              onDocumentSelected={handleDocumentSelected}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
