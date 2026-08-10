import { Mic, ShieldCheck, CheckCircle2, LayoutGrid } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function FeatureGrid({ locale }: { locale: Locale }) {
  const options = { locale };

  return (
    <section aria-labelledby="features-heading" className="landing-section landing-section--features" id="features">
      <div className="landing-section__inner">
        <div className="landing-section__intro landing-section__intro--left">
          <h2 id="features-heading">{m.features_heading({}, options)}</h2>
          <p>{m.features_description({}, options)}</p>
        </div>

        <div className="landing-features-grid">
          {/* Card 1: Your Google Workspace in one place */}
          <article className="landing-feature-card">
            <div className="landing-feature-card__header">
              <span aria-hidden="true" className="landing-feature-card__icon">
                <LayoutGrid className="landing-icon" />
              </span>
              <h3>{m.feature_steps_title({}, options)}</h3>
            </div>
            <p>{m.feature_steps_description({}, options)}</p>
            <div aria-hidden="true" className="landing-feature-card__ui-preview">
              <div className="landing-feature-card__ui-row">
                <span className="landing-feature-card__badge landing-feature-card__badge--active">
                  Docs, Sheets & Slides
                </span>
                <span className="landing-feature-card__badge">Drive & Gmail</span>
              </div>
            </div>
          </article>

          {/* Card 2: Ask for the outcome */}
          <article className="landing-feature-card">
            <div className="landing-feature-card__header">
              <span aria-hidden="true" className="landing-feature-card__icon">
                <Mic className="landing-icon" />
              </span>
              <h3>{m.feature_workspace_title({}, options)}</h3>
            </div>
            <p>{m.feature_workspace_description({}, options)}</p>
            <div aria-hidden="true" className="landing-feature-card__ui-preview">
              <div className="landing-feature-card__ui-row">
                <span className="landing-feature-card__badge landing-feature-card__badge--accent">
                  Voice & Text Input
                </span>
              </div>
            </div>
          </article>

          {/* Card 3: Stay in control */}
          <article className="landing-feature-card">
            <div className="landing-feature-card__header">
              <span aria-hidden="true" className="landing-feature-card__icon">
                <ShieldCheck className="landing-icon" />
              </span>
              <h3>{m.feature_recovery_title({}, options)}</h3>
            </div>
            <p>{m.feature_recovery_description({}, options)}</p>
            <div aria-hidden="true" className="landing-feature-card__ui-preview">
              <div className="landing-feature-card__safety-box">
                <div className="landing-feature-card__safety-header">
                  <CheckCircle2 className="landing-icon landing-icon--sm" />
                  <span>{m.how_step_confirm_label({}, options)}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
