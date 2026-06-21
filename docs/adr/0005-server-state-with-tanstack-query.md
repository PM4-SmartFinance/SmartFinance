# 0005 — Server State with TanStack Query

Status: Accepted

Date: 2026-05-15

Context

Client-side state can be implemented with many libraries (Redux, Zustand, TanStack Query). The app needs clear separation between server-backed data and ephemeral UI state.

Decision

- Use TanStack Query (`@tanstack/react-query`) for server state (all data fetched from `/api/v1`).
- Use Zustand for client-only state (UI flags, local preferences).

Rationale

- TanStack Query provides caching, background refetching, deduplication, and mutation helpers which are ideal for REST-backed server state. It simplifies cache invalidation patterns needed after writes (see `frontend/src/lib/queries/*` usage).
- Zustand is lightweight and fits well for local UI state (see `frontend/src/store/appStore.ts`).
- Redux was not chosen to avoid additional boilerplate and complexity; the combined TanStack+Zustand approach minimizes cognitive load and bundle size while maintaining clear separation of concerns.

Consequences

- Avoid storing server-derived data in Zustand — it creates duplication and stale data issues.
- Use `useQuery` / `useMutation` patterns and central `queryClient` invalidation/updates for writes.

Related code

- Frontend queries usage: `frontend/src/pages/*` and `frontend/src/lib/queries` (see coverage for many `useQuery` / `useMutation` usages)
- Client store: [frontend/src/store/appStore.ts](../../frontend/src/store/appStore.ts)

Related ADRs

- 0001-layered-architecture.md
