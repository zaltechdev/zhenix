import { GoogleScreenshotEmbed } from "@/components/workspace/google-screenshot-embed";

export default async function FilesPage() {
  return (
    <div className="aksa-surface">
      <GoogleScreenshotEmbed app="drive" />
    </div>
  );
}
