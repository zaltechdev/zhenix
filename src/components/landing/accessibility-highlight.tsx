import { Accessibility, Eye, ShieldCheck, Sliders, Volume2, PauseCircle } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function AccessibilityHighlight({ locale }: { locale: Locale }) {
  const options = { locale };

  const proofPoints = [
    {
      Icon: ShieldCheck,
      title: m.accessibility_trust_privacy_title({}, options),
      description: m.accessibility_trust_privacy_desc({}, options)
    },
    {
      Icon: Eye,
      title: m.accessibility_trust_confirm_title({}, options),
      description: m.accessibility_trust_confirm_desc({}, options)
    },
    {
      Icon: Sliders,
      title: m.accessibility_trust_fallback_title({}, options),
      description: m.accessibility_trust_fallback_desc({}, options)
    }
  ];

  return (
    <section aria-labelledby="accessibility-heading" className="landing-section landing-section--accessibility" id="accessibility">
      <div className="landing-section__inner">
        {/* Top Split: Headline & Short Paragraph on Left, Control Preview on Right */}
        <div className="landing-a11y-hero-split">
          <div className="landing-a11y-hero-split__left">
            <h2 id="accessibility-heading">{m.accessibility_heading({}, options)}</h2>
            <p>{m.accessibility_description({}, options)}</p>
          </div>

          <div aria-hidden="true" className="landing-a11y-showcase">
            <div className="landing-a11y-showcase__header">
              <span className="landing-a11y-showcase__badge">
                <Accessibility className="landing-icon landing-icon--sm" />
                <span>{m.accessibility_widget_label({}, options)}</span>
              </span>
              <span className="landing-a11y-showcase__status">{m.how_demo_ready({}, options)}</span>
            </div>
            <div className="landing-a11y-showcase__grid">
              <div className="landing-a11y-showcase__item">
                <Sliders className="landing-icon" />
                <div>
                  <strong>{m.accessibility_inputs_title({}, options)}</strong>
                  <span>{m.accessibility_inputs_dwell({}, options)}</span>
                </div>
              </div>
              <div className="landing-a11y-showcase__item">
                <Volume2 className="landing-icon" />
                <div>
                  <strong>{m.feature_ask_title({}, options)}</strong>
                  <span>{m.accessibility_inputs_voice({}, options)}</span>
                </div>
              </div>
              <div className="landing-a11y-showcase__item">
                <PauseCircle className="landing-icon" />
                <div>
                  <strong>{m.feature_control_title({}, options)}</strong>
                  <span>{m.accessibility_safety_loss({}, options)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Three Concise Proof Points */}
        <div className="landing-a11y-proof-grid">
          {proofPoints.map(({ Icon, title, description }) => (
            <article className="landing-a11y-proof-card" key={title}>
              <div className="landing-a11y-proof-card__header">
                <span aria-hidden="true" className="landing-a11y-proof-card__icon">
                  <Icon className="landing-icon" />
                </span>
                <h3>{title}</h3>
              </div>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
