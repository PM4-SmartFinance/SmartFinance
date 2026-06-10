# SmartFinance

> A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions.

Academic semester project (PM4) at ZHAW School of Engineering.

## At a Glance

[![Latest release](https://img.shields.io/github/v/release/PM4-SmartFinance/SmartFinance?label=latest%20release)](https://github.com/PM4-SmartFinance/SmartFinance/releases)
[![CI on main](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml?query=branch%3Amain)
[![Release / CD](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml/badge.svg)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml)
[![Backend coverage](backend-coverage-badge.svg)](backend-coverage-badge.svg) [![Frontend coverage](frontend-coverage-badge.svg)](frontend-coverage-badge.svg)

## Project Status

**Current version:** See the latest release badge above.  
**Production branch:** `main`  
**Staging branch:** `develop`

| Branch    | CI Status                                                                                                                                                                                                                | CD Status                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`    | [![CI on main](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml?query=branch%3Amain)          | [![Release / CD](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml/badge.svg)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml) |
| `develop` | [![CI on develop](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml?query=branch%3Adevelop) | Not applicable; CD is triggered by published releases from `main`                                                                                                                 |

The badges above reflect the latest GitHub Actions results for each branch. CI runs on both `main` and `develop`; CD is release-driven and publishes Docker images when a GitHub Release is published.

## Start Here

Choose the path that matches what you want to do.

| If you want to...                | Do this                             |
| -------------------------------- | ----------------------------------- |
| Use the app on your own machine  | Follow the self-hosting steps below |
| Develop or contribute            | Follow the contributor steps below  |
| Check the full technical details | Open the wiki links at the bottom   |

> Windows note: self-hosting uses a `.bat` file and does not require WSL2. Development on Windows still assumes WSL2 because the scripts are shell-based.

## Prerequisites

Before running or developing the application, make sure these are installed.

| Tool                    | Needed for                              | Get it                                                                                                                                        |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker & Docker Compose | Running the app locally or self-hosting | [Download Docker Desktop](https://www.docker.com/products/docker-desktop/).                                                                   |
| Bun (v1.2+)             | Development and local scripts           | [Install Bun](https://bun.sh/docs/installation).                                                                                              |
| Node.js (v22 LTS)       | Backend tooling                         | [Download Node.js](https://nodejs.org/en/download).                                                                                           |

> Linux users: your distro package manager probably already has this under control, but the links are here anyway for those rare moments when the package manager is feeling dramatic.

---

## Quick Start

### Self-Hosting on Linux or macOS

1. Open a terminal.
2. Run the user setup script.

```bash
./scripts/setup-user.sh
```

3. The script checks GHCR for a published backend/frontend image tag first. If one exists, it pulls that tag; otherwise it builds local images and reuses them on reruns.
4. Open the app in your browser at `http://localhost:3000` or at your configured domain.

Log in with the default administrator account (printed on completion):

| Email | Password |
| --- | --- |
| `admin@smartfinance.local` | `changeme123` |

> **Change this password immediately after your first login** (Settings → Profile). To start with a non-default credential, set `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` in your environment before running the script.

Run `setup-user.sh` only **once**, on a fresh install — it seeds the default administrator. After that, your accounts and data live in a persistent Postgres volume.

When you are done using the app, stop the stack to release resources (this keeps your data):

```bash
./scripts/stop-user.sh
```

To start the stack again later — after a reboot or after stopping it — resume where you left off **without** re-seeding the admin:

```bash
./scripts/start-user.sh
```

### Self-Hosting on Windows

1. Open PowerShell or Command Prompt.
2. Run the Windows setup script.

```dos
scripts\setup-user.bat
```

3. Open the app in your browser at `http://localhost:3000` or at your configured domain. Log in with the default administrator account (`admin@smartfinance.local` / `changeme123`) and **change the password immediately after your first login**.

Run `setup-user.bat` only **once**, on a fresh install. Afterwards, resume the stack with `scripts\start-user.bat` (no re-seeding) and shut it down with `scripts\stop-user.bat`. Both keep your data.

If you want the full deployment flow, required environment variables, or rollback details, use [Chapter 11: Installation (Deployment)](https://github.com/PM4-SmartFinance/SmartFinance/wiki/11.-Installation-Deployment).

### Contributing on Linux, macOS, or WSL2

1. Open a terminal.
2. Run the developer setup script.

```bash
./scripts/setup-dev.sh
```

3. Start the backend and frontend in separate terminals.

```bash
bun run --filter @smartfinance/backend dev
```

```bash
bun run --filter @smartfinance/frontend dev
```

On Windows, this workflow currently assumes WSL2 because the scripts and tooling are shell-based.

For the complete local setup, test database workflow, and troubleshooting guidance, use [Chapter 11: Installation (Deployment)](https://github.com/PM4-SmartFinance/SmartFinance/wiki/11.-Installation-Deployment) and [Chapter 12: Operation and Support](https://github.com/PM4-SmartFinance/SmartFinance/wiki/12.-Operation-and-Support).

### Observability (Prometheus + Grafana)

The dev and test compose stacks ship a Prometheus + Grafana pair so technical
(`fastify-metrics`) and business (`smartfinance_*`) series are visible locally.

| Stack | Grafana                          | Prometheus              | Default credentials |
| ----- | -------------------------------- | ----------------------- | ------------------- |
| dev   | <http://localhost:3001>          | <http://localhost:9090> | `admin` / `admin`   |
| test  | <http://localhost:3002>          | <http://localhost:9091> | `admin` / `admin`   |
| prod  | `https://<DOMAIN>/grafana`       | internal only           | from `.env`         |

Dev/test credentials can be overridden via `GRAFANA_ADMIN_USER` /
`GRAFANA_ADMIN_PASSWORD` in `.env`. Prod requires both to be set explicitly.
The Prometheus container scrapes the backend on `host.docker.internal:3000`
in dev/test (the backend runs on the host via `bun run dev`); on Linux this
is mapped through `extra_hosts: host-gateway` in the compose files.

The backend exposes `/metrics` (Prometheus exposition format). In prod Traefik
only routes `PathPrefix(/api)`, so `/metrics` is reachable only from the
`internal` Docker network — not from the public internet.

### Testing

Use these scripts from the repository root:

```bash
bun run test
bun run test:coverage
```

Detailed testing conventions are documented in [TEST.md](TEST.md) and the wiki chapters that cover implementation and operations.

### End-to-end tests

A Playwright suite under [`e2e/`](e2e) exercises the running app (frontend + backend + Postgres) across multi-step user journeys (admin user lifecycle, CSV import + categorize retry, filters). It is driven by the [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) workflow nightly at 03:00 UTC against `develop`, plus on every PR that touches the suite itself.

Run locally:

```bash
docker compose -f docker-compose.test.yml up -d --wait
cd backend && bun --bun run prisma migrate deploy && bun prisma/seed.ts && cd ..
bun run test:e2e          # headless, full suite
bun run test:e2e:headed   # watch the browser
bun run test:e2e:ui       # interactive runner
```

Specs live in `e2e/specs/`, API-driven helpers in `e2e/helpers/`, and CSV fixtures in `e2e/fixtures/` (use absolute dates so suites stay stable as real-world time passes). Failure artifacts (`playwright-report/`, `test-results/`) upload as workflow artifacts; nightly failures auto-open a GitHub issue tagged `e2e-failure`.

### Need a quick sanity check?

After setup, the safest first check is:

1. Open the app in the browser.
2. Log in or create the first account.
3. Confirm the dashboard loads without errors.
4. If anything fails, use the troubleshooting notes in [Chapter 11](https://github.com/PM4-SmartFinance/SmartFinance/wiki/11.-Installation-Deployment) and [Chapter 12](https://github.com/PM4-SmartFinance/SmartFinance/wiki/12.-Operation-and-Support).

---

## Documentation & Architecture

The README stays intentionally short. The wiki is the source of truth for architecture, data model, deployment, and operations.

- [Wiki home](https://github.com/PM4-SmartFinance/SmartFinance/wiki)
- [Architecture](https://github.com/PM4-SmartFinance/SmartFinance/wiki/06.-Architecture)
- [Data model](https://github.com/PM4-SmartFinance/SmartFinance/wiki/09.-Data)
- [Deployment](https://github.com/PM4-SmartFinance/SmartFinance/wiki/11.-Installation-Deployment)
- [Operations](https://github.com/PM4-SmartFinance/SmartFinance/wiki/12.-Operation-and-Support)
- [Decision log](https://github.com/PM4-SmartFinance/SmartFinance/wiki/13.-Decision-Log)
- [Contributing guide](CONTRIBUTING.md)
- [Architecture Decision Records (ADRs)](docs/adr/README.md)
