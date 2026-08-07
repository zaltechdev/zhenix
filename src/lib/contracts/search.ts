import { z } from "zod";
import { resourceStateSchema } from "@/lib/contracts/resource-state";

/**
 * Grounded search and artifact contracts.
 *
 * Every claim maps to a listed source. An artifact with no source is invalid by
 * schema, so a missing citation is a validation failure rather than a rendering
 * decision. See `.agents/features/web-search-artifacts.md`.
 */

export const searchSourceSchema = z.object({
  id: z.string().min(1).max(200),
  /** Untrusted text. Escaped and rendered inert. */
  title: z.string().min(1).max(600),
  publisher: z.string().max(200).nullable(),
  url: z.string().url().max(2000),
  domain: z.string().min(1).max(300),
  publishedAt: z.number().int().nonnegative().nullable(),
  retrievedAt: z.number().int().nonnegative(),
  snippet: z.string().max(1200)
});

export type SearchSource = z.infer<typeof searchSourceSchema>;

const citationIds = z.array(z.string().min(1).max(200)).min(1);

export const artifactBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary"), text: z.string().min(1).max(2000), citations: citationIds }),
  z.object({ type: z.literal("key_point"), text: z.string().min(1).max(1000), citations: citationIds }),
  z.object({
    type: z.literal("conflict_note"),
    text: z.string().min(1).max(1500),
    citations: z.array(z.string().min(1).max(200)).min(2)
  })
]);

export type ArtifactBlock = z.infer<typeof artifactBlockSchema>;

export const artifactSchema = z
  .object({
    id: z.string().min(1).max(200),
    taskId: z.string().min(1).max(200),
    kind: z.enum(["search_summary", "document_summary", "sheet_summary", "email_summary"]),
    title: z.string().min(1).max(300),
    blocks: z.array(artifactBlockSchema).min(1),
    sources: z.array(searchSourceSchema),
    language: z.enum(["en", "id"]),
    bodyFormat: z.enum(["markdown_safe", "plain"]),
    retrievedAt: z.number().int().nonnegative().nullable(),
    createdAt: z.number().int().nonnegative(),
    truncated: z.boolean()
  })
  .superRefine((artifact, ctx) => {
    if (artifact.kind === "search_summary" && artifact.sources.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "A search summary artifact requires at least one source."
      });
    }

    const sourceIds = new Set(artifact.sources.map((source) => source.id));
    for (const block of artifact.blocks) {
      for (const citation of block.citations) {
        if (!sourceIds.has(citation)) {
          ctx.addIssue({
            code: "custom",
            message: "Every citation must map to a listed source."
          });
          return;
        }
      }
    }
  });

export type Artifact = z.infer<typeof artifactSchema>;

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(600),
  locale: z.enum(["en", "id"])
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchResultSchema = z.object({
  sources: z.array(searchSourceSchema),
  artifact: artifactSchema.nullable(),
  /** Disclosed so the user can judge freshness. Aksa does not imply live monitoring. */
  retrievedAt: z.number().int().nonnegative()
});

export type SearchResult = z.infer<typeof searchResultSchema>;

/** Transport shape for the search boundary, so the browser can validate what arrives. */
export const searchStateSchema = resourceStateSchema(searchResultSchema);

export function citationPosition(artifact: Artifact, sourceId: string): number | null {
  const index = artifact.sources.findIndex((source) => source.id === sourceId);
  return index === -1 ? null : index + 1;
}
