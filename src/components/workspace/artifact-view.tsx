import { ExternalLink } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { citationPosition, type Artifact, type SearchSource } from "@/lib/contracts/search";
import { formatDateTime } from "@/lib/i18n/copy";

/**
 * Grounded answer presentation.
 *
 * Every claim carries citation markers that link to the listed source, source
 * metadata renders as inert text, and link destinations are visible before
 * activation. No claim can appear without a source, because the contract rejects it.
 */
function CitationMarkers({
  artifact,
  citations,
  locale
}: {
  artifact: Artifact;
  citations: string[];
  locale: Locale;
}) {
  return (
    <span className="aksa-citations">
      {citations.map((sourceId) => {
        const position = citationPosition(artifact, sourceId);
        const source = artifact.sources.find((entry) => entry.id === sourceId);
        if (position === null || source === undefined) {
          return null;
        }

        return (
          <a
            aria-label={m.search_citation_label(
              { position: String(position), title: source.title },
              { locale }
            )}
            className="aksa-citation"
            href={`#artifact-source-${sourceId}`}
            key={sourceId}
          >
            {position}
          </a>
        );
      })}
    </span>
  );
}

function SourceCard({ source, locale }: { source: SearchSource; locale: Locale }) {
  return (
    <li className="aksa-source" id={`artifact-source-${source.id}`}>
      <p className="aksa-source__title">{source.title}</p>
      <p className="aksa-source__meta">
        <span className="aksa-source__domain">{source.domain}</span>
        <span>{m.search_source_retrieved({ time: formatDateTime(source.retrievedAt, locale) }, { locale })}</span>
        {source.publishedAt === null ? null : (
          <span>
            {m.search_source_published({ time: formatDateTime(source.publishedAt, locale) }, { locale })}
          </span>
        )}
      </p>
      <p className="aksa-source__snippet">{source.snippet}</p>
      <a
        className="aksa-source__link"
        href={source.url}
        rel="noreferrer noopener"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" className="aksa-icon aksa-icon--sm" />
        <span>{source.url}</span>
        <span className="sr-only">
          {m.search_external_link({ domain: source.domain }, { locale })}
        </span>
      </a>
    </li>
  );
}

export function ArtifactView({ artifact, locale }: { artifact: Artifact; locale: Locale }) {
  const options = { locale };
  const summaries = artifact.blocks.filter((block) => block.type === "summary");
  const keyPoints = artifact.blocks.filter((block) => block.type === "key_point");
  const conflicts = artifact.blocks.filter((block) => block.type === "conflict_note");

  return (
    <article className="aksa-artifact">
      <h3 className="aksa-artifact__title">{artifact.title}</h3>

      {summaries.length > 0 ? (
        <>
          <h4 className="aksa-artifact__subheading">{m.search_artifact_summary({}, options)}</h4>
          {summaries.map((block, index) => (
            <p className="aksa-artifact__text" key={`summary-${index}`}>
              {block.text}
              <CitationMarkers artifact={artifact} citations={block.citations} locale={locale} />
            </p>
          ))}
        </>
      ) : null}

      {keyPoints.length > 0 ? (
        <>
          <h4 className="aksa-artifact__subheading">{m.search_artifact_key_points({}, options)}</h4>
          <ul className="aksa-artifact__points">
            {keyPoints.map((block, index) => (
              <li key={`point-${index}`}>
                {block.text}
                <CitationMarkers artifact={artifact} citations={block.citations} locale={locale} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {conflicts.length > 0 ? (
        <>
          <h4 className="aksa-artifact__subheading">{m.search_artifact_conflict({}, options)}</h4>
          {conflicts.map((block, index) => (
            <p className="aksa-artifact__text aksa-artifact__text--conflict" key={`conflict-${index}`}>
              {block.text}
              <CitationMarkers artifact={artifact} citations={block.citations} locale={locale} />
            </p>
          ))}
        </>
      ) : null}

      <h4 className="aksa-artifact__subheading">{m.search_sources_heading({}, options)}</h4>
      <ol aria-label={m.search_sources_heading({}, options)} className="aksa-sources">
        {artifact.sources.map((source) => (
          <SourceCard key={source.id} locale={locale} source={source} />
        ))}
      </ol>
    </article>
  );
}
