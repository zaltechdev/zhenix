import { Suspense } from "react";
import { getRequestLocale } from "@/lib/i18n/request";
import { DocumentsClient } from "@/components/workspace/documents-client";

/**
 * Documents workspace page.
 *
 * The PoC version uses a client component for the full document surface,
 * since it needs interactivity for Google Picker, editing, and save flow.
 * The server component provides locale and wraps in Suspense for
 * useSearchParams compatibility.
 */
export default async function DocumentsPage() {
  const locale = await getRequestLocale();

  return (
    <Suspense fallback={<div className="aksa-state-panel" data-tone="pending" role="status"><p className="aksa-state-panel__body">Loading...</p></div>}>
      <DocumentsClient locale={locale} />
    </Suspense>
  );
}
