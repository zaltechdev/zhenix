import { getRequestLocale } from "@/lib/i18n/request";
import { LandingPage } from "@/components/landing/landing-page";

export default async function HomePage() {
  const locale = await getRequestLocale();
  return <LandingPage locale={locale} />;
}
