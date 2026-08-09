import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleGateway } from "@/lib/server/google/service";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { FilesSearchForm, FilesSurface } from "@/components/workspace/files-surface";

export default async function FilesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const pageToken = typeof searchParams.pageToken === "string" ? searchParams.pageToken : null;
  const options = { locale };

  const gateway = googleGateway();
  const listing = await gateway.searchDrive({ query, pageToken });

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.files_heading({}, options)} intro={m.files_intro({}, options)} />

      <SurfaceState locale={locale} state={listing}>
        {(data) => (
          <>
            <section aria-labelledby="files-find-heading" className="aksa-dashboard-card">
              <h2 className="aksa-dashboard-card__title" id="files-find-heading">
                {m.files_section_find({}, options)}
              </h2>
              <FilesSearchForm defaultQuery={query} locale={locale} />
            </section>
            <FilesSurface listing={data} locale={locale} />
          </>
        )}
      </SurfaceState>
    </div>
  );
}
