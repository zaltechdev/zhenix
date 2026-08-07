"use client";

import { useState } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { DraftRequest, MailInbox, MailMessage } from "@/lib/contracts/google";
import { formatDateTime } from "@/lib/i18n/copy";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * Aksa mail work surface.
 *
 * Read and summarize recent mail and create a draft. There is no send control,
 * because sending is out of MVP. Message text is rendered as inert text and is never
 * treated as an instruction.
 */
export function MailSurface({
  inbox,
  locale,
  onReviewDraft
}: {
  inbox: MailInbox;
  locale: Locale;
  onReviewDraft?: (draft: DraftRequest) => void;
}) {
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const options = { locale };
  const canDraft = onReviewDraft !== undefined;

  return (
    <div className="aksa-mail">
      <div className="aksa-table-scroll">
        <table className="aksa-table">
          <caption className="sr-only">{m.mail_list_label({}, options)}</caption>
          <thead>
            <tr>
              <th scope="col">{m.mail_column_sender({}, options)}</th>
              <th scope="col">{m.mail_column_subject({}, options)}</th>
              <th scope="col">{m.mail_column_date({}, options)}</th>
              <th scope="col">{m.mail_open({}, options)}</th>
            </tr>
          </thead>
          <tbody>
            {inbox.messages.map((message) => (
              <tr data-selected={selected?.id === message.id || undefined} key={message.id}>
                <th className="aksa-table__row-header" scope="row">
                  {message.senderDisplay}
                </th>
                <td>
                  <span className="aksa-mail__subject">{message.subject}</span>
                  <span className="aksa-mail__preview">{message.preview}</span>
                </td>
                <td>{formatDateTime(message.receivedAt, locale)}</td>
                <td>
                  <button
                    aria-pressed={selected?.id === message.id}
                    className="aksa-button aksa-button--quiet"
                    onClick={() => setSelected(message)}
                    type="button"
                  >
                    {m.mail_open({}, options)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected !== null ? (
        <section aria-label={m.mail_reading_label({}, options)} className="aksa-panel aksa-panel--inset">
          <h3 className="aksa-panel__heading">{selected.subject}</h3>
          <StatusChip
            label={m.mail_column_sender({}, options)}
            tone="info"
            value={selected.senderDisplay}
          />
          <p className="aksa-mail__body">{selected.preview}</p>
          <p className="aksa-hint">{m.mail_untrusted_note({}, options)}</p>
        </section>
      ) : null}

      <section className="aksa-panel aksa-panel--inset">
        <h3 className="aksa-panel__heading">{m.mail_draft_heading({}, options)}</h3>

        <div className="aksa-field">
          <label className="aksa-label" htmlFor="draft-to">
            {m.mail_draft_to({}, options)}
          </label>
          <input
            autoComplete="email"
            className="aksa-input"
            id="draft-to"
            onChange={(event) => setTo(event.target.value)}
            type="email"
            value={to}
          />
        </div>

        <div className="aksa-field">
          <label className="aksa-label" htmlFor="draft-subject">
            {m.mail_draft_subject({}, options)}
          </label>
          <input
            className="aksa-input"
            id="draft-subject"
            onChange={(event) => setSubject(event.target.value)}
            type="text"
            value={subject}
          />
        </div>

        <div className="aksa-field">
          <label className="aksa-label" htmlFor="draft-body">
            {m.mail_draft_body({}, options)}
          </label>
          <textarea
            className="aksa-textarea"
            id="draft-body"
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            value={body}
          />
        </div>

        <button
          className="aksa-button aksa-button--primary"
          disabled={!canDraft || to.trim() === "" || subject.trim() === "" || body.trim() === ""}
          onClick={() => onReviewDraft?.({ to: [to.trim()], subject: subject.trim(), body: body.trim() })}
          type="button"
        >
          {m.mail_draft_create({}, options)}
        </button>

        <p className="aksa-hint">{m.mail_no_send_note({}, options)}</p>
      </section>
    </div>
  );
}
