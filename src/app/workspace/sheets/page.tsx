import { Suspense } from "react";
import { GoogleSheetsView } from "@/components/workspace/google-sheets-view";

export default function SheetsPage() {
  return (
    <Suspense fallback={null}>
      <GoogleSheetsView />
    </Suspense>
  );
}
