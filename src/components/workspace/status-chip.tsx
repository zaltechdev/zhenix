import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock,
  Info,
  type LucideIcon
} from "lucide-react";

/**
 * Status chip.
 *
 * Status always carries an icon plus text, so meaning never depends on colour.
 * See `.agents/design.md` section 7 and `.agents/rules.md` section 12.
 */
export type StatusTone = "ready" | "pending" | "blocked" | "attention" | "neutral" | "info";

const toneIcons: Record<StatusTone, LucideIcon> = {
  ready: CheckCircle2,
  pending: Clock,
  blocked: CircleSlash,
  attention: AlertTriangle,
  neutral: CircleDashed,
  info: Info
};

export function StatusChip({
  tone,
  label,
  value,
  className
}: {
  tone: StatusTone;
  /** Optional preceding label so the value has context when read on its own. */
  label?: string;
  value: string;
  className?: string;
}) {
  const Icon = toneIcons[tone];

  return (
    <span className={`aksa-chip aksa-chip--${tone}${className ? ` ${className}` : ""}`} data-tone={tone}>
      <Icon aria-hidden="true" className="aksa-icon aksa-icon--sm" />
      {label ? <span className="aksa-chip__label">{label}</span> : null}
      <span className="aksa-chip__value">{value}</span>
    </span>
  );
}
