import type { ReactNode } from "react";

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing-shell">
      {children}
    </div>
  );
}
