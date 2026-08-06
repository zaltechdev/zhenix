import Image from "next/image";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { ButtonLink } from "@/components/shared/button";
import LandingBackgroundImage from "../../../public/landing.webp";

export function FinalCta({ locale }: { locale: Locale }) {
  const options = { locale };

  return (
    <section aria-labelledby="final-cta-heading" className="landing-final-cta">
      <div aria-hidden="true" className="landing-final-cta__bg">
        <Image
          alt=""
          className="landing-final-cta__bg-image"
          fill
          sizes="100vw"
          src={LandingBackgroundImage}
        />
        <div className="landing-final-cta__overlay" />
      </div>

      <div className="landing-final-cta__inner">
        <div className="landing-final-cta__content">
          <h2 id="final-cta-heading">{m.final_cta_heading({}, options)}</h2>
          <p>{m.final_cta_description({}, options)}</p>
        </div>
        <ButtonLink href="/sign-in" size="lg" variant="primary">
          {m.hero_primary_action({}, options)}
        </ButtonLink>
      </div>
    </section>
  );
}
