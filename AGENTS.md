# Repository Guidelines

## Project Structure & Module Organization
The app uses Next.js 15 with the App Router. Routes, pages, and API handlers sit under `app/`; `app/layout.tsx` and `app/globals.css` define shared shell styling. UI building blocks are grouped in `components/` (map, trip, auth, modals), while state, hooks, and Supabase helpers live in `lib/`. Cross-feature types stay in `types/`, and planning artefacts reside in `docs/`. Provisioning instructions for Supabase are maintained in `SUPABASE_SETUP.md`; keep them aligned with deployed environments.

## Build, Test, and Development Commands
- `npm run dev` – start the Next dev server with hot reload.
- `npm run build` – produce the optimized Next build; run before tagging releases.
- `npm run start` – serve the production build locally for smoke checks.
- `npm run lint` / `npm run lint:fix` – apply ESLint (TS + Next) and optionally auto-fix.
- `npm run format:check` / `npm run format` – verify or enforce the Prettier profile.
- `npm run typecheck` – validate TypeScript against `tsconfig.json`.

## Coding Style & Naming Conventions
Rely on the ESLint + Prettier toolchain and avoid manual formatting overrides. Write components and hooks in `PascalCase` and `useCamelCase`, utilities in `camelCase`, and config constants in `SCREAMING_SNAKE_CASE`. Prefer explicit types for exported APIs, constrain `any` to integration edges, and order Tailwind classes from layout → spacing → color for readability. Prettier enforces two-space indentation throughout the repo.

## Testing Guidelines
Automated tests are not yet committed, but `@types/jest` is available. Co-locate new Jest + React Testing Library suites as `*.test.tsx` next to UI code and use `*.test.ts` for pure utilities. Target critical user flows (auth, trip save, map search) and run `npm run lint` plus `npm run typecheck` before submitting when tests are sparse.

## Commit & Pull Request Guidelines
History favours short, imperative commit subjects (e.g., `Add exploration tab system`). Keep summaries under 72 characters, expand context in the body, and group related changes. Pull requests should outline intent, link issues, attach screenshots for UX updates, call out Supabase or Mapbox configuration changes, and list QA steps. Tag reviewers who own the impacted feature area.

## Environment & Security Tips
Store secrets in `.env.local` only and document required keys in `.env.example`. Rotate Supabase keys using `SUPABASE_SETUP.md` when access shifts, and scope Mapbox tokens to development domains. Update `next.config.js` when adding external assets so that origin allow-lists stay intentional.
