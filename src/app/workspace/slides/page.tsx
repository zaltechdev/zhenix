import { getRequestLocale } from "@/lib/i18n/request";
import { SlidesSurface } from "@/components/workspace/slides-surface";

export default async function SlidesPage() {
  const locale = await getRequestLocale();

  return (
    <div className="aksa-surface">
      <SlidesSurface locale={locale} />
    </div>
  );
}
