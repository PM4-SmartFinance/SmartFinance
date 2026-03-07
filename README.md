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
├── backend/           # Node.js REST API (Express/Fastify)
├── docker/            # Dockerfiles and Docker Compose config
├── wiki/              # Project documentation (separate git repo)
├── package.json       # Root workspace config and shared scripts
├── tsconfig.base.json # Shared TypeScript base config (strict mode)
├── eslint.config.mjs  # Shared ESLint flat config
├── .prettierrc        # Shared Prettier config
└── .editorconfig      # Editor settings (indent, charset, line endings)
```

This is a **Bun workspaces monorepo**. The root `package.json` defines two workspaces: `frontend/` and `backend/`. Shared dev dependencies (TypeScript, ESLint, Prettier) are installed at the root. Each workspace manages its own application dependencies.

## Getting Started

### 1. Install dependencies

```bash
bun install
```

This installs all dependencies for the root and both workspaces in one step. It also runs the `prepare` script, which sets up Husky git hooks so that ESLint and Prettier run automatically on every commit via lint-staged.

### 2. Run the project

For production/full-stack with Docker:

```bash
docker-compose up
```

For local development, run frontend and backend separately (once they are scaffolded):

```bash
# Terminal 1 — Backend
bun run --filter @smartfinance/backend dev

# Terminal 2 — Frontend
bun run --filter @smartfinance/frontend dev
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
- `eslint-plugin-react-hooks` v7 (`recommended-latest`) — scoped to `frontend/**/*.{ts,tsx}` only, includes React Compiler rules
- `eslint-config-prettier` — disables rules that conflict with Prettier

### Prettier (`.prettierrc`)

- Semicolons, double quotes, 2-space indent, trailing commas, 100 char print width

### EditorConfig (`.editorconfig`)

- 2-space indent, LF line endings, UTF-8, trim trailing whitespace

## Implementing Frontend and Backend

### Frontend (`frontend/`)

The frontend workspace is for the React + Vite + PWA application. To scaffold it:

1. Add dependencies to `frontend/package.json` (React, Vite, etc.)
2. Create a `frontend/tsconfig.json` extending `../tsconfig.base.json` (add `DOM` lib, `jsx: react-jsx`)
3. Create a `frontend/vite.config.ts`
4. Add source code under `frontend/src/`
5. Add scripts (`dev`, `build`, `preview`) to `frontend/package.json`

Key conventions:

- No business logic in React components — all processing happens in the backend
- Use Zustand for client state, TanStack Query for server state
- All data flows through the REST API (`/api/v1`)
- Semantic HTML, accessible form controls

### Backend (`backend/`)

The backend workspace is for the Node.js REST API. To scaffold it:

1. Add dependencies to `backend/package.json` (Express or Fastify, Prisma, etc.)
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
- **Backend:** Node.js, Express or Fastify, REST API
- **Database:** PostgreSQL with Prisma or TypeORM
- **State Management:** Zustand (client), TanStack Query (server)
- **Deployment:** Docker / Docker Compose
- **CI:** GitHub Actions (lint, test, build on every PR)

## Links

- **Jira:** https://smartfinancepm4.atlassian.net/jira/software/projects/KAN/boards/2
- **Wiki:** See `wiki/` directory for full software guidebook documentation
