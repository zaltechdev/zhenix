import { getRequestLocale } from "@/lib/i18n/request";
import { FoundationView } from "@/components/foundation/foundation-view";

export default async function HomePage() {
  const locale = await getRequestLocale();
  return <FoundationView locale={locale} />;
}
