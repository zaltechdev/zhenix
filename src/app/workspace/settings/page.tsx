import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { googleConfiguration, readGoogleConnection } from "@/lib/server/google/service";
import { googleConnectionCopy } from "@/lib/i18n/copy";
import { Panel, SurfaceHeader } from "@/components/workspace/surface-layout";
import { StatusChip } from "@/components/workspace/status-chip";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { AppearanceSettings } from "@/components/workspace/appearance-settings";

export default async function SettingsPage() {
  const locale = await getRequestLocale();
  const options = { locale };
  const connection = await readGoogleConnection();

  return (
    <div className="aksa-surface">
      <SurfaceHeader heading={m.settings_heading({}, options)} intro={m.settings_intro({}, options)} />

      <Panel heading={m.settings_language_heading({}, options)} locale={locale}>
        <LocaleSwitcher locale={locale} />
      </Panel>

      <Panel heading={m.settings_appearance_heading({}, options)} locale={locale}>
        <AppearanceSettings locale={locale} />
      </Panel>

      <Panel heading={m.settings_google_heading({}, options)} locale={locale}>
        <StatusChip
          label={m.google_connection_label({}, options)}
          tone={connection.state === "connected" ? "ready" : "neutral"}
          value={googleConnectionCopy(connection.state, locale)}
        />
        {googleConfiguration().configured ? (
          <a className="aksa-button aksa-button--secondary" href="/api/google/auth">
            {connection.state === "connected" ? m.google_reconnect({}, options) : m.google_connect({}, options)}
          </a>
        ) : (
          <p className="aksa-hint">{m.google_configuration_body({}, options)}</p>
        )}
      </Panel>
    </div>
  );
}
