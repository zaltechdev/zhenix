import { ShieldCheck, Eye, Keyboard } from "lucide-react";
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
      Icon: Keyboard,
      title: m.accessibility_trust_fallback_title({}, options),
      description: m.accessibility_trust_fallback_desc({}, options)
    }
  ];

  return (
    <section
      aria-labelledby="accessibility-heading"
      className="landing-section landing-section--accessibility"
      id="accessibility"
    >
      <div className="landing-section__inner">
        <div className="landing-section__intro landing-section__intro--left">
          <h2 id="accessibility-heading">{m.accessibility_heading({}, options)}</h2>
          <p>{m.accessibility_description({}, options)}</p>
        </div>

        {/* Three Concrete Controls Cards */}
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
