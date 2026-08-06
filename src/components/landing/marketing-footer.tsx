import Image from "next/image";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import DefaultLogo from "../../../logo/Default.svg";

function PendingFooterItem({ label, locale }: { label: string; locale: Locale }) {
  return (
    <span
      aria-label={m.footer_unresolved_destination({ label }, { locale })}
      className="marketing-footer__pending"
      title={m.footer_unresolved_destination({ label }, { locale })}
    >
      {label}
    </span>
  );
}

export function MarketingFooter({ locale }: { locale: Locale }) {
  const options = { locale };

  return (
    <footer className="marketing-footer">
      <div className="marketing-footer__inner">
        <div className="marketing-footer__brand">
          <a className="marketing-footer__logo" href="#top">
            <Image alt={m.navigation_home_label({}, options)} height={32} src={DefaultLogo} width={100} />
          </a>
          <p>{m.footer_description({}, options)}</p>
        </div>

        <nav aria-label={m.footer_navigation_label({}, options)} className="marketing-footer__links">
          <a href="#features">{m.navigation_features({}, options)}</a>
          <a href="#how-it-works">{m.navigation_how_it_works({}, options)}</a>
          <a href="#faq">{m.navigation_faq({}, options)}</a>
          <a href="#accessibility">{m.footer_accessibility({}, options)}</a>
          <PendingFooterItem label={m.footer_safety({}, options)} locale={locale} />
          <PendingFooterItem label={m.footer_privacy({}, options)} locale={locale} />
          <PendingFooterItem label={m.footer_terms({}, options)} locale={locale} />
        </nav>

        <div className="marketing-footer__controls">
          <LocaleSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
        </div>

        <p className="marketing-footer__copyright">{m.footer_copyright({}, options)}</p>
      </div>
    </footer>
  );
}
