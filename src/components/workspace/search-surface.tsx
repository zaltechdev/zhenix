"use client";

import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { createAksaError } from "@/lib/contracts/errors";
import { blockedResource, type ResourceState } from "@/lib/contracts/resource-state";
import { searchStateSchema, type SearchResult } from "@/lib/contracts/search";
import { SurfaceState } from "@/components/workspace/state-panel";
import { ArtifactView } from "@/components/workspace/artifact-view";

/**
 * Grounded search surface.
 *
 * When grounding is unavailable the surface says so. It never falls back to an
 * unsourced answer, and the artifact never appears before its sources are known.
 */
export function SearchSurface({
  locale,
  initialState
}: {
  locale: Locale;
  initialState: ResourceState<SearchResult>;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ResourceState<SearchResult>>(initialState);
  const [searching, setSearching] = useState(false);
  const options = { locale };

  const runSearch = useCallback(async () => {
    if (query.trim() === "") {
      return;
    }

    setSearching(true);
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), locale: locale === "id" ? "id" : "en" })
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
  }, [locale, query]);

  return (
    <div className="aksa-search">
      <p className="aksa-disclosure">{m.search_disclosure({}, options)}</p>
      <p className="aksa-hint">{m.search_privacy_note({}, options)}</p>

      <div className="aksa-search-form">
        <div className="aksa-field">
          <label className="aksa-label" htmlFor="search-query">
            {m.search_query_label({}, options)}
          </label>
          <input
            className="aksa-input"
            id="search-query"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.search_query_placeholder({}, options)}
            type="search"
            value={query}
          />
        </div>
        <button
          className="aksa-button aksa-button--primary"
          disabled={searching || query.trim() === ""}
          onClick={() => void runSearch()}
          type="button"
        >
          <Search aria-hidden="true" className="aksa-icon" />
          <span>{searching ? m.state_loading({}, options) : m.search_submit({}, options)}</span>
        </button>
      </div>

      <SurfaceState locale={locale} state={state}>
        {(data) =>
          data.artifact === null ? (
            <p className="aksa-inline-note">{m.empty_no_reliable_source({}, options)}</p>
          ) : (
            <ArtifactView artifact={data.artifact} locale={locale} />
          )
        }
      </SurfaceState>

      <p className="aksa-hint">{m.search_no_grounding_note({}, options)}</p>
    </div>
  );
}
