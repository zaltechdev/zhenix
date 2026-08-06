
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

type FaqItem = {
  question: string;
  answer: string;
};

export function FaqSection({ locale }: { locale: Locale }) {
  const options = { locale };
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items: FaqItem[] = [
    { question: m.faq_question_hardware({}, options), answer: m.faq_answer_hardware({}, options) },
    { question: m.faq_question_storage({}, options), answer: m.faq_answer_storage({}, options) },
    { question: m.faq_question_changes({}, options), answer: m.faq_answer_changes({}, options) },
    { question: m.faq_question_stop_undo({}, options), answer: m.faq_answer_stop_undo({}, options) },
    { question: m.faq_question_tools({}, options), answer: m.faq_answer_tools({}, options) }
  ];

  return (
    <section aria-labelledby="faq-heading" className="landing-section landing-section--faq" id="faq">
      <div className="landing-section__inner landing-section__inner--narrow">
        <div className="landing-section__intro">
          <h2 id="faq-heading">{m.faq_heading({}, options)}</h2>
          <p>{m.faq_description({}, options)}</p>
        </div>

        <div className="landing-faq-list">
          {items.map(({ question, answer }, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;

            return (
              <article className="landing-faq-item" key={question}>
                <h3>
                  <button
                    aria-controls={answerId}
                    aria-expanded={isOpen}
                    className="landing-faq-item__trigger"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    type="button"
                  >
                    <span>{question}</span>
                    <ChevronDown aria-hidden="true" className={`landing-icon ${isOpen ? "landing-icon--open" : ""}`} />
                  </button>
                </h3>
                <div className="landing-faq-item__answer" hidden={!isOpen} id={answerId}>
                  <p>{answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
