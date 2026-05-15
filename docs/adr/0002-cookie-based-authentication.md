# 0002 — Cookie-based Authentication (httpOnly sessions vs JWT)

Status: Accepted

Date: 2026-05-15

Context

Authentication can be implemented with stateless JWTs or server-managed sessions. The application must protect against XSS and CSRF while keeping the auth model simple for a single-tenant self-hosted deployment.

Decision

Use httpOnly cookie-based server sessions (secure, sameSite where applicable) and store minimal session user data server-side via signed cookies. Store password version stamps in the session to allow forced re-login on password rotation. Passwords are hashed with Argon2.

Rationale

- httpOnly cookies prevent JavaScript from reading tokens, mitigating XSS token theft.
- Server sessions make immediate revocation (logout, account deactivation, password rotation) straightforward (see `backend/src/middleware/rbac.ts`).
- Simpler for the single-tenant deployment model and integrates well with Fastify's `secure-session` plugin.

Consequences

- Requires `credentials: include` from the frontend API client and cookie configuration on deploy.
- Slightly more server state (session data) but we keep sessions small and stateless in terms of server storage (signed cookies). See `backend/src/services/auth.service.ts` for password-version logic.

Related code

- Auth service: [backend/src/services/auth.service.ts](../../backend/src/services/auth.service.ts#L1)
- Session verification and role enforcement: [backend/src/middleware/rbac.ts](../../backend/src/middleware/rbac.ts#L1)

Related ADRs

- 0006-api-versioning-strategy.md
