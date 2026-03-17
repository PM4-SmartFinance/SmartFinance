# SmartFinance

A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions. Academic semester project (PM4) at ZHAW School of Engineering.

## Prerequisites

- [Bun](https://bun.sh/) (v1.2+) — used as package manager and script runner
- [Node.js](https://nodejs.org/) (v22 LTS) — runtime for backend tooling (pinned via `.tool-versions`)
- [Docker](https://www.docker.com/) & Docker Compose — for running PostgreSQL and production deployment

## Project Structure

```
SmartFinance/
├── frontend/          # React + TypeScript + Vite (PWA)
├── backend/           # Node.js REST API (Fastify)
├── docker/            # Dockerfiles and Docker Compose config
├── wiki/              # Project documentation (separate git repo)
├── package.json       # Root workspace config and shared scripts
├── tsconfig.base.json # Shared TypeScript base config (strict mode)
├── eslint.config.mjs  # Shared ESLint flat config
├── .prettierrc        # Shared Prettier config
└── .editorconfig      # Editor settings (indent, charset, line endings)
```

This is a **Bun workspaces monorepo**. The root `package.json` defines two workspaces: `frontend/` and `backend/`. Shared dev dependencies (TypeScript, ESLint, Prettier) are installed at the root. Each workspace manages its own application dependencies.

## Quick Start (Docker)

Run the full stack from pre-built images — no local toolchain needed. This is what the CD pipeline does on the server.

**Requirements:** Docker v29+ with the Compose plugin.

```bash
cp .env.example .env   # Copy the example env file and fill in your values
docker compose up -d   # Start Traefik, PostgreSQL, backend, and frontend
docker compose exec -T backend npx prisma migrate deploy   # Apply database migrations
```

See `.env.example` for all required variables (domain, DB credentials, session secret, GHCR repository).

## Development Setup

For contributors working on the codebase locally.

### 1. Install dependencies

```bash
bun install
```

This installs all dependencies for the root and both workspaces in one step. It also sets up Husky git hooks so that ESLint and Prettier run automatically on every commit via lint-staged.

### 2. Start the local database

```bash
docker compose -f docker-compose.dev.yml up -d
cp backend/.env.dev backend/.env
```

Run Prisma migrations and seed:

```bash
cd backend
bunx prisma migrate deploy
bunx prisma db seed
```

### 3. Run the full stack

Run frontend and backend in separate terminals:

```bash
# Terminal 1 — Backend
bun run --filter @smartfinance/backend dev

# Terminal 2 — Frontend
bun run --filter @smartfinance/frontend dev
```

The frontend dev server runs at `http://localhost:5173`.

### Wireframe preview

The frontend renders a wireframe preview shell in development. Start the frontend dev server and open `http://localhost:5173` — use the top navigation bar to switch between wireframe views. Source files are in `frontend/src/wireframes/`.

### Stop / reset the database

```bash
docker compose -f docker-compose.dev.yml down      # Stop PostgreSQL
docker compose -f docker-compose.dev.yml down -v    # Stop and delete all data
```

## Available Scripts

Run these from the **project root**:

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `bun run lint`         | Lint all files with ESLint       |
| `bun run lint:fix`     | Lint and auto-fix issues         |
| `bun run format`       | Format all files with Prettier   |
| `bun run format:check` | Check formatting without writing |

Workspace-specific scripts (defined in each workspace's `package.json`) can be run with `--filter`:

```bash
bun run --filter @smartfinance/frontend <script>
bun run --filter @smartfinance/backend <script>
```

## Shared Configuration

### TypeScript (`tsconfig.base.json`)

Strict base config that both workspaces extend. Key settings:

- `strict: true` — all strict checks enabled
- `target: ES2022`, `lib: ES2024` — modern JS output with access to latest APIs (`Object.groupBy`, `Promise.withResolvers`, etc.)
- `moduleResolution: bundler` — for Vite/bundler compatibility
- `noUncheckedIndexedAccess: true` — forces null checks on array/object indexed access
- `exactOptionalPropertyTypes: true` — distinguishes `undefined` from missing properties

Each workspace should create its own `tsconfig.json` that extends the base:

```jsonc
// frontend/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    // ... workspace-specific overrides
  },
  "include": ["src"],
}
```

```jsonc
// backend/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    // ... workspace-specific overrides
  },
  "include": ["src"],
}
```

### ESLint (`eslint.config.mjs`)

ESLint 10 flat config using `defineConfig()` with:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `@eslint-react/eslint-plugin` recommended rules — scoped to `frontend/**/*.{ts,tsx}`
- `eslint-plugin-react-hooks` v7 — scoped to `frontend/**/*.{ts,tsx}`, includes React Compiler rules
- `eslint-plugin-react-refresh` — validates fast refresh compatibility
- `eslint-config-prettier` — disables rules that conflict with Prettier

### Prettier (`.prettierrc`)

- Semicolons, double quotes, 2-space indent, trailing commas, 100 char print width

### EditorConfig (`.editorconfig`)

- 2-space indent, LF line endings, UTF-8, trim trailing whitespace

## Implementing Frontend and Backend

### Frontend (`frontend/`)

React 19 + TypeScript + Vite application with react-router v7 (data router API).

```
frontend/src/
├── components/    # Shared UI components (e.g. ProtectedRoute)
├── contexts/      # React context providers (e.g. AuthProvider)
├── pages/         # Route-level page components
├── router.tsx     # Route config (createBrowserRouter)
├── App.tsx        # Root component (AuthProvider + RouterProvider)
└── main.tsx       # Entry point
```

Key conventions:

- No business logic in React components — all processing happens in the backend
- Use Zustand for client state, TanStack Query for server state
- All data flows through the REST API (`/api/v1`)
- Semantic HTML, accessible form controls

### Backend (`backend/`)

The backend workspace is for the Node.js REST API. To scaffold it:

1. Add dependencies to `backend/package.json` (Fastify, Prisma, etc.)
2. Create a `backend/tsconfig.json` extending `../tsconfig.base.json` (set `module: nodenext`, `moduleResolution: nodenext`)
3. Add source code under `backend/src/` following the layered architecture:
   - `controllers/` — HTTP request/response handling
   - `services/` — business logic
   - `repositories/` — data access (Prisma/TypeORM)
   - `middleware/` — auth, validation, error handling
4. Add scripts (`dev`, `build`, `start`) to `backend/package.json`

Key conventions:

- All endpoints under `/api/v1`
- Repository pattern for all database access
- All write operations within explicit DB transactions
- Centralized error handling middleware
- Input validation on all endpoints (server-side)

## Tech Stack

- **Frontend:** React (TypeScript), Vite, PWA
- **Backend:** Node.js, Fastify, REST API
- **Database:** PostgreSQL with Prisma or TypeORM
- **State Management:** Zustand (client), TanStack Query (server)
- **Deployment:** Docker / Docker Compose
- **CI:** GitHub Actions (lint, test, build on every PR)

## Links

- **Jira:** https://smartfinancepm4.atlassian.net/jira/software/projects/KAN/boards/2
- **Wiki:** See `wiki/` directory for full software guidebook documentation
