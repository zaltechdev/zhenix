import type { ReactNode } from "react";
import { getRequestLocale } from "@/lib/i18n/request";
import { AccessibilityWidget } from "@/components/shared/accessibility-widget";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <div className="aksa-auth-shell">
      <AuthSplitLayout visual={<AuthVisualPanel />}>
        {children}
      </AuthSplitLayout>

      <AccessibilityWidget locale={locale} />
    </div>
  );
}
