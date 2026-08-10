import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function WelcomeHeader({
  locale,
  headingLevel = "h1",
  headingId = "home-welcome-title"
}: {
  locale: Locale;
  headingLevel?: "h1" | "h2";
  headingId?: string;
}) {
  const options = { locale };
  const Heading = headingLevel;

  return (
    <div className="aksa-welcome-header">
      <Heading className="aksa-welcome-header__heading" id={headingId}>
        {m.home_welcome_title({}, options)}
      </Heading>
      <p className="aksa-welcome-header__description">
        {m.home_welcome_description({}, options)}
      </p>
    </div>
  );
}
