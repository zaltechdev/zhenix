"use client";

import { useCallback, useState } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { createAksaError } from "@/lib/contracts/errors";
import { blockedResource, type ResourceState } from "@/lib/contracts/resource-state";
import { searchStateSchema, type SearchResult } from "@/lib/contracts/search";
import { SurfaceState } from "@/components/workspace/state-panel";
import { ArtifactView } from "@/components/workspace/artifact-view";
import { CommandComposer } from "@/components/workspace/command-composer";
import type { WorkspaceSurfaceMode } from "@/lib/contracts/workspace-surface";

/**
 * Grounded search surface.
 *
 * When grounding is unavailable the surface says so. It never falls back to an
 * unsourced answer, and the artifact never appears before its sources are known.
 */
export function SearchSurface({
  locale,
  initialState,
  mode = "live",
  previewResult
}: {
  locale: Locale;
  initialState: ResourceState<SearchResult>;
  mode?: WorkspaceSurfaceMode;
  previewResult?: SearchResult;
}) {
  const [state, setState] = useState<ResourceState<SearchResult>>(initialState);
  const [searching, setSearching] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const options = { locale };

  const runSearch = useCallback(async (submittedText: string) => {
    const trimmedQuery = submittedText.trim();
    if (trimmedQuery === "") {
      return;
    }

    setSubmittedQuery(trimmedQuery);
    setSearching(true);
    setState({ status: "loading" });

    try {
      if (mode === "preview" && previewResult !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setState({ status: "ready", data: previewResult });
        return;
      }

      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, locale: locale === "id" ? "id" : "en" })
      });

      const payload: unknown = await response.json();
      const parsed = searchStateSchema.safeParse(payload);
      setState(
        parsed.success
          ? (parsed.data as ResourceState<SearchResult>)
          : blockedResource<SearchResult>(createAksaError("internal_error"))
      );
    } catch {
      setState(blockedResource<SearchResult>(createAksaError("unavailable")));
    } finally {
      setSearching(false);
    }
  }, [locale, mode, previewResult]);

  const hasArtifact = state.status === "ready" && state.data.artifact !== null;

  return (
    <div
      aria-busy={searching}
      className={`aksa-search${submittedQuery === null && !hasArtifact ? " aksa-search--empty" : " aksa-search--has-query"}`}
    >
      {mode === "live" ? (
        <div className="aksa-search__disclosure">
          <p className="aksa-disclosure">{m.search_disclosure({}, options)}</p>
          <p className="aksa-hint">{m.search_privacy_note({}, options)}</p>
        </div>
      ) : null}

      <div className="aksa-search__composer">
        <CommandComposer
          inputLabel={m.search_query_label({}, options)}
          locale={locale}
          mode="welcome"
          onSubmit={runSearch}
        />
      </div>

      {submittedQuery === null ? null : (
        <p className="aksa-inline-note" role="status">
          {m.search_preview_query({ query: submittedQuery }, options)}
        </p>
      )}

      <div className="aksa-search__results">
        <SurfaceState locale={locale} state={state}>
          {(data) =>
            data.artifact === null ? (
              <p className="aksa-inline-note">{m.empty_no_reliable_source({}, options)}</p>
            ) : (
              <ArtifactView artifact={data.artifact} locale={locale} />
            )
          }
        </SurfaceState>
      </div>

      {mode === "live" ? <p className="aksa-hint">{m.search_no_grounding_note({}, options)}</p> : null}
    </div>
  );
}
