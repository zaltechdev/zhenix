import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function WelcomeHeader({ locale }: { locale: Locale }) {
  const options = { locale };

  return (
    <div className="aksa-welcome-header">
      <h1 className="aksa-welcome-header__heading" id="home-welcome-title">
        {m.home_welcome_title({}, options)}
      </h1>
      <p className="aksa-welcome-header__description">
        {m.home_welcome_description({}, options)}
      </p>
    </div>
  );
}
