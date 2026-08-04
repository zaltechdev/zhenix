import { getRequestLocale } from "@/lib/i18n/request";
import { m } from "@/paraglide/messages.js";

export default async function Loading() {
  const locale = await getRequestLocale();

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <p aria-busy="true" className="text-sm text-muted">
        {m.foundation_ready({}, { locale })}
      </p>
    </main>
  );
}
