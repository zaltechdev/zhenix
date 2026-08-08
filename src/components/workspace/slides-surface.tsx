"use client";

import Link from "next/link";
import { FileText, FolderOpen, Mail, Table2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function SlidesSurface({ locale }: { locale: Locale }) {
  const options = { locale };

  return (
    <div className="aksa-dashboard-card">
      <div className="aksa-dashboard-card__header">
        <h1 className="aksa-dashboard-card__title">
          {m.slides_unavailable_title({}, options)}
        </h1>
      </div>
      <p className="aksa-state-panel__body">
        {m.slides_unavailable_desc({}, options)}
      </p>
      <div className="aksa-surface-card__app-links">
        <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/documents">
          <FileText aria-hidden="true" className="aksa-icon" />
          <span>{m.nav_documents({}, options)}</span>
        </Link>
        <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/sheets">
          <Table2 aria-hidden="true" className="aksa-icon" />
          <span>{m.nav_sheets({}, options)}</span>
        </Link>
        <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/files">
          <FolderOpen aria-hidden="true" className="aksa-icon" />
          <span>{m.nav_files({}, options)}</span>
        </Link>
        <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/mail">
          <Mail aria-hidden="true" className="aksa-icon" />
          <span>{m.nav_mail({}, options)}</span>
        </Link>
      </div>
    </div>
  );
}
