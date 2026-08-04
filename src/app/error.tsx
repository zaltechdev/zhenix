"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <div className="max-w-md space-y-5 text-center">
        <h1 className="font-heading text-3xl font-semibold">
          Sesuatu tidak berjalan sesuai rencana
        </h1>
        <p className="text-muted text-sm">
          Aksa mengalami kendala saat memuat halaman ini. Silakan coba muat ulang.
        </p>
        <button
          type="button"
          className="min-h-11 rounded-control bg-teal px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          onClick={reset}
        >
          Muat ulang halaman
        </button>
      </div>
    </main>
  );
}
