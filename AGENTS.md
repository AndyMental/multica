# Repository Guidelines

This file gives AI agents the repo-local commands and conventions needed to work in this checkout. For deeper architecture and coding rules, read `CLAUDE.md` after this file. For contributor workflow details, read `CONTRIBUTING.md`.

## Stack Detection

This is a mixed Go and TypeScript monorepo.

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `turbo.json` identify the pnpm workspace and Turborepo frontend/tooling.
- `server/go.mod` identifies the Go backend module (`github.com/multica-ai/multica/server`).
- `apps/web/` is a Next.js App Router app.
- `apps/desktop/` is an Electron desktop app.
- `apps/mobile/` is an Expo / React Native app with its own additional rules in `apps/mobile/CLAUDE.md`.
- `packages/core/`, `packages/ui/`, and `packages/views/` are shared workspace packages.

## Local Dependencies

Documented prerequisites from `CONTRIBUTING.md`:

- Node.js `v20+` for local development. CI currently runs frontend checks on Node `22`.
- pnpm `v10.28+`; the root `package.json` pins `pnpm@10.28.2`.
- Go `v1.26+`; CI uses Go `1.26.1`.
- Docker, used for the shared PostgreSQL container.

Heavy runtime requirements:

- Local app verification expects PostgreSQL on `localhost:5432`, managed by the repo's Docker Compose targets and scripts.
- Backend CI also starts Redis `7-alpine` for Redis-backed test coverage.
- Full `make check` runs TypeScript checks, TS tests, Go tests, starts backend/frontend if needed, and runs Playwright E2E tests.

## Setup And Run

Use the Makefile targets; do not hand-roll setup.

```bash
make dev
```

`make dev` auto-detects main checkout vs worktree, creates the appropriate env file, installs dependencies, ensures PostgreSQL is running, runs migrations, and starts backend plus frontend.

Explicit main-checkout flow:

```bash
cp .env.example .env
make setup-main
make start-main
make stop-main
```

Explicit worktree flow:

```bash
make worktree-env
make setup-worktree
make start-worktree
make stop-worktree
```

Generic current-checkout targets, once a valid `.env` or `.env.worktree` exists:

```bash
make setup
make start
make stop
make db-up
make db-down
make migrate-up
make migrate-down
```

Single-service and utility targets:

```bash
make server
make daemon
make cli ARGS="config"
make build
make sqlc
```

Frontend package scripts from the root `package.json`:

```bash
pnpm install
pnpm dev:web
pnpm dev:docs
pnpm dev:desktop
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm generate:reserved-slugs
```

Mobile scripts exist but should be used only after reading `apps/mobile/CLAUDE.md`:

```bash
pnpm dev:mobile
pnpm dev:mobile:staging
pnpm ios:mobile
pnpm ios:mobile:staging
pnpm ios:mobile:device
pnpm ios:mobile:device:staging
```

## Verification

Run the narrowest relevant checks while iterating, then use the documented full check when the blast radius requires it.

Full local verification:

```bash
make check
```

Main checkout and worktree variants:

```bash
make check-main
make check-worktree
```

Targeted checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
make test
cd server && go test ./internal/handler/ -run TestName
pnpm --filter @multica/views exec vitest run auth/login-page.test.tsx
pnpm --filter @multica/core exec vitest run runtimes/version.test.ts
pnpm --filter @multica/web exec vitest run app/\(auth\)/login/page.test.tsx
pnpm exec playwright test e2e/tests/specific-test.spec.ts
```

`make check` runs `scripts/check.sh`: PostgreSQL setup, `pnpm typecheck`, `pnpm test`, migrations, `go test ./...`, backend/frontend startup if needed, and Playwright E2E.

CI also verifies:

```bash
pnpm generate:reserved-slugs
git diff --exit-code -- packages/core/paths/reserved-slugs.ts
pnpm exec turbo build typecheck lint test --filter='!@multica/docs' --filter='!@multica/mobile'
cd server && go build ./...
cd server && go run ./cmd/migrate up
cd server && go test ./...
bash scripts/install.test.sh
```

## Architecture Rules

- React Query owns server state; Zustand owns client state.
- Shared Zustand stores live in `packages/core/`, not app directories or `packages/views/`.
- Web and desktop share business logic through `packages/core/`, `packages/ui/`, and `packages/views/`.
- `packages/core/` must not depend on `react-dom`, `localStorage`, `process.env`, or UI libraries.
- `packages/ui/` must not import `@multica/core`.
- `packages/views/` must not import `next/*`, `react-router-dom`, or stores; use the navigation adapter.
- `apps/web/platform/` is the only place for Next.js APIs.
- `apps/desktop/src/renderer/src/platform/` is the only place for desktop router wiring.
- Mobile is independent; read `apps/mobile/CLAUDE.md` before touching `apps/mobile/`.

## Contribution Expectations

- Work on feature branches only. Never push directly to default branches.
- Keep each change focused on one issue and one reviewable diff.
- Follow upstream contribution guidance in `CONTRIBUTING.md` and the PR checklist in `.github/PULL_REQUEST_TEMPLATE.md`.
- Before pushing, validate with `make check-main` from a main checkout or `make check-worktree` from a worktree when runtime dependencies are available.
- If full verification is too heavy or blocked by missing local dependencies, run the relevant targeted checks and state exactly what could not run.
- Use atomic commits with the conventional formats listed in `CLAUDE.md`, such as `feat(scope)`, `fix(scope)`, `refactor(scope)`, `docs`, `test(scope)`, or `chore(scope)`.
- Open one focused upstream PR per issue; do not merge or approve your own work.

## Documentation Pointers

- `CONTRIBUTING.md` has the source of truth for local setup, worktree env files, shared PostgreSQL behavior, testing, and troubleshooting.
- `CLAUDE.md` has the source of truth for architecture, package boundaries, coding rules, API response compatibility, UUID parsing, and release notes.
- `apps/docs/content/docs/developers/conventions.mdx` and `apps/docs/content/docs/developers/conventions.zh.mdx` define naming, i18n glossary, and Chinese product copy rules.
