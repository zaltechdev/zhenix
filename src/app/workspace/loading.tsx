import { getRequestLocale } from "@/lib/i18n/request";
import { RouteLoading } from "@/components/shared/route-loading";

export default async function WorkspaceLoading() {
  const locale = await getRequestLocale();
  return <RouteLoading locale={locale} />;
}
