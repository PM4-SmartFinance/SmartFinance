# 0003 — Repository Pattern with Transactions

Status: Accepted

Date: 2026-05-15

Context

Multiple features perform multi-step writes (import pipeline, bulk categorization). Early code mixed ORM calls across services causing partial writes and harder-to-reason-about race conditions.

Decision

All database access must flow through a repository layer. Repositories expose transactional helpers and composite operations; services must not call Prisma directly. Repositories must use explicit transactions (Prisma `$transaction`) for multi-step writes.

Rationale

- Centralises DB knowledge and transaction boundaries in one place.
- Prevents accidental partial writes from services that do not use transactions.
- Allows repository unit tests to simulate transaction behavior.

Consequences

- Services become simpler: they coordinate repositories rather than manage DB concerns.
- Bulk and import operations use `prisma.$transaction(...)` (see `backend/src/repositories/transaction.repository.ts`).
- Developers must learn repository APIs and avoid direct Prisma usage in service code.

Related code

- `backend/src/repositories/transaction.repository.ts` — bulkImport, updateById, bulkSetCategory (transaction usage)
- `backend/src/prisma.ts` — central Prisma client creation

Related ADRs

- 0001-layered-architecture.md
