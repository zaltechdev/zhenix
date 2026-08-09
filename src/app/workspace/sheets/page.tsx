import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { SurfaceHeader } from "@/components/workspace/surface-layout";
import { SheetPreviewSurface } from "@/components/workspace/sheet-surface";
import { createPreviewSheetRange } from "@/lib/preview/workspace";

export default async function SheetsPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const range = createPreviewSheetRange(locale);

  return (
    <div className="aksa-surface">
      <SurfaceHeader
        heading={m.sheets_heading({}, options)}
        intro={m.sheets_intro({}, options)}
        locale={locale}
        mode="preview"
      />
      <SheetPreviewSurface locale={locale} range={range} />
    </div>
  );
}
