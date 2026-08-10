import { GoogleScreenshotEmbed } from "@/components/workspace/google-screenshot-embed";

/**
 * Documents workspace page.
 *
 * The PoC version uses a client component for the full document surface,
 * since it needs interactivity for Google Picker, editing, and save flow.
 * The server component provides locale and wraps in Suspense for
 * useSearchParams compatibility.
 */
export default async function DocumentsPage() {
  return (
    <div className="aksa-surface">
      <GoogleScreenshotEmbed app="docs" />
    </div>
  );
}
