import { GoogleScreenshotEmbed } from "@/components/workspace/google-screenshot-embed";

export default async function SlidesPage() {
  return (
    <div className="aksa-surface">
      <GoogleScreenshotEmbed app="slides" />
    </div>
  );
}
