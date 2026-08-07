"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Google Picker integration for Aksa.
 *
 * Loads the Google Picker API script, opens the picker filtered to Google Docs,
 * and returns the selected document ID.
 *
 * The access token for the Picker is obtained from the server via
 * /api/google/picker-token. It is used only for the Picker session and
 * not stored.
 */

type PickerState =
  | "idle"
  | "loading"
  | "ready"
  | "picking"
  | "error";

type GooglePickerProps = {
  onDocumentSelected: (documentId: string, title: string) => void;
  disabled?: boolean;
  label: string;
  className?: string;
};

/** Prevent loading the script more than once. */
let gapiLoaded = false;
let pickerLoaded = false;

function loadGapiScript(): Promise<void> {
  if (gapiLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (existing) {
      gapiLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gapiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.head.appendChild(script);
  });
}

function loadPickerApi(): Promise<void> {
  if (pickerLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("gapi" in window)) {
      reject(new Error("GAPI not loaded"));
      return;
    }

    (window as unknown as { gapi: { load: (lib: string, opts: { callback: () => void; onerror: (err: unknown) => void }) => void } })
      .gapi.load("picker", {
        callback: () => {
          pickerLoaded = true;
          resolve();
        },
        onerror: (err: unknown) => reject(err)
      });
  });
}

export function GooglePicker({ onDocumentSelected, disabled, label, className }: GooglePickerProps) {
  const [state, setState] = useState<PickerState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  /** Preload the Picker API on mount. */
  useEffect(() => {
    loadGapiScript()
      .then(() => loadPickerApi())
      .then(() => setState("ready"))
      .catch(() => setState("error"));
  }, []);

  const openPicker = useCallback(async () => {
    if (state !== "ready" && state !== "idle") return;

    setState("loading");
    setErrorMessage(null);

    try {
      /** Ensure APIs are loaded. */
      await loadGapiScript();
      await loadPickerApi();

      /** Get a short-lived token from the server. */
      const response = await fetch("/api/google/picker-token");
      if (!response.ok) {
        throw new Error("Failed to get picker token");
      }

      const { accessToken, apiKey, appId } = await response.json();

      if (!apiKey) {
        throw new Error("Google Picker API key is not configured");
      }

      setState("picking");

      const google = (window as unknown as { google: { picker: PickerNamespace } }).google;

      const view = new google.picker.DocsView();
      view.setIncludeFolders(false);
      view.setMimeTypes("application/vnd.google-apps.document");

      const builder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .addView(view)
        .setCallback((data: PickerCallbackData) => {
          if (data.action === "picked" && data.docs && data.docs.length > 0) {
            const doc = data.docs[0];
            onDocumentSelected(doc.id, doc.name ?? "Untitled");
          }
          if (data.action === "cancel" || data.action === "picked") {
            setState("ready");
            buttonRef.current?.focus();
          }
        });

      if (appId) {
        builder.setAppId(appId);
      }

      const picker = builder.build();
      picker.setVisible(true);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Picker failed");
      buttonRef.current?.focus();
    }
  }, [state, onDocumentSelected]);

  return (
    <div className="aksa-picker-container">
      <button
        className={className ?? "aksa-button aksa-button--primary"}
        disabled={disabled || state === "loading" || state === "picking"}
        onClick={openPicker}
        ref={buttonRef}
        type="button"
      >
        {state === "loading" || state === "picking" ? "Opening..." : label}
      </button>
      {state === "error" && errorMessage ? (
        <p className="aksa-hint aksa-hint--error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

/** Minimal type declarations for the Google Picker API. */
type PickerNamespace = {
  DocsView: new () => PickerDocsView;
  PickerBuilder: new () => PickerBuilderInstance;
};

type PickerDocsView = {
  setIncludeFolders: (include: boolean) => PickerDocsView;
  setMimeTypes: (mimeTypes: string) => PickerDocsView;
};

type PickerBuilderInstance = {
  setOAuthToken: (token: string) => PickerBuilderInstance;
  setDeveloperKey: (key: string) => PickerBuilderInstance;
  setAppId: (appId: string) => PickerBuilderInstance;
  addView: (view: PickerDocsView) => PickerBuilderInstance;
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilderInstance;
  build: () => { setVisible: (visible: boolean) => void };
};

type PickerCallbackData = {
  action: string;
  docs?: Array<{ id: string; name?: string; mimeType?: string }>;
};
