import Image from "next/image";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { LandingNavigation } from "@/components/landing/landing-navigation";
import { ProductPreview } from "@/components/landing/product-preview";
import { TypewriterText } from "@/components/landing/typewriter-text";
import { AccessibilityWidget } from "@/components/shared/accessibility-widget";

export function LandingPage({ locale }: { locale: Locale }) {
  const messageOptions = { locale };

  const typewriterWords = [
    m.hero_typewriter_1({}, messageOptions),
    m.hero_typewriter_2({}, messageOptions),
    m.hero_typewriter_3({}, messageOptions),
    m.hero_typewriter_4({}, messageOptions),
  ];

  return (
    <div className="landing-shell">
      <div aria-hidden="true" className="landing-background">
        <Image
          alt=""
          className="landing-background__image"
          fill
          priority
          sizes="100vw"
          src="/landing.webp"
        />
      </div>
      <LandingNavigation locale={locale} />

        <main id="main-content" className="landing-main">
          <section aria-labelledby="hero-heading" className="landing-hero" id="hero">
            <div className="landing-hero__content">
              <h1 className="landing-hero__heading" id="hero-heading">
                <span>{m.hero_headline_first({}, messageOptions)}</span>
                <span>{m.hero_headline_second({}, messageOptions)}</span>
              </h1>

              <p className="landing-hero__description">
                <TypewriterText
                  prefix={m.hero_description_prefix({}, messageOptions)}
                  words={typewriterWords}
                  fallback={m.hero_description({}, messageOptions)}
                />
              </p>

              <div className="landing-hero__actions">
                <a className="landing-button landing-button--primary" href="#product-preview">
                  {m.hero_primary_action({}, messageOptions)}
                </a>
                <a className="landing-button landing-button--secondary" href="#product-preview">
                  {m.hero_secondary_action({}, messageOptions)}
                </a>
              </div>
            </div>

            <ProductPreview locale={locale} />
          </section>
        </main>

        <AccessibilityWidget locale={locale} />
      </div>
  );
}
