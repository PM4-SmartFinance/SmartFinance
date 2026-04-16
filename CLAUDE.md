# SmartFinance

A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions. Academic semester project (PM4) at ZHAW School of Engineering, developed by a team of 9 students over 12 weeks.

## Tech Stack

- **Frontend:** React (TypeScript), Vite, PWA
- **Backend:** Node.js, Fastify 5, REST API
- **Database:** PostgreSQL with ORM (Prisma or TypeORM)
- **State Management:** Zustand (client state), TanStack Query (server state)
- **Deployment:** Docker / Docker Compose
- **CI:** GitHub Actions (lint, test, Docker build on every PR to `main`/`develop`)

## Project Structure

```
frontend/      # React + TypeScript + Vite
backend/       # Node.js REST API (controllers, services, repositories)
docker/        # Docker configuration
wiki/          # Project documentation (separate git repo, not part of main codebase)
```

## Architecture

Layered client-server architecture with clear separation of concerns:

1. **Presentation Layer** — React frontend (UI only, no business logic)
2. **API Layer** — REST API under `/api/v1`, versioned via URL prefix
3. **Business Logic Layer** — Transaction processing, categorization engine, budget management
4. **Data Access Layer** — Repository pattern abstracting ORM, enforces transactional boundaries
5. **Persistence Layer** — PostgreSQL

All database access goes through the repository layer. No direct SQL from services or extensions. All write operations use explicit database transactions.

## Key Design Decisions

- **Authentication:** httpOnly cookie-based sessions, bcrypt/Argon2 password hashing, RBAC, optional TOTP 2FA
- **Backend is stateless** regarding request handling; persistent state lives in PostgreSQL only
- **Backend-side filtering/aggregation/pagination** — never load full datasets into the frontend
- **Extension architecture:** Modules register via defined interfaces, cannot access repository layer directly, cannot modify DB schema. Extensions use namespace-isolated JSON storage
- **Import pipeline:** CSV upload → importer selection → parsing → validation → normalization → categorization → persistence (all-or-nothing within DB transaction)

## API Endpoints

All endpoints under `/api/v1`. Authentication via httpOnly cookie session. RBAC enforced on all protected endpoints.

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET|POST /users`, `GET|PATCH|DELETE /users/:id` (admin only)
- `GET /transactions`, `GET|PATCH|DELETE /transactions/:id`, `POST /transactions/import`
- `GET|POST /categories`, `PATCH|DELETE /categories/:id`
- `GET|POST /budgets`, `PATCH|DELETE /budgets/:id`
- `GET /dashboard/summary|trends|categories`
- `/modules/:moduleName/...` (extension endpoints)

## Development Guidelines

- Follow SOLID principles, DRY, high cohesion / low coupling
- No business logic in React components — all processing in the backend
- Frontend does not access the database; all data flows through the REST API
- Centralized error handling middleware in the backend; no stack traces in production
- Input validation on all API endpoints (server-side)
- At least 70% test coverage on core business logic
- Semantic HTML, accessible form controls
- **All documentation, code comments, commit messages, and PR descriptions must be in English** — no exceptions
- Text resources (UI strings) separated from logic

## Frontend Best Practices

- **Every component must earn its place** — do not create wrapper components, layout components, or abstractions unless they encapsulate real logic or are reused in multiple places. Inline JSX is fine; premature componentization is not.
- **Colocation over separation** — keep styles, types, and helpers close to where they are used. Only extract shared code when there are two or more consumers.
- **Semantic HTML first** — use the correct HTML element before reaching for ARIA attributes. `<button>`, `<nav>`, `<main>`, `<section>`, `<dialog>` over `<div>` with roles.
- **CSS Modules or utility classes** — avoid CSS-in-JS runtime overhead. Keep styles scoped and predictable.
- **No barrel files** (`index.ts` re-exports) — import directly from the source file. Barrel files hurt tree-shaking and slow down builds.
- **Prefer `fetch`** — no Axios. The Fetch API is sufficient and avoids an extra dependency.
- **TypeScript strict mode** — no `any`, no type assertions unless truly unavoidable. Infer types where possible; annotate function signatures.

## React Best Practices

This project uses **React 19** (`react@^19.2.0`). Always use React 19 syntax and APIs.

- **`use()` over `useContext()`** — React 19's `use` hook is preferred for reading context. It is more flexible (can be called conditionally).
- **`<Context>` over `<Context.Provider>`** — React 19 supports rendering context directly as a provider.
- **Function components only** — no class components.
- **Named exports for components** — `export function DashboardPage()`, not `export default`.
- **No `React.FC`** — type props inline: `function Foo({ bar }: { bar: string })` or with a named `Props` interface for complex cases.
- **Server state via TanStack Query** — no `useEffect` + `useState` for data fetching. Use `useQuery` / `useMutation`.
- **Client state via Zustand** — no prop drilling or Context for global client state.
- **Minimize `useEffect`** — most effects are unnecessary. Derive values during render, use event handlers for side effects, use TanStack Query for data fetching.
- **Keep components pure** — no business logic in components. Components receive data and render UI.

## State Management

This project separates **server state** (data from the API) and **client state** (UI-only flags) into two dedicated tools. Never mix them — do not duplicate server data into Zustand, and do not fetch API data from a Zustand action.

### TanStack Query — server state

All data that originates from the backend is managed by TanStack Query (`@tanstack/react-query`).

- **Use `useQuery` for reads, `useMutation` for writes** — no `useEffect` + `useState` for data fetching.
- **Always use the `api` utility** (`src/lib/api.ts`) as the `queryFn` — it handles credentials, error normalization, and base URL.
- **`queryKey` conventions** — use descriptive arrays: `["dashboard", "summary"]`, `["transactions", { page, filter }]`. Nest by resource, then parameters.
- **Extract shared query config** — when multiple components need the same query, extract the config object so `queryKey` and `queryFn` stay in sync:
  ```ts
  const AUTH_QUERY = {
    queryKey: ["auth", "me"] as const,
    queryFn: () => api.get<User>("/auth/me"),
    retry: false,
  } as const;
  ```
- **Global defaults** are in `src/lib/queryClient.ts` — 30s `staleTime`, no retry on 401/403. Override per-query only when needed.
- **Error handling** — check `error instanceof ApiError` for typed access to `status` and `body`. The `api` utility throws `ApiError` for all non-2xx responses.

### Zustand — client state

Zustand manages UI-only state that has no server counterpart: sidebar visibility, modal flags, theme preference, etc.

- **Single store** in `src/store/appStore.ts` — add new slices as the app grows, keep it flat.
- **Use selectors** — always select the minimal slice: `useAppStore((s) => s.sidebarOpen)`, not `useAppStore()`. This prevents unnecessary re-renders.
- **No async actions** — Zustand stores should be synchronous. Data fetching belongs in TanStack Query.
- **No auth state** — authentication is server state owned by TanStack Query (see `useAuth()` in `src/contexts/AuthProvider.tsx`).

### API utility (`src/lib/api.ts`)

- Wraps `fetch` with `credentials: "include"` for cookie-based auth.
- Methods: `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.delete<T>()`.
- Throws `ApiError` (with `status`, `body`, `message`) on non-2xx responses.
- Handles `204 No Content` by returning `undefined`.

## Backend Best Practices

- **Layered architecture** — controllers handle HTTP, services hold business logic, repositories abstract data access. Never skip layers (e.g. no DB queries from controllers).
- **Controllers are thin** — parse request, call service, send response. No business logic, no direct DB access.
- **Services are framework-agnostic** — services must not import Fastify types. They receive plain data and return plain data. This keeps business logic testable without HTTP concerns.
- **Repository pattern** — all database access goes through repository functions. No raw SQL or ORM calls outside the repository layer.
- **All write operations use DB transactions** — wrap multi-step writes in explicit transactions to ensure atomicity.
- **Validate at the boundary** — validate all incoming request data (body, params, query) in controllers or via schemas. Services trust their inputs.
- **Centralized error handling** — throw errors in services, catch them in the error handler middleware. No try/catch in controllers unless there's controller-specific recovery logic.
- **No secrets in code** — all configuration via environment variables. Use `process.env` with a clear config module, never inline.
- **No stack traces in production** — the error handler returns generic messages for 5xx errors when `NODE_ENV=production`.
- **Named exports only** — `export function`, `export const`, never `export default`.

## Fastify Best Practices

This project uses **Fastify 5** (`fastify@^5.3.0`). Always use Fastify 5 APIs.

- **Plugin architecture** — register routes and features as Fastify plugins via `app.register()`. Group related routes into a single plugin with a shared prefix.
- **Use `buildApp()` pattern** — the app factory is in `src/app.ts`. Tests and the server entry point both call `buildApp()` to get a configured instance.
- **Route registration via plugins** — each controller file exports an `async function(app: FastifyInstance)` that defines its routes. Register it in `app.ts` with a prefix.
- **Use Fastify's built-in JSON schema validation** — define request/response schemas using JSON Schema. Fastify validates automatically and returns 400 on failure.
- **Type-safe routes** — use Fastify's generic route types for typed request bodies, params, querystrings, and replies.
- **`setErrorHandler` over middleware try/catch** — Fastify's `setErrorHandler` is the centralized place for error formatting. Do not add per-route error handling.
- **Prefer Fastify plugins over Express-style middleware** — use `fastify-plugin` for cross-cutting concerns (auth, rate limiting) instead of `preHandler` chains.
- **Logging via Fastify's built-in logger** — use `request.log` and `app.log` (Pino). No `console.log` in production code.
- **Graceful shutdown** — use `app.close()` on `SIGTERM`/`SIGINT` to drain connections before exiting.

## Security Requirements

- All communication over HTTPS (TLS 1.2+)
- No secrets in source code — use environment variables
- Rate limiting on auth endpoints
- All write operations within DB transactions
- Error messages must not expose internals in production
- Extensions cannot bypass core security middleware

## Quality Targets

- Support at least 50,000 transactions
- 95% of filtered queries respond within 500ms
- Dashboard renders within 2 seconds for up to 50,000 transactions
- 85%+ automatic categorization accuracy via rules
- Deployment reproducible within 30 minutes, max 5 setup steps

## Tasks

Reusable task definitions live in `.claude/tasks/`. When a user says "run task <name>", read and execute `.claude/tasks/<name>.md`.

Available tasks:

- `pr-review` — full PR review against Jira requirements, best practices, and dependency health

## Running the Project

See `README.md` for two setup paths: **Quick Start (Docker)** for running from pre-built images, or **Development Setup** for local development with Bun.

## Links

- **Jira:** https://smartfinancepm4.atlassian.net/jira/software/projects/KAN/boards/2
- **Wiki:** See `wiki/` directory for full software guidebook documentation

## Git

### Branching Model

Two permanent branches:

- **`main`** (Production) — stable, release-only. Never commit directly. Updated only via release PRs from `develop` at end of sprint.
- **`develop`** (Pre-Production) — active integration branch. All feature/bugfix PRs target `develop`.

### Branch Rules

- Never add a Co-Authored-By line to commit messages.
- No direct commits to `main` or `develop`. All work happens on feature branches.
- Feature branches always branch off `develop`, not `main`.
- Branch naming: `<type>/<JIRA-ID>-<description>` (e.g., `feature/KAN-19-import-adapter-interface`, `bugfix/KAN-22-postgres-connection-timeout`)
  - Types: `feature/`, `bugfix/`, `docs/`, `refactor/`
- Commit messages follow Conventional Commits with Jira ID: `<type>(<scope>): [<JIRA-ID>] <subject>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Scopes: `frontend`, `backend`, `docker`, `db`, `root`
  - Example: `feat(backend): [KAN-10] implement RBAC middleware for protected routes`
- **Stale branches:** PRs from branches that have significantly diverged from `develop` will be rejected. Diverged branches must be rebased or branched into a realign branch. A new Jira ticket must be created for the realignment and linked to the original ticket.
- Pre-commit hooks (Husky + lint-staged) auto-format and lint staged files. Never bypass with `--no-verify`.

### Pull Requests

- PRs target `develop` (not `main`). Release PRs from `develop` → `main` happen at end of sprint.
- Include Jira ID in title (e.g., `[KAN-23] Define branching strategy`), squash and merge, delete branch after merge.
- **Deadline:** No new PRs on Friday mornings. Cutoff for PR creation is **Thursday 20:00**.
- **Approval:** Every PR requires explicit approval from the Project Owner.
- **PR Description Template:**

  ```markdown
  ## Summary

  <1–3 sentences: what was done and why>

  ## Changes

  - **[scope]** [concrete change description]
  - **[scope]** [concrete change description]

  ## Verified

  - [x] bun install succeeds
  - [x] [add specific verification checks]

  ## Notes

  <optional: trade-offs, follow-ups, or decisions for reviewers>
  ```

- CI status checks (Docker build, lint, tests) must pass before merging.

### Releases

- At sprint end, create a release PR from `develop` → `main`.
- The manual release GitHub Action may open or reuse that release PR after the latest successful staging run on `develop`.
- When the release PR merges, production CD runs automatically from the resulting `main` push.

### Pull Request Description Template

When asked to generate a PR description, use this format:

```markdown
## Summary

< 1–3 sentences: what was done and why >

## Changes

< bulleted list of concrete changes, each prefixed with **bold scope** >

## Verified

< checklist with [x] of what was verified: build, lint, tests, manual checks >

## Notes

< optional: anything reviewers should know — follow-ups, open questions, trade-offs >
```

Rules:

- Keep it concise — no filler, no restating the ticket title.
- **Changes** list actual code/config changes, not intentions.
- **Verified** only includes checks that were actually run or confirmed.
- If a Jira ticket exists, reference it in the summary (e.g. "Implements KAN-36").
