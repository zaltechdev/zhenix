import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleGateway } from "@/lib/server/google/service";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SurfaceState } from "@/components/workspace/state-panel";
import { SheetSurface } from "@/components/workspace/sheet-surface";

export default async function SheetsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const searchParams = await props.searchParams;
  const spreadsheetId = typeof searchParams.id === "string" ? searchParams.id : "";
  const a1Range = typeof searchParams.range === "string" ? searchParams.range : null;
  const options = { locale };

  const state = await googleGateway().readSheetRange({ spreadsheetId, a1Range });

  const emptyActions = (
    <Link className="aksa-button aksa-button--secondary" href="/workspace/files">
      {m.documents_action_open_drive({}, options)}
    </Link>
  );

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.sheets_heading({}, options)} intro={m.sheets_intro({}, options)} />

      <SurfaceState emptyActions={emptyActions} locale={locale} state={state}>
        {(range) => <SheetSurface locale={locale} range={range} />}
      </SurfaceState>
    </div>
  );
}
