# SmartFinance

A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions. Academic semester project (PM4) at ZHAW School of Engineering, developed by a team of 9 students over 12 weeks.

## Tech Stack

- **Frontend:** React (TypeScript), Vite, PWA
- **Backend:** Node.js, Express or Fastify, REST API
- **Database:** PostgreSQL with ORM (Prisma or TypeORM)
- **State Management:** Zustand (client state), TanStack Query (server state)
- **Deployment:** Docker / Docker Compose
- **CI:** GitHub Actions (lint, test, build on every PR)

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
- English is primary language, German as fallback; text resources separated from logic

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

## Running the Project

```bash
docker-compose up
```

## Links

- **Jira:** https://smartfinancepm4.atlassian.net/jira/software/projects/KAN/boards/2
- **Wiki:** See `wiki/` directory for full software guidebook documentation

## Git

- Never add a Co-Authored-By line to commit messages.
