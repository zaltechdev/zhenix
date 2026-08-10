import { GoogleScreenshotEmbed } from "@/components/workspace/google-screenshot-embed";

export default async function SheetsPage() {
  return (
    <div className="aksa-surface">
      <GoogleScreenshotEmbed app="sheets" />
    </div>
  );
}
