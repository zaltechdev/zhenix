import Image from "next/image";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import LandingBackgroundImage from "../../../public/landing.webp";

export default async function OnboardingPage() {
  const locale = await getRequestLocale();
  const options = { locale };

  return (
    <div className="aksa-auth-shell">
      <div aria-hidden="true" className="aksa-auth-background">
        <Image
          alt=""
          className="aksa-auth-background__image"
          fill
          priority
          sizes="100vw"
          src={LandingBackgroundImage}
        />
        <div className="aksa-auth-background__overlay" />
      </div>

      <a className="aksa-skip-link" href="#main-content">
        {m.skip_to_content({}, options)}
      </a>

      <main className="aksa-auth-main aksa-auth-main--wide" id="main-content">
        <OnboardingFlow locale={locale} />
      </main>
    </div>
  );
}
