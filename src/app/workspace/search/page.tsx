import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { readSearchIdleState } from "@/lib/server/search/service";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { SearchSurface } from "@/components/workspace/search-surface";

export default async function SearchPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const initialState = await readSearchIdleState();

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.search_heading({}, options)} intro={m.search_intro({}, options)} />

      <Panel heading={m.search_artifact_heading({}, options)} locale={locale}>
        <SearchSurface initialState={initialState} locale={locale} />
      </Panel>
    </div>
  );
}
