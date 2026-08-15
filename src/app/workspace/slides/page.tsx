import { Suspense } from "react";
import { GoogleSlidesView } from "@/components/workspace/google-slides-view";

export default function SlidesPage() {
  return (
    <Suspense fallback={null}>
      <GoogleSlidesView />
    </Suspense>
  );
}
