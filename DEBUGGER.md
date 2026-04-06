# Debugging Guide

This guide covers how to debug every part of the SmartFinance stack: backend server, frontend dev server, database seed, and tests.

## Prerequisites

- [Bun VS Code Extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) (for VS Code debugger)
- Chrome or any Chromium browser (for `chrome://inspect`)
- Dev database running: `docker compose -f docker-compose.dev.yml up -d`

## Backend (Fastify Server)

### Chrome DevTools

```bash
cd backend
bun --inspect-brk src/index.ts
```

Open `chrome://inspect` in Chrome, click **inspect** on the listed target. Set breakpoints in any source file (controllers, services, repositories). The `--inspect-brk` flag pauses before the first line executes.

For live-reload debugging (no pause on start):

```bash
cd backend
bun --inspect src/index.ts
```

Then trigger requests via the frontend or `curl` to hit your breakpoints.

### VS Code

Use this launch configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

Set breakpoints in the editor and press **F5**. The Fastify server starts on port 3000 as usual.

### Inline `debugger` Statement

Add `debugger;` anywhere in the backend code, then run with `--inspect-brk`. Execution pauses at that line when the code path is hit.

```ts
// Example: pause inside a service function
export function computeBudgetUsage(limit: Decimal, spent: Decimal) {
  debugger; // <-- execution pauses here
  return limit.minus(spent);
}
```

## Frontend (Vite Dev Server)

### Browser DevTools

The frontend runs in the browser, so standard browser DevTools work out of the box:

1. Run `bun run --cwd=frontend dev`
2. Open `http://localhost:5173` in Chrome
3. Open DevTools (**F12**), go to **Sources** tab
4. Find files under `src/` in the file tree, set breakpoints

Vite provides source maps by default, so you debug the original TypeScript, not compiled output.

### VS Code (Browser Debugger)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

Start the Vite dev server first (`bun run --cwd=frontend dev`), then press **F5**. VS Code opens Chrome and maps breakpoints to your source files.

### React DevTools

Install the [React DevTools browser extension](https://react.dev/learn/react-developer-tools). It adds a **Components** tab to DevTools where you can inspect component props, state, context values, and TanStack Query cache.

## Database Seed (`prisma/seed.ts`)

### Chrome DevTools

```bash
cd backend
bun --inspect-brk prisma/seed.ts
```

Open `chrome://inspect`, set breakpoints inside `main()`, and step through each seed operation.

### VS Code

```json
{
  "type": "bun",
  "request": "launch",
  "name": "Debug Seed",
  "program": "${workspaceFolder}/backend/prisma/seed.ts",
  "cwd": "${workspaceFolder}/backend"
}
```

### REPL (Interactive Exploration)

For poking at the database without running the full seed:

```bash
cd backend
bun repl
```

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Explore interactively
await prisma.dimCategory.findMany();
await prisma.dimUser.findFirst({ where: { email: "dev@smartfinance.local" } });
```

### Common Seed Issues

| Symptom                       | Cause                                                   | Fix                                                       |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL is not defined` | `.env` not found (wrong CWD)                            | Run from `backend/` directory                             |
| Transaction timeout           | argon2 hashing inside `$transaction` exceeds 5s default | Add `{ timeout: 15000 }` as second arg to `$transaction`  |
| Column/table not found        | Prisma client out of sync with DB                       | Run `bunx prisma migrate dev` then `bunx prisma generate` |

## Tests (Vitest)

### Backend Tests

Start the test database first:

```bash
bun run --cwd=backend test:db:up
```

#### Run a single test with debugger

```bash
cd backend
bun --inspect-brk node_modules/.bin/vitest run --no-file-parallelism src/services/budget.service.test.ts
```

#### VS Code

```json
{
  "type": "bun",
  "request": "launch",
  "name": "Debug Backend Test",
  "program": "${workspaceFolder}/backend/node_modules/.bin/vitest",
  "args": ["run", "--no-file-parallelism", "${relativeFile}"],
  "cwd": "${workspaceFolder}/backend"
}
```

Open the test file you want to debug, set breakpoints, press **F5**.

#### Vitest UI

For a visual test runner with inline results:

```bash
bun run --cwd=backend test:ui
```

Opens a browser UI at `http://localhost:51204` where you can re-run individual tests and see output.

### Frontend Tests

```bash
cd frontend
bun --inspect-brk node_modules/.bin/vitest run src/pages/DashboardPage.test.tsx
```

Or use the Vitest UI:

```bash
bun run --cwd=frontend test:ui
```

### Debugging a Specific `it()` Block

Use `.only` to isolate a single test:

```ts
it.only("should calculate budget remaining", () => {
  debugger; // pause here
  const result = computeBudgetUsage(d(1000), d(750));
  expect(result).toEqual(d(250));
});
```

Then run with `--inspect-brk` to hit the `debugger` statement.

## Prisma (Database Inspection)

### Prisma Studio (GUI)

```bash
cd backend
bunx prisma studio
```

Opens a browser UI at `http://localhost:5555` where you can browse and edit all tables.

### Query Logging

Enable Prisma query logging by changing the client initialization:

```ts
const prisma = new PrismaClient({
  adapter,
  log: ["query", "info", "warn", "error"],
});
```

This prints every SQL query to stdout — useful for spotting N+1 queries or unexpected operations.

## Docker

### View container logs

```bash
docker compose -f docker-compose.dev.yml logs -f
```

### Connect to the dev database directly

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U smartfinance -d smartfinance
```

### Connect to the test database

```bash
docker compose -f docker-compose.test.yml exec postgres psql -U smartfinance -d smartfinance_test -p 5432
```

Note: The test database runs on host port **5433** but container-internal port is still 5432.

## Fastify Request Logging

Fastify logs every request via Pino by default (`{ logger: true }` in `app.ts`). For more detail, set the log level:

```bash
LOG_LEVEL=debug bun run --cwd=backend dev
```

To pretty-print logs during development:

```bash
cd backend
bun run dev | bunx pino-pretty
```

## Quick Reference

| What                | Command                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Debug backend       | `cd backend && bun --inspect-brk src/index.ts`                                                |
| Debug frontend      | Browser DevTools on `localhost:5173`                                                          |
| Debug seed          | `cd backend && bun --inspect-brk prisma/seed.ts`                                              |
| Debug backend test  | `cd backend && bun --inspect-brk node_modules/.bin/vitest run <file>`                         |
| Debug frontend test | `cd frontend && bun --inspect-brk node_modules/.bin/vitest run <file>`                        |
| Browse DB (GUI)     | `cd backend && bunx prisma studio`                                                            |
| Dev DB shell        | `docker compose -f docker-compose.dev.yml exec postgres psql -U smartfinance -d smartfinance` |
| Pretty logs         | `cd backend && bun run dev \| bunx pino-pretty`                                               |
