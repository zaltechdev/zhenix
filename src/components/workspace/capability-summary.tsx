import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import {
  countAvailableCapabilities,
  type CapabilityAvailability,
  type CapabilitySnapshot
} from "@/lib/contracts/capability";
import { capabilityCopy, capabilityStateCopy, formatCount } from "@/lib/i18n/copy";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";
import { BrowserCapabilities } from "@/components/workspace/browser-capabilities";

const toneForAvailability: Record<CapabilityAvailability, StatusTone> = {
  available: "ready",
  connection_required: "attention",
  scope_required: "attention",
  not_configured: "blocked",
  unsupported: "neutral",
  unavailable: "blocked"
};

/**
 * Honest capability list.
 *
 * Server-determined capabilities come from the snapshot. Browser capabilities are
 * detected in the client below, because the server cannot know them.
 */
export function CapabilitySummary({
  snapshot,
  locale
}: {
  snapshot: CapabilitySnapshot;
  locale: Locale;
}) {
  const options = { locale };
  const ready = countAvailableCapabilities(snapshot);

  return (
    <div className="aksa-capabilities">
      <p className="aksa-capabilities__count">
        {m.capability_summary_count(
          {
            ready: formatCount(ready, locale),
            total: formatCount(snapshot.capabilities.length, locale)
          },
          options
        )}
      </p>

      <ul aria-label={m.capability_list_label({}, options)} className="aksa-capabilities__list">
        {snapshot.capabilities.map((capability) => (
          <li className="aksa-capabilities__item" key={capability.name}>
            <span className="aksa-capabilities__name">{capabilityCopy(capability.name, locale)}</span>
            <StatusChip
              tone={toneForAvailability[capability.availability]}
              value={capabilityStateCopy(capability.availability, locale)}
            />
          </li>
        ))}
      </ul>

      <BrowserCapabilities locale={locale} />
      <p className="aksa-hint">{m.home_capability_note({}, options)}</p>
    </div>
  );
}
