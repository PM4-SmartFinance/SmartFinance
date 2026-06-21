---
name: api-and-interface-design
description: Designs stable REST endpoints, module boundaries, and TypeScript contracts. Use when adding or changing endpoints under /api/v1, defining service or repository signatures, designing extension-module interfaces, or shaping component prop contracts.
---

# API and Interface Design (SmartFinance)

Adapted from [addyosmani/agent-skills — api-and-interface-design](https://github.com/addyosmani/agent-skills/blob/main/skills/api-and-interface-design/SKILL.md). Project specifics below.

## Project Context

- REST under **`/api/v1`** — version is part of the URL.
- Auth via httpOnly session cookie. RBAC at the service layer.
- Fastify 5 plugin per controller; JSON Schema for validation; `setErrorHandler` for response shape.
- Layered: controller → service → repository. Services are framework-agnostic.
- Extension architecture: modules register via interfaces, **cannot reach the repository layer**, use namespaced JSON storage.
- Frontend: TanStack Query reads via `api` utility (`src/lib/api.ts`); query keys are descriptive arrays.

## Hyrum's Law

> Every observable behavior of an API is a contract once anyone depends on it.

Implications for this project:

- **Field names + casing on responses** become permanent the moment a frontend ships against them. Changing `categoryName` → `name` is breaking.
- **Error response shape** is part of the contract. Keep `{ error: { code, message } }` consistent.
- **Status codes** are part of the contract — `404` for missing, `409` for conflicts, `422` for validation failures, `403` for authorized-but-forbidden. Don't drift.
- **List shapes** — `{ items, total, limit, offset }` for paginated lists, plain `[…]` for unbounded constants. Pick a convention per resource and keep it.
- **Sort / filter param names** — once `?period=MONTHLY` ships, it can never silently become `?periodType=MONTHLY`.

## Contract First

Define the request / response schema before implementing the handler.

```ts
// 1. Contract — JSON Schema (Fastify validates)
const ListBudgetsQuery = {
  type: "object",
  properties: {
    period: { type: "string", enum: ["DAILY", "MONTHLY", "YEARLY", "DATE_RANGE"] },
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
  },
  additionalProperties: false,
} as const;

// 2. TypeScript type for the response (matches API.md)
interface ListBudgetsResponse {
  budgets: Budget[];
  categorySpending: CategorySpending[];
}

// 3. Implementation comes last
```

Frontend types in `frontend/src/lib/queries/<resource>.ts` mirror the backend response shape — keep them in lockstep when the contract changes.

## Endpoint Naming

- Resources are **plural nouns**: `/transactions`, `/budgets`, `/categories`.
- IDs are path params: `/transactions/:id`.
- Sub-resources: `/users/:id/sessions` (when added).
- Actions that don't fit CRUD use a verb path: `/transactions/auto-categorize`, `/transactions/import`.
- Filters / sort / pagination via querystring: `?page=2&limit=50&sortBy=date&sortOrder=desc&filter=<…>`.
- Module endpoints (extensions, planned): `/modules/:moduleName/...`.

## Error Shape (project standard)

Always:

```jsonc
{
  "error": {
    "code": "EMAIL_CONFLICT",
    "message": "Email already in use",
  },
}
```

- `code` is a stable, machine-readable string (SCREAMING_SNAKE).
- `message` is a human-readable, **non-leaking** sentence.
- `setErrorHandler` produces this shape from any thrown `ServiceError`.
- 5xx in production never includes the originating `Error.message` — only a generic "Internal server error".

## Pagination Contract

```ts
GET /transactions?page=1&limit=50&sortBy=date&sortOrder=desc

200 OK
{
  "data": [ ...transactions ],
  "meta": {
    "totalCount": 12345,
    "totalPages": 247,
    "page": 1,
    "limit": 50
  }
}
```

- `limit` is server-clamped (`Math.min(req.limit ?? 50, 100)`). Never trust the client to bound the page size.
- `page` is 1-indexed in the URL; offset arithmetic stays internal.
- Always send `meta` even if empty — frontend assumes its presence.

## Backend ↔ Frontend Type Alignment

Frontend response types live in `frontend/src/lib/queries/<resource>.ts`. When the backend response shape changes:

1. Update the Prisma / service return type.
2. Update the controller schema (`schema: { response: { 200: <…> } }`).
3. Update `backend/API.md`.
4. Update the frontend interface in the matching `queries/*.ts`.
5. Bump TanStack Query keys if the cache shape is incompatible (rare — most additions are backwards-compatible).

Never silently rename a field — that's a breaking change in the Hyrum sense even if no current consumer reads it.

## Extension-Module Interface Rules

When designing extension hooks (planned):

- Modules receive **plain data** in / out — no Fastify types, no Prisma types.
- Modules **cannot import** from `repositories/*` or `prisma`. Boundary is enforced by review, not by linter.
- Storage is namespaced JSON via a host-provided service (`extensionStore.get(namespace, key)` etc.).
- Module endpoints register under `/modules/:moduleName/*`. The host validates auth before delegating.
- Hooks are sync-or-async pure functions where possible. Side-effecting hooks must declare what they touch.

## Component Prop Interfaces (frontend)

- Inline simple props: `function Foo({ id, name }: { id: string; name: string })`.
- Named `Props` interface only when the shape exceeds ~3 fields or is reused.
- **No `React.FC`.** Type the function, not the component.
- Prefer composition over configuration. `<Card><CardHeader>…</CardHeader><CardBody>…</CardBody></Card>` over `<Card title="…" body={<…/>}>`.

## TanStack Query Key Conventions

Already encoded in CLAUDE.md, restated:

```
["resource"]                              // top-level
["resource", { …params }]                 // parameterized
["resource", id]                          // single
["resource", id, "sub-resource"]          // nested
```

Invalidation by prefix array — `invalidateQueries({ queryKey: ["budgets"] })` matches every nested key.

## The One-Version Rule

Backend versioning is in the URL prefix (`/api/v1`). Until v2 ships:

- Additive changes only on existing endpoints.
- New required request fields are **breaking** — add as optional with a server-side default, OR introduce a new endpoint variant.
- New response fields are **safe** — add at will. Frontend ignores unknown fields.
- Renaming, removing, narrowing types: breaking — coordinate with frontend, plan the cutover.

## Anti-rationalization

| Excuse                                        | Counter                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "I'll add the schema later."                  | Without schema validation, the controller is the wrong layer to discover bad input. Land schema with the route. |
| "Adding a field is safe."                     | Adding a field to a _response_ is safe. Adding a _required_ request field is breaking.                          |
| "It's just an internal endpoint."             | Frontend is a consumer. Anything mounted under `/api` is part of the contract.                                  |
| "We can rename now, no one's using it yet."   | Once it ships in a release, someone (the frontend) is using it. Rename before merge or never.                   |
| "Returning the Prisma error helps debugging." | It also leaks schema. Map to a `ServiceError` with a stable `code`.                                             |

## Verification before merge

- [ ] Every new endpoint has a JSON Schema attached (`schema: { body, params, querystring, response }`).
- [ ] Every new endpoint is documented in `backend/API.md`.
- [ ] Frontend types in `frontend/src/lib/queries/*.ts` match the response shape.
- [ ] Error responses use the project shape (`{ error: { code, message } }`).
- [ ] Pagination uses the `data + meta` envelope.
- [ ] No new endpoint returns Prisma types directly.
- [ ] Status code usage matches the table (404 / 409 / 422 / 403 / 401).
