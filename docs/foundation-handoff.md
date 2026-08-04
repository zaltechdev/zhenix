# Aksa foundation handoff

## Scope

Initialized the minimal Aksa project foundation on branch `dev` using Bun only. This handoff captures the scaffold scope and verification baseline.

Existing `AGENTS.md`, `.agents/` guidance, and logo assets were preserved. The supplied hero PNG was inspected and left unchanged because the full landing page is out of scope.

## Changed files

- Project setup: `package.json`, `bun.lock`, `.gitignore`, `.env.example`, `README.md`, `docs/architecture.md`
- Localization: `project.inlang/settings.json`, `messages/en.json`, `messages/id.json`
- Next.js and deployment: `next-env.d.ts`, `tsconfig.json`, `next.config.ts`, `src/proxy.ts`, `vercel.json`
- Styling: `src/app/globals.css`, `postcss.config.mjs`
- App shell: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`
- Shared UI: `src/components/foundation/foundation-view.tsx`, `src/components/shared/locale-switcher.tsx`
- Configuration boundaries: `drizzle.config.ts`, `src/lib/i18n/request.ts`, `src/lib/server/db/`, `src/lib/server/ai/`, `src/lib/server/validation/`, `src/lib/client/editor/`, `src/lib/client/vision/`, `src/lib/client/state/`
- Test setup: `vitest.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `tests/unit/foundation.test.tsx`, `tests/e2e/foundation.spec.ts`
- Execution log: `logs/log-{devname}.md` (`logs/log-henix.md`, `logs/log-zaltech.md`)

## Commands run

```text
bun install
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
git diff --check
bun pm untrusted
```

## Verification

- Bun installed the exact pinned dependency versions and compiled Paraglide messages.
- ESLint passed with zero warnings.
- Strict TypeScript passed.
- Vitest passed: 1 test file and 1 test.
- Playwright passed: 2 browser tests, including Indonesian locale switching.
- Next.js production build passed with a dynamic App Router route and Vercel-compatible proxy.
- Diff hygiene passed.
- New project files contain no em dash or en dash characters.

## Unresolved risks

- Authentication, database schema and migrations, AI agents, Google APIs, MediaPipe behavior, and the full landing page remain intentionally unimplemented.
- Bun blocked the `unrs-resolver@1.12.2` postinstall script. Current lint, typecheck, tests, and build pass; review package trust before relying on native tooling.
- English is the Paraglide base locale until the documented default-locale decision is resolved.
- Security headers are foundational. Authentication, route authorization, and feature-specific CSP allowances still require backend and integration work.
