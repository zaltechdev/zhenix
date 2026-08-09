import Image from "next/image";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { MarketingHeader } from "@/components/landing/landing-navigation";
import { LandingShell } from "@/components/landing/landing-shell";
import { ProductPreviewPanel } from "@/components/landing/product-preview";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HowItWorksDemo } from "@/components/landing/how-it-works-demo";
import { AccessibilityHighlight } from "@/components/landing/accessibility-highlight";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCta } from "@/components/landing/final-cta";
import { MarketingFooter } from "@/components/landing/marketing-footer";
import { ButtonLink } from "@/components/shared/button";
import { TypewriterText } from "@/components/landing/typewriter-text";
import LandingBackgroundImage from "../../../public/landing.webp";

export function LandingPage({ locale }: { locale: Locale }) {
  const messageOptions = { locale };

  return (
    <LandingShell>
      <MarketingHeader locale={locale} />

      <main id="main-content" className="landing-main">
        <section aria-labelledby="hero-heading" className="landing-hero" id="top">
          <div aria-hidden="true" className="landing-hero__bg">
            <Image
              alt=""
              className="landing-hero__bg-image"
              fill
              priority
              sizes="100vw"
              src={LandingBackgroundImage}
            />
            <div className="landing-hero__bg-overlay" />
          </div>

          <div className="landing-hero__content">
            <h1 className="landing-hero__heading" id="hero-heading">
              <span>{m.hero_headline_first({}, messageOptions)}</span>
              <span>{m.hero_headline_second({}, messageOptions)}</span>
            </h1>

            <p className="landing-hero__description">
              <TypewriterText
                fallback={m.hero_description({}, messageOptions)}
                prefix={m.hero_description_prefix({}, messageOptions)}
                words={[
                  m.hero_typewriter_1({}, messageOptions),
                  m.hero_typewriter_2({}, messageOptions),
                  m.hero_typewriter_3({}, messageOptions),
                  m.hero_typewriter_4({}, messageOptions)
                ]}
              />
            </p>

            <div className="landing-hero__actions">
              <ButtonLink href="/sign-in" size="lg" variant="primary">
                {m.hero_primary_action({}, messageOptions)}
              </ButtonLink>
              <ButtonLink href="#how-it-works" size="lg" variant="secondary">
                {m.hero_secondary_action({}, messageOptions)}
              </ButtonLink>
            </div>
          </div>

          <ProductPreviewPanel locale={locale} />
        </section>

        <FeatureGrid locale={locale} />
        <HowItWorksDemo locale={locale} />
        <AccessibilityHighlight locale={locale} />
        <FaqSection locale={locale} />
        <FinalCta locale={locale} />
      </main>

      <MarketingFooter locale={locale} />
    </LandingShell>
  );
}
