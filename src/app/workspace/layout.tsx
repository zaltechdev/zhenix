import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18n/request";
import { readWorkspaceContext } from "@/lib/server/workspace/service";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * The workspace layout reads its context from the server service layer directly.
 * It does not call Aksa's own Route Handlers, so the shell costs no internal HTTP
 * round trip. See `.agents/rules.md` section 5.
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const context = await readWorkspaceContext();

  if (context.session.status !== "authenticated") {
    redirect("/sign-in");
  }

  return (
    <WorkspaceShell
      connection={context.connection}
      initialProfile={context.accessibilityProfile}
      initialPreferences={context.preferences}
      locale={locale}
      session={context.session}
    >
      {children}
    </WorkspaceShell>
  );
}
