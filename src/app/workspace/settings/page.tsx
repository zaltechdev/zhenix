import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleConfiguration, readGoogleConnection } from "@/lib/server/google/service";
import { authConfiguration } from "@/lib/server/auth/service";
import {
  databaseStatus,
  groundedSearchStatus,
  primaryProviderStatus
} from "@/lib/server/config/runtime-config";
import { googleConnectionCopy } from "@/lib/i18n/copy";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { StatusChip } from "@/components/workspace/status-chip";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function SettingsPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const connection = await readGoogleConnection();

  /**
   * Variable names only, never values. The names are already documented in
   * `.env.example`, so listing what is missing leaks nothing.
   */
  const configurationAreas = [
    { label: m.capability_account_session({}, options), status: authConfiguration() },
    { label: m.capability_settings_persistence({}, options), status: databaseStatus() },
    { label: m.capability_agent_execution({}, options), status: primaryProviderStatus() },
    { label: m.capability_grounded_search({}, options), status: groundedSearchStatus() },
    { label: m.google_connection_heading({}, options), status: googleConfiguration() }
  ];

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.settings_heading({}, options)} intro={m.settings_intro({}, options)} />

      <Panel heading={m.settings_language_heading({}, options)} locale={locale}>
        <LocaleSwitcher locale={locale} />
      </Panel>

      <Panel heading={m.settings_appearance_heading({}, options)} locale={locale}>
        <ThemeToggle locale={locale} />
      </Panel>

      <Panel heading={m.settings_google_heading({}, options)} locale={locale}>
        <StatusChip
          label={m.google_connection_label({}, options)}
          tone={connection.state === "connected" ? "ready" : "neutral"}
          value={googleConnectionCopy(connection.state, locale)}
        />
        <p className="aksa-hint">{m.google_connection_read_only_note({}, options)}</p>
        <button className="aksa-button aksa-button--secondary" disabled type="button">
          {m.google_connect({}, options)}
        </button>
        <p className="aksa-hint">{m.error_not_configured({}, options)}</p>
      </Panel>

      <Panel
        description={m.settings_deployment_intro({}, options)}
        heading={m.settings_deployment_heading({}, options)}
        locale={locale}
      >
        <ul className="aksa-capabilities__list">
          {configurationAreas.map((area) => (
            <li className="aksa-capabilities__item" key={area.label}>
              <span className="aksa-capabilities__name">{area.label}</span>
              <StatusChip
                tone={area.status.configured ? "ready" : "blocked"}
                value={
                  area.status.configured
                    ? m.capability_state_available({}, options)
                    : m.state_missing_configuration(
                        { keys: area.status.missingKeys.join(", ") },
                        options
                      )
                }
              />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
