import { assertServerOnly } from "@/lib/server/server-guard";
import { providerRegistry } from "@/lib/server/ai/provider-registry";
import { blockedResource, type ResourceState } from "@/lib/contracts/resource-state";
import { searchRequestSchema, type SearchRequest, type SearchResult } from "@/lib/contracts/search";
import { createAksaError } from "@/lib/server/errors/aksa-error";

assertServerOnly("src/lib/server/search/service.ts");

/**
 * Grounded search boundary.
 *
 * When grounding is unavailable Aksa says so. It never falls back to an unsourced
 * model answer presented as research. See `.agents/features/web-search-artifacts.md`.
 */
export type SearchGateway = {
  runGroundedQuery(request: SearchRequest): Promise<ResourceState<SearchResult>>;
  isGroundingAvailable(): boolean;
};

export function searchGateway(): SearchGateway {
  return {
    async runGroundedQuery(request): Promise<ResourceState<SearchResult>> {
      const parsed = searchRequestSchema.safeParse(request);
      if (!parsed.success) {
        return blockedResource<SearchResult>(createAksaError("validation_failed"));
      }

      const resolution = providerRegistry().resolve("search_grounded");
      if (resolution.status === "not_configured") {
        return blockedResource<SearchResult>(resolution.error);
      }

      return blockedResource<SearchResult>(createAksaError("unavailable"));
    },

    isGroundingAvailable(): boolean {
      return providerRegistry().resolve("search_grounded").status === "ready";
    }
  };
}

export async function readSearchIdleState(): Promise<ResourceState<SearchResult>> {
  const resolution = providerRegistry().resolve("search_grounded");
  if (resolution.status === "not_configured") {
    return blockedResource<SearchResult>(resolution.error);
  }
  return blockedResource<SearchResult>(createAksaError("unavailable"));
}
