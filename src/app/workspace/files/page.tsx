import { Suspense } from "react";
import { GoogleDriveView } from "@/components/workspace/google-drive-view";

export default function FilesPage() {
  return (
    <Suspense fallback={null}>
      <GoogleDriveView />
    </Suspense>
  );
}
