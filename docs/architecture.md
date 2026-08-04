# Foundation architecture

Use Bun only for installation, scripts, and one-off commands. Do not use npm, pnpm, or yarn.

## Boundaries

- `src/app/` contains App Router routes and shared layouts. Server Components are the default.
- `src/components/` contains reusable presentation. Client Components require browser APIs or local interaction state.
- `src/lib/server/db/` is reserved for the Turso and Drizzle data access layer.
- `src/lib/server/ai/` is reserved for server-only Vercel AI SDK provider abstractions.
- `src/lib/server/validation/` is reserved for Zod schemas at server boundaries.
- `src/lib/client/editor/` is reserved for TipTap editor behavior.
- `src/lib/client/vision/` is reserved for browser-only MediaPipe Tasks Vision behavior.
- `src/lib/client/state/` is reserved for justified cross-route client state.

No boundary above performs product work in this foundation.

## Localization

Paraglide compiles `messages/en.json` and `messages/id.json` into `src/paraglide/`. Components use generated message functions instead of hardcoded user-facing strings.
