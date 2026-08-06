"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Mic, MoveRight, RotateCcw, ShieldCheck, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/workspace/status-chip";

type DemoStep = {
  Icon: LucideIcon;
  label: string;
  description: string;
  details: string[];
};

export function HowItWorksDemo({ locale }: { locale: Locale }) {
  const options = { locale };
  const [selectedStep, setSelectedStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const steps: DemoStep[] = [
    {
      Icon: MoveRight,
      label: m.how_step_look_label({}, options),
      description: m.how_step_look_description({}, options),
      details: [
        m.how_look_detail_1({}, options),
        m.how_look_detail_2({}, options),
        m.how_look_detail_3({}, options)
      ]
    },
    {
      Icon: Mic,
      label: m.how_step_speak_label({}, options),
      description: m.how_step_speak_description({}, options),
      details: [
        m.how_speak_detail_1({}, options),
        m.how_speak_detail_2({}, options),
        m.how_speak_detail_3({}, options)
      ]
    },
    {
      Icon: ShieldCheck,
      label: m.how_step_confirm_label({}, options),
      description: m.how_step_confirm_description({}, options),
      details: [
        m.how_confirm_detail_1({}, options),
        m.how_confirm_detail_2({}, options),
        m.how_confirm_detail_3({}, options),
        m.how_confirm_detail_4({}, options)
      ]
    }
  ];
  const activeStep = steps[selectedStep];

  function replay() {
    setSelectedStep(0);
    setIsPaused(false);
    stepRefs.current[0]?.focus();
  }

  function selectStep(index: number) {
    setSelectedStep(index);
    stepRefs.current[index]?.focus();
  }

  function handleStepKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = steps.length - 1;
    let nextIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    selectStep(nextIndex);
  }

  return (
    <section aria-labelledby="how-it-works-heading" className="landing-section landing-section--demo" id="how-it-works">
      <div className="landing-section__inner">
        <div className="landing-demo-editorial-grid">
          {/* Left Column: Heading, description & selectable steps */}
          <div className="landing-demo-editorial__left">
            <div className="landing-section__intro landing-section__intro--left">
              <h2 id="how-it-works-heading">{m.how_heading({}, options)}</h2>
              <p>{m.how_description({}, options)}</p>
            </div>

            <div
              aria-label={m.how_control_label({}, options)}
              className="landing-demo__step-list landing-demo__step-list--vertical"
              role="tablist"
            >
              {steps.map(({ Icon, label, description }, index) => (
                <button
                  aria-controls="how-demo-panel"
                  aria-label={label}
                  aria-selected={selectedStep === index}
                  className={`landing-demo__step ${selectedStep === index ? "landing-demo__step--selected" : ""}`}
                  id={`how-demo-tab-${index}`}
                  key={label}
                  onClick={() => selectStep(index)}
                  onKeyDown={(event) => handleStepKeyDown(event, index)}
                  ref={(element) => {
                    stepRefs.current[index] = element;
                  }}
                  role="tab"
                  tabIndex={selectedStep === index ? 0 : -1}
                  type="button"
                >
                  <span className="landing-demo__step-number">{index + 1}</span>
                  <div className="landing-demo__step-info">
                    <div className="landing-demo__step-title">
                      <Icon aria-hidden="true" className="landing-icon" />
                      <span>{label}</span>
                    </div>
                    <span className="landing-demo__step-desc">{description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: One large product demonstration */}
          <div className="landing-demo-editorial__right">
            <div className="landing-demo" data-demo-paused={isPaused}>
              <div className="landing-demo__toolbar">
                <p className="landing-demo__label">{m.how_control_label({}, options)}</p>
                <div className="landing-demo__controls">
                  <Button
                    aria-pressed={isPaused}
                    onClick={() => setIsPaused((paused) => !paused)}
                    size="sm"
                    variant="secondary"
                  >
                    {isPaused ? m.how_resume({}, options) : m.how_pause({}, options)}
                  </Button>
                  <Button onClick={replay} size="sm" variant="quiet">
                    <RotateCcw aria-hidden="true" className="landing-icon landing-icon--sm" />
                    <span>{m.how_replay({}, options)}</span>
                  </Button>
                </div>
              </div>

              <div
                aria-labelledby={`how-demo-tab-${selectedStep}`}
                className="landing-demo__panel"
                id="how-demo-panel"
                role="tabpanel"
                tabIndex={0}
              >
                <div className="landing-demo__panel-heading">
                  <div>
                    <span className="landing-demo__step-count">
                      {selectedStep + 1} / {steps.length}
                    </span>
                    <h3>{activeStep.label}</h3>
                    <p>{activeStep.description}</p>
                  </div>
                  <StatusChip
                    label={m.how_demo_status_label({}, options)}
                    tone={isPaused ? "pending" : "ready"}
                    value={isPaused ? m.how_demo_paused({}, options) : m.how_demo_ready({}, options)}
                  />
                </div>

                <div className="landing-demo__sequence">
                  <h4>{m.how_sequence_label({}, options)}</h4>
                  <ol>
                    {activeStep.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <p className="landing-demo__note">{m.how_demo_note({}, options)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
