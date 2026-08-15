import { Suspense } from "react";
import { getRequestLocale } from "@/lib/i18n/request";
import { PerplexitySearchView } from "@/components/workspace/perplexity-search-view";

export default async function SearchPage() {
  const locale = await getRequestLocale();
  return (
    <Suspense fallback={null}>
      <PerplexitySearchView locale={locale} />
    </Suspense>
  );
}
