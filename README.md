# Aksa

> **Accessible AI Workspace** — Computer Vision + AI Agents + Accessibility  
> Live at [https://aksawork.web.id](https://aksawork.web.id)

Aksa is a web-only accessible workspace empowering users with motor, speech, and physical impairments to navigate, write, search, and manage Google Workspace documents hands-free.

---

## Key Capabilities

- **Head Tracking & Gestures**: On-device MediaPipe Face Mesh vision engine for hands-free cursor control, dwell clicking, smile triggers, rest-lock stability, and customized head calibration.
- **Continuous Live Voice**: Real-time bilingual (EN/ID) speech recognition with continuous listening, localized intent routing, and automatic 3-second execution countdown.
- **Autonomous AI Document Agents**: Context-aware Google Docs & Drive reader/writer that plans, drafts, translates, and edits documents with a safe 5-second auto-confirmation gate.
- **Accessibility by Design**: Fully WCAG 2.2 AAA compliant with high-contrast themes, screen-reader landmarks, adaptive keyboard shortcuts, and zero-flicker transitions.

---

## Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Runtime & Tooling**: Bun (`bun`, `bunx`)
- **Computer Vision**: `@mediapipe/tasks-vision` (client-side WebAssembly face mesh)
- **AI & Agent Orchestration**: Google AI Studio / Gemini API & deterministic fallback planner
- **Database & Auth**: LibSQL / SQLite with Drizzle ORM & Better-Auth (Google OAuth + Email)
- **Internationalization**: Paraglide JS (Bilingual English / Indonesian)
- **Styling**: Tailwind CSS & Aksa Semantic Design Tokens
- **Testing**: Vitest (465+ unit & integration tests) & Playwright (E2E)

---

## Quickstart

Use **Bun** exclusively for all commands:

```bash
# Install dependencies & compile i18n
bun install

# Run development server
bun run dev

# Run quality checks
bun run lint
bun run typecheck
bun run test
bun run build
```

---

## Architecture Overview

```text
src/
├── app/                  # Next.js App Router routes & API endpoints
├── components/           # UI components (workspace, vision, controls, accessibility)
├── lib/
│   ├── contracts/        # Shared Zod schemas, types & API boundaries
│   ├── client/           # Vision engine, head tracking, audio & client controllers
│   ├── server/           # Better-Auth, Drizzle DB, Google workflow & AI agent runner
│   └── paraglide/        # Compiled type-safe bilingual translations (EN/ID)
└── tests/                # Unit, integration, and E2E test suites
```

---

## License

Private repository developed for BitsMikro Innovative VibeCode Competition.
