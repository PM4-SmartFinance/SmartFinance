# SmartFinance

A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions. Academic semester project (PM4) at ZHAW School of Engineering.

## Prerequisites

Before running or developing the application, ensure your system meets the necessary requirements:

- **Docker & Docker Compose:** Required for running the database and the production stack. Docker v29+ is recommended.
- **Bun (v1.2+):** Used as the package manager and script runner (Required for development). Note: Windows users should run Bun via WSL2.
- **Node.js (v22 LTS):** Runtime for backend tooling.

---

## User Installation (Self-Hosting)

The deployment strategy relies on a highly automated, single-host Docker Compose environment. This is the fastest way to get SmartFinance running on your own server or local machine.

### Automated Setup

We provide setup scripts that duplicate the `.env.example` file to `.env`, populate the required configuration values, and start the container network.

**For Linux and macOS:**

1. Open your terminal.
2. Run the user setup script:

```bash
./scripts/setup-user.sh
```

**For Windows:**

1. Open PowerShell or Command Prompt.
2. Run the user setup batch file:

```DOS
scripts\setup-user.bat
```

Once the script finishes, access the application by navigating to http://localhost (or your configured domain) in your web browser.

### Manual Setup

If you prefer to configure the environment variables and start the Docker containers manually, please refer to [Chapter 11.2 of the Wiki](wiki/Chapter-11.md#112-user-installation-self-hosting)

---

## Developer Setup (Contributing)

Contributors working on the SmartFinance codebase locally require a different local environment utilizing Bun workspaces and Node.js.

### Automated Setup

The developer script configures the local `.env` files, installs workspace dependencies, and starts the local database container required for development.

**For Linux and macOS:**

1. Open your terminal.
2. Run the developer setup script:

```Bash
./scripts/setup-dev.sh
```

**For Windows (via WSL2):**

1. Open your WSL2 terminal.
2. Run the developer setup script:

```Bash
./scripts/setup-dev.sh
```

After the script completes, you can start the development servers by running following command in separate terminals.

```
bun run --filter @smartfinance/backend dev
```

```
bun run --filter @smartfinance/frontend dev
```

### Manual Setup

If you need to manually install dependencies, configure the local database, or run database migrations, please read [Chapter 11.5 of the Wiki](wiki/Chapter-11.md#115-developer-onboarding--local-setup).

---

### 4. Test database setup

Integration tests require a dedicated PostgreSQL instance. A separate test database runs on port **5433** to avoid conflicts with the dev database on port 5432.

**Start the test database:**

```bash
bun run --filter @smartfinance/backend test:db:up
```

This starts a PostgreSQL 17 container using `docker-compose.test.yml`. Migrations are applied automatically by Vitest's global setup (`backend/test/global-setup.ts`) before tests run — no manual migration step needed.

**Run backend tests:**

```bash
bun run --filter @smartfinance/backend test
```

**Stop the test database:**

```bash
bun run --filter @smartfinance/backend test:db:down
```

The test database uses `backend/.env.test` for its connection string. This file is checked into the repo since it contains only local development credentials.

> **CI:** GitHub Actions provisions its own PostgreSQL service container automatically — no manual setup needed. See `.github/workflows/ci.yml`.

### Stop / reset the databases

```bash
docker compose -f docker-compose.dev.yml down      # Stop dev PostgreSQL
docker compose -f docker-compose.dev.yml down -v    # Stop and delete all dev data
docker compose -f docker-compose.test.yml down -v   # Stop and delete test data
```

---

## Troubleshooting

If you encounter issues during setup, check these common solutions:

### 1. Port Conflicts (Port already in use)

**Error:** Docker fails to start because port 5432, 3000, 80, or 443 is bound.

**Fix:** You likely have a local Postgres instance or web server running. Stop the conflicting service or modify the ports in your `.env` file to map to different host ports.

### 2. Docker Daemon Issues

**Error:** Cannot connect to the Docker daemon. Docker commands fail immediately.

**Fix:** Ensure the Docker application is running. On Linux, ensure your user is in the docker group or run the command with `sudo`.

### 3. Database Connection Refused

**Error:** The backend crashes citing a Prisma connection error during local development.

**Fix:** Ensure the dev database container is running (`docker ps`). Verify that the `DATABASE_URL` in `backend/.env` exactly matches the credentials in `docker-compose.dev.yml`.

---

## Project Architecture & Scripts

### Workspaces

This is a Bun workspaces monorepo.

- **frontend/**: React 19 + TypeScript + Vite application with react-router v7.
- **backend/**: Node.js REST API using Fastify and Prisma.

---

## Testing & Responsive Design

### Responsive Layout Testing

SmartFinance uses **Tailwind CSS** with mobile-first responsive design. To verify the dashboard and UI components adapt correctly across devices:

#### Chrome/Firefox DevTools Responsive Mode

1. **Open the dashboard:**

   ```bash
   bun run --filter @smartfinance/frontend dev
   # Navigate to http://localhost:5173/dashboard
   ```

2. **Enable responsive mode:**
   - Press **F12** to open DevTools
   - Click the **device icon** (mobile/tablet icon) in the DevTools toolbar (top-left corner)
   - This toggles responsive design mode and shows a device selector

3. **Test these viewport sizes:**
   - **360px** — Mobile (iPhone SE)
   - **480px** — Android phone
   - **768px** — iPad
   - **1024px** — iPad Landscape / Tablet
   - **1366px** — HD Desktop
   - **1920px** — Full HD Monitor
   - **2560px** — 4K Monitor

#### Tailwind Responsive Breakpoints

| Breakpoint | Width   | Layout        |
| ---------- | ------- | ------------- |
| **None**   | <640px  | 1-column grid |
| **sm**     | ≥640px  | 2-column grid |
| **lg**     | ≥1024px | 3-column grid |

**Example:** Dashboard uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` to adapt the widget grid across screen sizes. Container width is constrained to `max-w-7xl` (1280px) centered for optimal readability.

#### Running Tests

```bash
# Frontend unit and integration tests
bun run test:frontend

# Backend tests with dedicated test database
bun run test:backend

# All tests (entire suite)
bun run test

# Test coverage report
bun run test:coverage
```

## Documentation & Architecture

For detailed technical guidelines, architecture diagrams, Git workflows, and testing strategies, please refer to the official documentation:

- **[Software Guidebook (Wiki)](wiki/)**: Contains the complete C4 architecture, domain models, and deployment strategies.
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Contains branch protection rules, commit standards, and pull request workflows.
