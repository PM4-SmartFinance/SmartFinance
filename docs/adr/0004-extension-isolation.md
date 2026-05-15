# 0004 — Extension Isolation

Status: Accepted

Date: 2026-05-15

Context

The project supports future extension modules (plugins) that may add UI and backend endpoints. Allowing extensions to access core internals risks security, data corruption, and schema drift.

Decision

Extensions are isolated: they register via defined interfaces and may not directly access repositories or modify the DB schema. Extension storage is namespace-isolated (JSON blobs) and modules receive only the APIs explicitly exposed by the core application.

Rationale

- Prevents extensions from bypassing authentication, authorization, and transactional guarantees.
- Keeps the core data model stable and maintainable.

Consequences

- Extension authors must use provided module APIs and extension endpoints instead of direct DB access.
- Core maintainers must design extension APIs thoughtfully to cover required use cases.
- Security surface is smaller and reviews are simpler.

Related code

- Extension notes: [SmartFinance/CLAUDE.md](../../CLAUDE.md#extension-architecture)
- Planned extension endpoint pattern: `GET /modules/:moduleName/...` (see CLAUDE.md)

Related ADRs

- 0003-repository-pattern-with-transactions.md
