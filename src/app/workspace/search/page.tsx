import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SearchSurface } from "@/components/workspace/search-surface";
import { createPreviewSearchResult } from "@/lib/preview/workspace";

export default async function SearchPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const result = createPreviewSearchResult(locale);

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.search_heading({}, options)}
        intro={m.search_intro({}, options)}
        locale={locale}
        mode="preview"
      />
      <SearchSurface
        initialState={{ status: "ready", data: result }}
        locale={locale}
        mode="preview"
        previewResult={result}
      />
    </div>
  );
}
