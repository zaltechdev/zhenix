"use client";

import { m } from "@/paraglide/messages.js";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <div className="max-w-md space-y-5 text-center">
        <h1 className="font-heading text-3xl font-semibold">{m.foundation_title()}</h1>
        <button
          type="button"
          className="min-h-11 rounded-control bg-teal px-4 text-sm font-semibold text-ink"
          onClick={reset}
        >
          {m.foundation_ready()}
        </button>
      </div>
    </main>
  );
}
