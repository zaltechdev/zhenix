"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Layers, Sparkles } from "lucide-react";

type GoogleScreenshotApp = "docs" | "sheets" | "slides" | "drive" | "gmail";

const screenshots: Record<GoogleScreenshotApp, { src: string; alt: string; width: number; height: number; title: string; route: string }> = {
  docs: {
    src: "/google-embeds/docs.png",
    alt: "Google Docs interface embedded in Aksa",
    title: "Google Docs",
    route: "/workspace/documents",
    width: 1919,
    height: 939
  },
  sheets: {
    src: "/google-embeds/sheets.png",
    alt: "Google Sheets interface embedded in Aksa",
    title: "Google Sheets",
    route: "/workspace/sheets",
    width: 1919,
    height: 940
  },
  slides: {
    src: "/google-embeds/slides.png",
    alt: "Google Slides interface embedded in Aksa",
    title: "Google Slides",
    route: "/workspace/slides",
    width: 1919,
    height: 924
  },
  drive: {
    src: "/google-embeds/drive.png",
    alt: "Google Drive interface embedded in Aksa",
    title: "Google Drive",
    route: "/workspace/files",
    width: 1919,
    height: 942
  },
  gmail: {
    src: "/google-embeds/gmail.png",
    alt: "Gmail interface embedded in Aksa",
    title: "Gmail",
    route: "/workspace/mail",
    width: 1794,
    height: 877
  }
};

export function GoogleScreenshotEmbed({ app }: { app: GoogleScreenshotApp }) {
  const screenshot = screenshots[app];
  const [interactiveMode, setInteractiveMode] = useState(false);

  return (
    <div
      aria-label={screenshot.alt}
      className="aksa-screenshot-container"
      data-google-screenshot={app}
      style={{
        borderRadius: "24px",
        overflow: "hidden",
        width: "100%",
        border: "1px solid var(--color-aksa-line)",
        background: "var(--color-aksa-cloud)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--color-aksa-line)",
          background: "var(--color-aksa-paper)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles aria-hidden="true" className="aksa-icon aksa-icon--sm" />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{screenshot.title} Workspace Canvas</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            className={`aksa-button aksa-button--sm ${interactiveMode ? "aksa-button--primary" : "aksa-button--secondary"}`}
            onClick={() => setInteractiveMode(!interactiveMode)}
            type="button"
          >
            <Layers aria-hidden="true" className="aksa-icon aksa-icon--sm" />
            <span>{interactiveMode ? "Visual Capture" : "Interactive Shell"}</span>
          </button>
          <Link
            className="aksa-button aksa-button--secondary aksa-button--sm"
            href={screenshot.route as never}
          >
            <ExternalLink aria-hidden="true" className="aksa-icon aksa-icon--sm" />
            <span>Open Surface</span>
          </Link>
        </div>
      </div>
      <div style={{ position: "relative", width: "100%" }}>
        <Image
          alt={screenshot.alt}
          height={screenshot.height}
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          src={screenshot.src}
          style={{ display: "block", height: "auto", width: "100%" }}
          width={screenshot.width}
        />
      </div>
    </div>
  );
}
