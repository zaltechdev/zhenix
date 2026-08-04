import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function FoundationView({ locale }: { locale: Locale }) {
  const foundationItems = [
    () => m.foundation_nextjs({}, { locale }),
    () => m.foundation_styling({}, { locale }),
    () => m.foundation_localization({}, { locale }),
    () => m.foundation_testing({}, { locale })
  ];

  return (
    <main id="main-content" className="min-h-screen bg-paper px-5 py-8 text-ink sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line pb-5">
          <span className="font-heading text-xl font-semibold tracking-tight">Aksa</span>
          <LocaleSwitcher />
        </header>

        <section className="flex flex-1 flex-col justify-center gap-8 py-16 lg:py-24">
          <div className="max-w-3xl space-y-5">
            <h1 className="font-heading text-4xl font-semibold leading-h1 tracking-tight sm:text-6xl">
              {m.foundation_title({}, { locale })}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              {m.foundation_description({}, { locale })}
            </p>
          </div>

          <div
            className="flex w-fit items-center gap-3 rounded-control border border-teal bg-teal-soft px-4 py-3 text-sm font-semibold"
            role="status"
          >
            <span aria-hidden="true" className="text-teal">
              ✓
            </span>
            <span>{m.foundation_ready({}, { locale })}</span>
          </div>

          <section aria-labelledby="foundation-boundaries" className="max-w-3xl space-y-5">
            <h2 id="foundation-boundaries" className="font-heading text-2xl font-semibold sm:text-3xl">
              {m.foundation_status_heading({}, { locale })}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {foundationItems.map((item, index) => (
                <li
                  key={index}
                  className="rounded-card border border-line bg-cloud p-5 text-sm leading-relaxed text-muted shadow-raised"
                >
                  {item()}
                </li>
              ))}
            </ul>
          </section>
        </section>

        <footer className="border-t border-line pt-5 text-sm leading-relaxed text-muted">
          {m.foundation_note({}, { locale })}
        </footer>
      </div>
    </main>
  );
}
