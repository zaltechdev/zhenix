"use client";

import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { CapabilityAvailability, CapabilityName } from "@/lib/contracts/capability";
import { capabilityCopy, capabilityStateCopy } from "@/lib/i18n/copy";
import { isSpeechRecognitionSupported } from "@/lib/client/voice/speech-recognition";
import { useBrowserValue } from "@/lib/client/state/use-browser-value";
import { StatusChip, type StatusTone } from "@/components/workspace/status-chip";

/**
 * Browser-detected capabilities.
 *
 * Voice, camera, and head pointing cannot be answered by the server, so they are
 * probed here and reported with the same vocabulary as the server snapshot. The probe
 * runs through an external store rather than by writing state from an effect, so
 * nothing is claimed before the browser has answered.
 */
const toneForAvailability: Record<CapabilityAvailability, StatusTone> = {
  available: "ready",
  connection_required: "attention",
  scope_required: "attention",
  not_configured: "blocked",
  unsupported: "neutral",
  unavailable: "blocked"
};

function readCameraSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function BrowserCapabilities({ locale }: { locale: Locale }) {
  const voiceSupported = useBrowserValue(isSpeechRecognitionSupported, false);
  const cameraSupported = useBrowserValue(readCameraSupport, false);

  const probes: { name: CapabilityName; availability: CapabilityAvailability }[] = [
    {
      name: "voice_input",
      availability: voiceSupported ? "available" : "unsupported"
    },
    {
      name: "camera_input",
      availability: cameraSupported ? "available" : "unsupported"
    },
    {
      name: "head_pointer",
      availability: cameraSupported ? "available" : "unsupported"
    }
  ];

  return (
    <ul aria-label={m.capability_list_label({}, { locale })} className="aksa-capabilities__list">
      {probes.map((probe) => (
        <li className="aksa-capabilities__item" key={probe.name}>
          <span className="aksa-capabilities__name">{capabilityCopy(probe.name, locale)}</span>
          <StatusChip
            tone={toneForAvailability[probe.availability]}
            value={capabilityStateCopy(probe.availability, locale)}
          />
        </li>
      ))}
    </ul>
  );
}
