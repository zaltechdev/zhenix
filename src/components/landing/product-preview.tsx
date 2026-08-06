import { Mic } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/workspace/status-chip";

function MicrophoneIcon() {
  return <Mic aria-hidden="true" className="landing-icon" />;
}

export function ProductPreviewPanel({ locale }: { locale: Locale }) {
  const messageOptions = { locale };

  return (
    <figure
      aria-describedby="product-preview-description"
      aria-labelledby="product-preview-title"
      className="landing-preview"
      data-preview-type="illustrative"
      id="product-preview"
    >
      <div className="landing-preview__surface">
        <header className="landing-preview__header">
          <div>
            <p className="landing-preview__eyebrow">
              {m.preview_illustrative_label({}, messageOptions)}
            </p>
            <h2 className="landing-preview__title" id="product-preview-title">
              {m.preview_assignment_title({}, messageOptions)}
            </h2>
          </div>
          <StatusChip
            className="landing-preview__task-status"
            label={m.preview_status_label({}, messageOptions)}
            tone="pending"
            value={m.preview_status_paused({}, messageOptions)}
          />
        </header>

        <div className="landing-preview__body">
          <ol aria-label={m.preview_stage_label({}, messageOptions)} className="landing-preview__stages">
            <li className="landing-preview__stage">
              <span className="landing-preview__stage-number">1</span>
              <span>{m.preview_stage_planning({}, messageOptions)}</span>
            </li>
            <li className="landing-preview__stage">
              <span className="landing-preview__stage-number">2</span>
              <span>{m.preview_stage_drafting({}, messageOptions)}</span>
            </li>
            <li aria-current="step" className="landing-preview__stage landing-preview__stage--active">
              <span className="landing-preview__stage-number">3</span>
              <span>{m.preview_stage_testing({}, messageOptions)}</span>
            </li>
          </ol>

          <div className="landing-preview__continuation">
            <div className="landing-preview__message">
              <span className="landing-preview__message-mark" aria-hidden="true" />
              <p>{m.preview_status_message({}, messageOptions)}</p>
            </div>
            <Button
              aria-describedby="preview-voice-control-note"
              aria-label={m.preview_voice_control_label({}, messageOptions)}
              className="landing-preview__voice-control"
              disabled
              type="button"
              variant="secondary"
              size="md"
            >
              <MicrophoneIcon />
              <span>{m.preview_voice_control({}, messageOptions)}</span>
            </Button>
            <span className="sr-only" id="preview-voice-control-note">
              {m.preview_voice_control_note({}, messageOptions)}
            </span>
          </div>
        </div>
      </div>

      <figcaption className="sr-only" id="product-preview-description">
        {m.preview_text_equivalent({}, messageOptions)}
      </figcaption>
    </figure>
  );
}

export const ProductPreview = ProductPreviewPanel;
