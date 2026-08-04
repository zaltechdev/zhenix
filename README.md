# Aksa

Aksa is a web-only accessible AI workspace anchored in computer vision, AI agents, and accessibility.

## Package manager

Use Bun only for this project. Run `bun install`, `bun run <script>`, and `bunx <tool>`. Do not use npm, pnpm, or yarn.

## Foundation

This branch contains minimal Next.js App Router scaffolding with strict TypeScript, Server Components by default, Tailwind CSS, Paraglide JS, Host Grotesk, Inter, Vitest, Playwright, ESLint, and Vercel configuration.

The dependency surface is prepared for Turso/libSQL, Drizzle ORM, Zod, the Vercel AI SDK, TipTap, and MediaPipe Tasks Vision. No authentication, database, AI agent, Google API, MediaPipe feature, or full landing page is implemented yet.

Zustand is intentionally not installed until cross-route client state is justified. Prefer React state for local interaction state.

## Commands

```text
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

Translation files live in `messages/`. Paraglide output is generated in `src/paraglide/` during install and verification scripts.

Existing logo assets and `.agents/` guidance documents remain unchanged by the foundation.
