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
- No direct commits to `main`. All work happens on feature branches.
- Branch naming: `<type>/<JIRA-ID>-<description>` (e.g., `feature/KAN-19-import-adapter-interface`, `bugfix/KAN-22-postgres-connection-timeout`)
  - Types: `feature/`, `bugfix/`, `docs/`, `refactor/`
- Commit messages follow Conventional Commits with Jira ID: `<type>(<scope>): [<JIRA-ID>] <subject>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Scopes: `frontend`, `backend`, `docker`, `db`, `root`
  - Example: `feat(backend): [KAN-10] implement RBAC middleware for protected routes`
- PRs: include Jira ID in title (e.g., `[KAN-23] Define branching strategy`), squash and merge into `main`, delete branch after merge
- Pre-commit hooks (Husky + lint-staged) auto-format and lint staged files. Never bypass with `--no-verify`.
