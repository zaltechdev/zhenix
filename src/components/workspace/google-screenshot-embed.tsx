import Image from "next/image";

type GoogleScreenshotApp = "docs" | "sheets" | "slides" | "drive" | "gmail";

const screenshots: Record<GoogleScreenshotApp, { src: string; alt: string; width: number; height: number }> = {
  docs: {
    src: "/google-embeds/docs.png",
    alt: "Google Docs interface embedded in Aksa",
    width: 1919,
    height: 939
  },
  sheets: {
    src: "/google-embeds/sheets.png",
    alt: "Google Sheets interface embedded in Aksa",
    width: 1919,
    height: 940
  },
  slides: {
    src: "/google-embeds/slides.png",
    alt: "Google Slides interface embedded in Aksa",
    width: 1919,
    height: 924
  },
  drive: {
    src: "/google-embeds/drive.png",
    alt: "Google Drive interface embedded in Aksa",
    width: 1919,
    height: 942
  },
  gmail: {
    src: "/google-embeds/gmail.png",
    alt: "Gmail interface embedded in Aksa",
    width: 1794,
    height: 877
  }
};

export function GoogleScreenshotEmbed({ app }: { app: GoogleScreenshotApp }) {
  const screenshot = screenshots[app];

  return (
    <div
      aria-label={screenshot.alt}
      data-google-screenshot={app}
      style={{ borderRadius: "24px", overflow: "hidden", width: "100%" }}
    >
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
  );
}
