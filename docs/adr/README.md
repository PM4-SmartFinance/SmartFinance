# Architecture Decision Records (ADRs)

This directory contains the project's formal Architecture Decision Records (MADR-style). Each file documents a key architectural decision, the context, the decision itself, and the consequences.

## Index

- [0001-layered-architecture.md](0001-layered-architecture.md)
- [0002-cookie-based-authentication.md](0002-cookie-based-authentication.md)
- [0003-repository-pattern-with-transactions.md](0003-repository-pattern-with-transactions.md)
- [0004-extension-isolation.md](0004-extension-isolation.md)
- [0005-server-state-with-tanstack-query.md](0005-server-state-with-tanstack-query.md)
- [0006-api-versioning-strategy.md](0006-api-versioning-strategy.md)
- [0007-e2e-framework-choice.md](0007-e2e-framework-choice.md)

## How to add a new ADR

1. Copy `0001-layered-architecture.md` as `0008-<short-title>.md`.
2. Follow the template (Status, Context, Decision, Consequences, Related ADRs).
3. Open a PR against `develop` with the ADR and link the relevant Jira ticket.

## Review Process

- ADRs are proposed in a PR and reviewed by at least one maintainer.
- Once accepted, mark `Status: Accepted` and merge to `develop`.
