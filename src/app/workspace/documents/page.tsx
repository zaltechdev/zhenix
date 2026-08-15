import { Suspense } from "react";
import { GoogleDocsView } from "@/components/workspace/google-docs-view";

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <GoogleDocsView />
    </Suspense>
  );
}
