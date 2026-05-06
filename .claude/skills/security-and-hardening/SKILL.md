---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, auth, sessions, RBAC, file uploads (CSV import), or extension boundaries. Use when introducing or modifying any code that touches dimUser, sessions, or untrusted data.
---

# Security and Hardening (SmartFinance)

Adapted from [addyosmani/agent-skills — security-and-hardening](https://github.com/addyosmani/agent-skills/blob/main/skills/security-and-hardening/SKILL.md). Project specifics below.

## Project Context

- Auth: **Argon2** password hashing, **httpOnly cookie sessions**, RBAC (`ADMIN` / `USER`), planned TOTP 2FA.
- Same-origin: Vite proxy in dev, reverse proxy in prod. **No `@fastify/cors` deliberately** (see memory `feedback_no_cors.md`). Do not flag missing CORS.
- Validation: Fastify 5 JSON Schema validators on every protected endpoint.
- DB: PostgreSQL via Prisma — **all access goes through the repository layer**. No raw SQL outside repos.
- Secrets: env vars only. `.env` ignored.
- Package manager: **Bun**. Use `bun audit` (not `npm audit`).

## Three-Tier Boundary System

### Always Do (no exception)

- **Validate input at the boundary** — controllers attach a Fastify JSON Schema to body / params / querystring. Services trust their typed inputs.
- **Parameterize queries** — Prisma client only. No `$queryRawUnsafe` with user data.
- **Hash passwords with Argon2** — `argon2.hash` / `argon2.verify`. Never plaintext.
- **httpOnly + secure + sameSite cookies** for sessions.
- **All write operations inside an explicit DB transaction** (`prisma.$transaction`). Atomicity is non-negotiable for multi-step writes.
- **Error responses redact internals in production** — `setErrorHandler` returns generic 5xx messages when `NODE_ENV=production`.
- **Throw `ServiceError(status, message)` from services** — never raw `Error` reaching the client.
- **Map Prisma error codes** (P2002 → 409, P2034 → 503, etc.) inside the repository, not in the controller.
- **Argon2 verification on every password operation** — login, change-password, admin reset.
- **Run `bun audit`** before every release PR; before adding any new dependency.

### Ask First (require human confirmation)

- New auth flow or change to login / session / password reset.
- New persisted PII category or change to existing user fields.
- New external integration (e.g., new bank importer talking to a third-party API).
- Any rate-limit relaxation on auth endpoints.
- Granting a new role / permission, or changing the RBAC matrix.
- Adding a new file-upload endpoint or relaxing CSV size / type limits.
- Anything touching the bootstrap-first-admin invariant in `createUserAtomic`.

### Never Do

- Commit `.env`, `*.pem`, `*.key`, or hardcoded secrets.
- Log passwords, full session tokens, or hashed values.
- Trust client-side validation as the security boundary — re-validate server-side.
- Disable security headers for convenience.
- `dangerouslySetInnerHTML` with user content. React auto-escapes — keep it that way.
- Store auth tokens in `localStorage` / `sessionStorage` — sessions are httpOnly cookies.
- Expose stack traces or Prisma error bodies to clients.
- Skip the repository layer ("just one quick query in the controller").
- Bypass `authorize` callback in `createUserAtomic` — bootstrap policy lives there for a reason.

## OWASP Top 10 — Project mapping

| OWASP                         | How project handles it                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control     | RBAC service-layer guards (`requestingUser.role !== "ADMIN"` → 403). Peer-admin guards in `updateUser`, `deleteUser`, `resetUserPassword`. Owner check on every resource that has a `userId`. |
| A02 Cryptographic Failures    | Argon2; HTTPS in prod (TLS 1.2+ per CLAUDE.md); httpOnly+secure+sameSite cookies.                                                                                                             |
| A03 Injection                 | Prisma parameterization. Fastify schema validation at boundary. CSV import — never `eval` row content.                                                                                        |
| A04 Insecure Design           | Layered architecture; repository owns transactions; bootstrap invariant in `createUserAtomic`.                                                                                                |
| A05 Security Misconfiguration | Env-only secrets; production error redaction in `setErrorHandler`.                                                                                                                            |
| A06 Vulnerable Components     | `bun audit` + dependency-audit task. Pin tooling via `.tool-versions`.                                                                                                                        |
| A07 Auth Failures             | Rate limit on `/auth/login`, `/auth/register`. Account lockout via `active=false`. Argon2 verification mandatory.                                                                             |
| A08 Data / Software Integrity | All write paths in DB transactions. Audit log via `auditService.logEvent`.                                                                                                                    |
| A09 Logging / Monitoring      | Pino via `request.log` / `app.log`. **No `console.log` in backend production code.** Audit events for LOGIN*\*, USER*_, ROLE*CHANGED, PASSWORD*_.                                             |
| A10 SSRF                      | No outbound URL fetching from user input today. If added — allowlist hosts.                                                                                                                   |

## Input Validation Pattern (Fastify 5)

```ts
const CreateBudgetSchema = {
  type: "object",
  required: ["categoryId", "type", "limitAmount"],
  properties: {
    categoryId: { type: "string", format: "uuid" },
    type: {
      type: "string",
      enum: [
        "DAILY",
        "MONTHLY",
        "YEARLY",
        "SPECIFIC_MONTH",
        "SPECIFIC_YEAR",
        "SPECIFIC_MONTH_YEAR",
      ],
    },
    limitAmount: { type: "number", minimum: 0 },
    month: { type: "integer", minimum: 1, maximum: 12 },
    year: { type: "integer", minimum: 2000, maximum: 2100 },
  },
  additionalProperties: false,
} as const;

app.post("/budgets", { schema: { body: CreateBudgetSchema } }, async (req) => {
  // req.body is validated; service trusts it
  return budgetService.create(req.user, req.body);
});
```

## File Upload Safety (CSV Import)

Already enforced in `frontend/src/components/CsvImportCard.tsx`:

- 10 MB size limit (`MAX_FILE_SIZE`).
- `.csv` extension check + content-type allowlist.
- Account scoping via `accountId` query param — backend must re-verify ownership.

Backend must additionally:

- Reject if `accountId` does not belong to the authenticated user (403).
- Stream-parse rather than buffer the whole file. Cap row count.
- Run import inside a single `prisma.$transaction` so partial writes never persist (already the design per CLAUDE.md).

## Secrets

```
.env.example   → committed (placeholders only)
.env           → never committed
.env.*.local   → never committed
```

Pre-commit hook (Husky) checks for accidental secret patterns. Do not bypass with `--no-verify`.

## `bun audit` triage

```
bun audit reports a vulnerability
├── critical / high
│   ├── reachable in runtime path? → fix immediately
│   └── dev-only / unreachable    → fix soon, not blocking
├── moderate
│   ├── runtime → next release
│   └── dev    → backlog
└── low → next routine bump
```

Document any deferred CVE with reason + review date in the dependency-audit report.

## Anti-rationalization

| Excuse                                      | Counter                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Frontend already validates the file size." | Client validation is UX, not security. The backend must re-validate; the frontend can be bypassed with a direct API call. |
| "It's just an admin endpoint."              | Admins compromise too. Defense in depth: validate, rate-limit, log.                                                       |
| "Adding CORS would simplify dev."           | Project deliberately uses Vite proxy + reverse proxy for same-origin (`feedback_no_cors.md`). Do not introduce CORS.      |
| "We can log the email on failure."          | Emails are PII. Audit-log via `auditService` (which redacts), not `console.log`.                                          |
| "The error message helps debugging."        | In prod, generic 5xx only. Detail goes to logs, not the response body.                                                    |
| "Bun's audit is noisy."                     | Triage with the table above; don't disable.                                                                               |

## Verification before merge

- [ ] No `process.env.X` defaulted to a real secret in source.
- [ ] `bun audit` clean OR every advisory is triaged in the PR description.
- [ ] All new endpoints have JSON Schema validation on body / params / query.
- [ ] All new write paths execute inside a `prisma.$transaction`.
- [ ] All new service-level policy (RBAC, ownership) has a unit test that exercises the deny path.
- [ ] No new `console.log` in backend production code.
- [ ] No new `dangerouslySetInnerHTML` or HTML-string construction with user data.
- [ ] Auth-touching endpoints have rate limits.
