import { getRequestLocale } from "@/lib/i18n/request";
import { m } from "@/paraglide/messages.js";

export default async function Loading() {
  const locale = await getRequestLocale();

  return (
    <main aria-busy="true" className="aksa-loading-shell bg-paper px-5 text-ink">
      <span aria-live="polite" className="sr-only" role="status">
        {m.state_loading({}, { locale })}
      </span>
      <div className="aksa-loading-shell__header">
        <span className="aksa-loading-skeleton aksa-loading-skeleton--brand" />
        <span className="aksa-loading-skeleton aksa-loading-skeleton--control" />
      </div>
      <section className="aksa-loading-shell__card">
        <span className="aksa-loading-skeleton aksa-loading-skeleton--eyebrow" />
        <span className="aksa-loading-skeleton aksa-loading-skeleton--heading" />
        <span className="aksa-loading-skeleton aksa-loading-skeleton--copy" />
        <span className="aksa-loading-skeleton aksa-loading-skeleton--copy aksa-loading-skeleton--copy-short" />
        <div className="aksa-loading-shell__fields">
          <span className="aksa-loading-skeleton aksa-loading-skeleton--field" />
          <span className="aksa-loading-skeleton aksa-loading-skeleton--field" />
        </div>
      </section>
    </main>
  );
}
