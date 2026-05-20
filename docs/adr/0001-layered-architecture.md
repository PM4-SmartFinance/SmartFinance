# 0001 — Layered Architecture

Status: Accepted

Date: 2026-05-15

Context

The project contains multiple concerns: UI rendering, HTTP routing, business rules (categorization, budgeting), and database persistence. During early development team members placed logic in different layers which led to duplication and harder-to-test code paths.

Decision

Adopt a strict layered architecture with these layers (top → bottom):

- Presentation (frontend React)
- API (Fastify controllers, routes under `/api/v1`)
- Business Logic (services)
- Data Access (repository pattern)
- Persistence (PostgreSQL via Prisma)

All code must respect layer boundaries. Controllers must be thin and call services. Services must not access Fastify types. Repositories encapsulate all Prisma usage.

Consequences

- Improved testability: services can be tested without HTTP concerns.
- Clear ownership: repo layer centralises DB access and transaction handling (see `backend/src/repositories/transaction.repository.ts`).
- Slightly more boilerplate, but consistent responsibility separation reduces long-term maintenance cost.

Related code

- Repository examples: [transaction.repository.ts](../../backend/src/repositories/transaction.repository.ts#L1)
- App factory / route registration: [backend/src/app.ts](../../backend/src/app.ts#L1)

Related ADRs

- 0003-repository-pattern-with-transactions.md
