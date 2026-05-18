# 0002 — Cookie-based Authentication (httpOnly sessions vs JWT)

Status: Accepted

Date: 2026-05-15

Context

Authentication can be implemented with stateless JWTs or server-managed sessions. The application must protect against XSS and CSRF while keeping the auth model simple for a single-tenant self-hosted deployment.

Decision

Use httpOnly, encrypted, same-site cookies as the session transport via `@fastify/secure-session`. Session payload (user id, role, password-version stamp) lives entirely in the encrypted cookie — no server-side session store. Forced re-login on password rotation is achieved by comparing the cookie's password-version stamp against the current stamp on `dimUser` inside the RBAC middleware on every request. Passwords are hashed with Argon2.

Rationale

- httpOnly cookies prevent JavaScript from reading the session, mitigating XSS token theft.
- Encrypted-cookie sessions keep the backend stateless — no session table, no Redis — which fits the single-tenant self-hosted deployment model.
- Immediate revocation (logout, account deactivation, password rotation) works by bumping the password-version stamp on `dimUser`; the next request from a stale cookie fails the version check in `backend/src/middleware/rbac.ts` and is rejected.
- Integrates cleanly with Fastify's `@fastify/secure-session` plugin and avoids JWT pitfalls (revocation, key rotation, library footprint).

Consequences

- Requires `credentials: "include"` from the frontend API client (see `frontend/src/lib/api.ts`) and correct cookie attributes (`Secure`, `SameSite`, domain) on deploy.
- Session size is bounded by cookie limits — keep the payload minimal.
- Revocation latency is one request: clients hold a stale cookie until they hit the API and get a 401. Acceptable for this deployment model. See `backend/src/services/auth.service.ts` for password-version logic.

Related code

- Auth service: [backend/src/services/auth.service.ts](../../backend/src/services/auth.service.ts#L1)
- Session verification and role enforcement: [backend/src/middleware/rbac.ts](../../backend/src/middleware/rbac.ts#L1)

Related ADRs

- 0003-repository-pattern-with-transactions.md
