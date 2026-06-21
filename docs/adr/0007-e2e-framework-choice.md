# 0007 — Playwright for End-to-End Tests

Status: Accepted

Date: 2026-05-21

Context

KAN-149 requires a nightly end-to-end suite that drives a real browser against the running stack to catch cross-layer regressions (cookie session handoff, RBAC at the UI, full import + categorize flow, cross-page filter state). Unit and integration tests cover services and controllers in isolation; nothing currently asserts a multi-step user journey through the actual frontend + backend. Manual regression is the only existing signal before release PRs, which does not scale across 9 contributors over 12 weeks.

Two framework candidates were considered: Playwright and Cypress. The codebase has no existing e2e infrastructure, so the choice is unconstrained.

Decision

- Use Playwright (`@playwright/test`) as the e2e framework.
- Run a single dependency at the workspace root (`@playwright/test`) as a `devDependency`.
- Specs live under `e2e/specs/`, API-driven seed helpers under `e2e/helpers/`, CSV fixtures under `e2e/fixtures/`.
- Run Chromium-only in CI to keep the nightly under ~10 minutes; allow all browsers locally.
- Drive setup through the REST API (`e2e/helpers/api-client.ts`) and drive the UI only for actions under assertion.

Rationale

- TypeScript-first config (`playwright.config.ts`) integrates with the existing toolchain (Bun, strict TS, ESLint flat config) without additional adapters.
- Native multi-context and cookie support enables "log out, log back in as a different role" flows (admin lifecycle + RBAC negative) without juggling test runners.
- `webServer` config starts the actual backend (`bun run --filter @smartfinance/backend start:ci`) and Vite dev server before tests run, so the suite exercises the real Vite proxy that the frontend uses in dev — no separate stand-in.
- Built-in trace recorder + screenshots on failure, plus the GitHub Actions reporter, give first-class CI artifacts without third-party plugins.
- `page.clock` covers the "fixed today" case for date-sensitive assertions without monkey-patching `Date`.
- Compared to Cypress: single npm dep (vs. Cypress' bundled browsers + binary), faster headless run on CI, less framework lock-in to a custom command bus, and no iframe-based architecture limitations.

Consequences

- The suite locks in to Chromium for CI signal; Firefox and WebKit regressions are surfaced only by local dev runs. Acceptable trade-off for nightly budget.
- Specs must follow the "API-seed, UI-assert" pattern to stay deterministic; future contributors need to resist driving setup through the UI.
- The nightly schedule fires from the repository default branch only; the cron becomes active after this ADR's accompanying workflow lands on `develop`.
- The workflow opens an issue tagged `e2e-failure` on scheduled-run failure — repo settings must keep the `e2e-failure` label and `issues: write` permission available.
- Future deployment-target runs (against the live test environment instead of the local `webServer`) are possible by swapping `baseURL` and removing the `webServer` block. The current shape tests `develop`'s source branch with self-hosted services.

Related code

- [playwright.config.ts](../../playwright.config.ts)
- [e2e/](../../e2e/)
- [.github/workflows/playwright.yml](../../.github/workflows/playwright.yml)

Related ADRs

- 0002-cookie-based-authentication.md (session handoff is exercised by the e2e suite)
- 0005-server-state-with-tanstack-query.md (queries are observed live in `import-categorize-retry`)
