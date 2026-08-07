import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleGateway } from "@/lib/server/google/service";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { DocumentSurface } from "@/components/workspace/document-surface";

export default async function DocumentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const searchParams = await props.searchParams;
  const documentId = typeof searchParams.id === "string" ? searchParams.id : null;
  const tabId = typeof searchParams.tab === "string" ? searchParams.tab : null;
  const options = { locale };

  const state = await googleGateway().readDocument(documentId ?? "", tabId);

  const emptyActions = (
    <>
      <Link className="aksa-button aksa-button--secondary" href="/workspace/files">
        {m.documents_action_find({}, options)}
      </Link>
      <Link className="aksa-button aksa-button--quiet" href="/workspace/files">
        {m.documents_action_open_drive({}, options)}
      </Link>
    </>
  );

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.documents_heading({}, options)}
        intro={m.documents_intro({}, options)}
      />

      <SurfaceState emptyActions={emptyActions} locale={locale} state={state}>
        {(document) => <DocumentSurface document={document} locale={locale} />}
      </SurfaceState>
    </div>
  );
}
