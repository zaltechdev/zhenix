import { Suspense } from "react";
import { GoogleGmailView } from "@/components/workspace/google-gmail-view";

export default function MailPage() {
  return (
    <Suspense fallback={null}>
      <GoogleGmailView />
    </Suspense>
  );
}
