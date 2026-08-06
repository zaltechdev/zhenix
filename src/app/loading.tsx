import { getRequestLocale } from "@/lib/i18n/request";
import { m } from "@/paraglide/messages.js";

export default async function Loading() {
  const locale = await getRequestLocale();

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <div aria-busy="true" className="flex items-center gap-3 text-sm text-muted">
        <span className="aksa-button__loading-indicator" />
        <span>{m.state_loading({}, { locale })}</span>
      </div>
    </main>
  );
}
