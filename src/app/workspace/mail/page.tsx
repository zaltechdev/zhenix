import { GoogleScreenshotEmbed } from "@/components/workspace/google-screenshot-embed";

export default async function MailPage() {
  return (
    <div className="aksa-surface">
      <GoogleScreenshotEmbed app="gmail" />
    </div>
  );
}
