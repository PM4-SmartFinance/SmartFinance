# 0006 — API Versioning Strategy

Status: Accepted

Date: 2026-05-15

Context

APIs evolve over time. Without a clear versioning strategy clients risk breaking when server changes are introduced.

Decision

Prefix all public API endpoints with `/api/v1`. New major changes will be released under `/api/v2` etc. During minor/patch changes maintain backwards compatibility and avoid breaking changes on the stable `/api/v1` surface.

Rationale

- URL-based versioning is explicit and easy to route via Fastify prefixes.
- Works well with client-side TanStack Query cache keys and migration strategies.
- Easier to run multiple versions side-by-side during migration or rollout.

Consequences

- All route registration uses a base prefix (see `backend/src/app.ts` and test expectations in `TEST.md`).
- Clients must use `/api/v1` until a migration is announced.

Related code

- Test usage: `TEST.md` and backend tests using `/api/v1/*` paths
- Frontend base URL composition: `frontend/src/lib/api.ts` (uses `/api/v1`)

Related ADRs

- 0002-cookie-based-authentication.md
