"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Mic, MoveRight, ShieldCheck, CheckCircle2, Eye, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/workspace/status-chip";

type DemoStep = {
  id: string;
  Icon: LucideIcon;
  label: string;
  description: string;
};

export function HowItWorksDemo({ locale }: { locale: Locale }) {
  const options = { locale };
  const [selectedStep, setSelectedStep] = useState(0);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sectionRef = useRef<HTMLElement | null>(null);

  const steps: DemoStep[] = [
    {
      id: "look",
      Icon: MoveRight,
      label: m.how_step_look_label({}, options),
      description: m.how_step_look_description({}, options)
    },
    {
      id: "speak",
      Icon: Mic,
      label: m.how_step_speak_label({}, options),
      description: m.how_step_speak_description({}, options)
    },
    {
      id: "confirm",
      Icon: ShieldCheck,
      label: m.how_step_confirm_label({}, options),
      description: m.how_step_confirm_description({}, options)
    }
  ];

  // Scroll-driven active step detection via IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: "-20% 0px -30% 0px",
      threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const indexStr = entry.target.getAttribute("data-step-index");
          if (indexStr !== null) {
            const idx = parseInt(indexStr, 10);
            if (!isNaN(idx)) {
              setSelectedStep(idx);
            }
          }
        }
      });
    }, observerOptions);

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  function selectStep(index: number, shouldScroll = false) {
    setSelectedStep(index);
    if (shouldScroll && stepRefs.current[index]) {
      stepRefs.current[index]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
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
    selectStep(nextIndex, true);
  }

  const activeStep = steps[selectedStep];

  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="landing-section landing-section--demo"
      id="how-it-works"
      ref={sectionRef}
    >
      <div className="landing-section__inner">
        <div className="landing-section__intro landing-section__intro--left">
          <h2 id="how-it-works-heading">{m.how_heading({}, options)}</h2>
          <p>{m.how_description({}, options)}</p>
        </div>

        <div className="landing-demo-scroll-layout">
          {/* Left Column: Scroll-driven step cards */}
          <div className="landing-demo-steps-column">
            <div
              aria-label={m.how_control_label({}, options)}
              className="landing-demo__step-list landing-demo__step-list--vertical"
              role="tablist"
            >
              {steps.map(({ Icon, label, description }, index) => {
                const isSelected = selectedStep === index;
                return (
                  <button
                    aria-controls="how-demo-preview-panel"
                    aria-label={label}
                    aria-selected={isSelected}
                    className={`landing-demo__step ${isSelected ? "landing-demo__step--selected" : ""}`}
                    data-step-index={index}
                    id={`how-demo-tab-${index}`}
                    key={label}
                    onClick={() => selectStep(index, true)}
                    onKeyDown={(event) => handleStepKeyDown(event, index)}
                    ref={(el) => {
                      stepRefs.current[index] = el;
                    }}
                    role="tab"
                    tabIndex={isSelected ? 0 : -1}
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
                );
              })}
            </div>
          </div>

          {/* Right Column: Sticky compact preview panel */}
          <div className="landing-demo-preview-column">
            <div
              aria-labelledby={`how-demo-tab-${selectedStep}`}
              className="landing-demo__compact-panel"
              id="how-demo-preview-panel"
              role="tabpanel"
            >
              <div className="landing-demo__compact-header">
                <div className="landing-demo__compact-meta">
                  <span className="landing-demo__step-badge">
                    Step {selectedStep + 1} of {steps.length} • {activeStep.label}
                  </span>
                </div>
                <StatusChip
                  className="landing-demo__status-chip"
                  tone="ready"
                  value={m.how_demo_ready({}, options)}
                />
              </div>

              {/* Dynamic visual preview based on active step */}
              <div className="landing-demo__visual-proof">
                {selectedStep === 0 && (
                  <div className="landing-demo__proof-box landing-demo__proof-box--look">
                    <div className="landing-demo__look-preview">
                      <div className="landing-demo__look-target landing-demo__look-target--active">
                        <Eye className="landing-icon landing-icon--sm" />
                        <span>Docs</span>
                        <div className="landing-demo__dwell-ring" aria-hidden="true" />
                      </div>
                      <div className="landing-demo__look-target">
                        <span>Sheets</span>
                      </div>
                      <div className="landing-demo__look-target">
                        <span>Drive</span>
                      </div>
                    </div>
                    <div className="landing-demo__proof-caption">
                      <span className="landing-demo__proof-dot" />
                      <span>Head movement tracking • Dwell selection target</span>
                    </div>
                  </div>
                )}

                {selectedStep === 1 && (
                  <div className="landing-demo__proof-box landing-demo__proof-box--speak">
                    <div className="landing-demo__speak-preview">
                      <div className="landing-demo__mic-badge">
                        <Mic className="landing-icon landing-icon--sm landing-icon--pulse" />
                        <span>Voice / Text</span>
                      </div>
                      <div className="landing-demo__command-bubble">
                        &quot;Summarize Q3 report into Google Drive&quot;
                      </div>
                    </div>
                    <div className="landing-demo__proof-caption">
                      <span className="landing-demo__proof-dot" />
                      <span>Speech recognition transcript ready</span>
                    </div>
                  </div>
                )}

                {selectedStep === 2 && (
                  <div className="landing-demo__proof-box landing-demo__proof-box--confirm">
                    <div className="landing-demo__confirm-preview">
                      <div className="landing-demo__confirm-card">
                        <div className="landing-demo__confirm-header">
                          <CheckCircle2 className="landing-icon landing-icon--sm" />
                          <span>Action Pending Approval</span>
                        </div>
                        <p className="landing-demo__confirm-text">
                          Create Google Doc: <strong>&quot;Q3 Summary&quot;</strong>
                        </p>
                        <div className="landing-demo__confirm-actions">
                          <Button size="sm" variant="primary">Confirm Execution</Button>
                          <Button size="sm" variant="secondary">Cancel</Button>
                        </div>
                      </div>
                    </div>
                    <div className="landing-demo__proof-caption">
                      <span className="landing-demo__proof-dot" />
                      <span>Explicit review step before execution</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
