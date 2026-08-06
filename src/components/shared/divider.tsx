import type { ReactNode } from "react";

export function Divider({ label, className }: { label?: ReactNode; className?: string }) {
  return (
    <div className={`aksa-divider${className ? ` ${className}` : ""}`} role="separator">
      {label ? <span>{label}</span> : null}
    </div>
  );
}
