# SmartFinance

> A self-hosted personal finance management platform for importing, categorizing, and visualizing bank transactions.

Academic semester project (PM4) at ZHAW School of Engineering.

## At a Glance

[![Latest release](https://img.shields.io/github/v/release/PM4-SmartFinance/SmartFinance?label=latest%20release)](https://github.com/PM4-SmartFinance/SmartFinance/releases)
[![CI on main](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml?query=branch%3Amain)
[![CI on develop](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/ci.yml?query=branch%3Adevelop)
[![Release / CD](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml/badge.svg)](https://github.com/PM4-SmartFinance/SmartFinance/actions/workflows/cd.yml)

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
| Docker & Docker Compose | Running the app locally or self-hosting | [Download Docker Desktop](https://www.docker.com/products/docker-desktop/). Linux users can install Docker Engine from their distro packages. |
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

3. Open the app in your browser at `http://localhost` or at your configured domain.

### Self-Hosting on Windows

1. Open PowerShell or Command Prompt.
2. Run the Windows setup script.

```dos
scripts\setup-user.bat
```

3. Open the app in your browser at `http://localhost` or at your configured domain.

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

### Testing

Use these scripts from the repository root:

```bash
bun run test
bun run test:coverage
```

Detailed testing conventions are documented in [TEST.md](TEST.md) and the wiki chapters that cover implementation and operations.

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
