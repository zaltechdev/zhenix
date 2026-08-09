import type { ReactNode } from "react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="aksa-auth-shell">
      <AuthSplitLayout visual={<AuthVisualPanel />}>
        {children}
      </AuthSplitLayout>
    </div>
  );
}
