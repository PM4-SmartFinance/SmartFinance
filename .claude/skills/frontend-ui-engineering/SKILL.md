---
name: frontend-ui-engineering
description: Builds production-quality React 19 UIs that match SmartFinance conventions. Use when creating or modifying components, layouts, forms, charts, or any user-facing interface. Use when accessibility, semantic HTML, or design-token compliance is at risk.
---

# Frontend UI Engineering (SmartFinance)

Adapted from [addyosmani/agent-skills — frontend-ui-engineering](https://github.com/addyosmani/agent-skills/blob/main/skills/frontend-ui-engineering/SKILL.md). Project specifics below.

## Project Context

- **React 19** (`react@^19.2.0`). Use `use()` over `useContext`. Render `<Context>` directly as a provider.
- **TypeScript strict.** No `any`, no type assertions unless unavoidable.
- **Vite + Tailwind + CSS variables.** Design tokens via `hsl(var(--primary))` etc. No CSS-in-JS runtime.
- **TanStack Query** for server state. **Zustand** for client state. Never mix.
- **`fetch` only** via `src/lib/api.ts`. No Axios.
- **No barrel files.** Import directly.
- **Recharts** for charts.
- **`react-router`** for routing (no `react-router-dom`).
- **No business logic in components.** Components receive data and render.
- Tests with **Vitest** + `@testing-library/react`, `@testing-library/user-event`.

## Component Architecture

### Earn the abstraction

Inline JSX is fine. Don't extract a wrapper / layout / "atom" component until there are two or more consumers OR the inline JSX has real logic worth naming.

### Colocation

Component-local types, helpers, and styles live next to the component. Promote to shared modules only on the second consumer.

### One file per component

```
src/components/BudgetProgressWidget.tsx        // component + local helpers
src/components/BudgetProgressWidget.test.tsx   // tests
```

No `index.ts` re-exports.

### Composition over configuration

```tsx
// Yes
<Card>
  <CardHeader><CardTitle>Budgets</CardTitle></CardHeader>
  <CardContent>{children}</CardContent>
</Card>

// No — explodes into prop bombs
<Card title="Budgets" headerVariant="lg" content={<…/>} bodyPadding="md" />
```

### Prop typing

- ≤3 fields: inline. `function Foo({ id, name }: { id: string; name: string })`.
- More: a named `Props` interface in the same file.
- **Never `React.FC`.** Type the function, not the component.
- Discriminated unions for prop variants over boolean flags.

## Semantic HTML First

Reach for the right HTML element before adding ARIA.

| Use                                           | Not                                              |
| --------------------------------------------- | ------------------------------------------------ |
| `<button type="button">`                      | `<div role="button" tabIndex={0} onKeyDown={…}>` |
| `<nav>`                                       | `<div className="nav">`                          |
| `<main>`, `<section>`, `<article>`, `<aside>` | nested `<div>`                                   |
| `<dialog>` (or Radix Dialog)                  | `<div role="dialog">`                            |
| `<label htmlFor="x">` + `<input id="x">`      | floating text + bare input                       |
| `<form>` with `onSubmit`                      | `<div>` + click-handler-on-button                |

Native semantics give keyboard navigation, focus management, and screen-reader behavior for free. PR #93 left a drop zone as `<div role="button">` — a real `<button>` would have removed the manual `onKeyDown` and `tabIndex`.

## Accessibility (WCAG 2.1 AA)

- **Color contrast ≥ 4.5:1** for text. Tailwind tokens already satisfy when used as designed.
- **Keyboard reachability** for every interactive element. `Tab` cycles, `Enter`/`Space` activates.
- **Visible focus ring.** Don't `outline: none` without a replacement.
- **`aria-label`** for icon-only buttons.
- **`aria-live="polite"`** for non-blocking status (success / error toasts).
- **`role="alert"`** for blocking error messages.
- **Form errors** announced near the input, with `aria-describedby` linking to the message.
- **Dialogs / popovers** trap focus and restore it on close.
- **Charts** are visual sugar — pair with the underlying number in text. Recharts containers should never be the only source of information.
- **Decorative SVGs** get `aria-hidden="true"`.
- Test with keyboard only at least once per feature.

## State

### Server state — TanStack Query

```ts
const { data, isLoading, error } = useBudgets({ period: "MONTHLY" });
```

- Always use the `api` utility as `queryFn` (handles credentials, error normalization).
- Query keys are descriptive arrays: `["budgets", { period }]`, `["transactions", { page, filter }]`.
- Mutations invalidate by **prefix array** to refresh nested keys: `invalidateQueries({ queryKey: ["budgets"] })`.
- Multi-key invalidation after a write (e.g., import) — list the keys in a constant and iterate, OR use `Promise.all` (await) to surface failures.
- **`error instanceof ApiError`** to access `status` / `body`.

### Client state — Zustand

```ts
const sidebarOpen = useAppStore((s) => s.sidebarOpen);
```

- Always select the minimal slice. `useAppStore()` (full store) re-renders on every change.
- Synchronous actions only. No fetching from a Zustand action.
- No auth state in Zustand — `useAuth()` is server state via TanStack Query.

### Don't mix

- Never copy server data into Zustand to "simplify" reads. Subscribe via TanStack Query.
- Never fetch in a `useEffect` to seed Zustand. Use `useQuery`.

## Effects — minimize

Most `useEffect` is unnecessary. Before writing one:

- Could this be **derived during render**? Then drop the effect.
- Is it a **side effect of an event**? Move it to the event handler.
- Is it **server data**? Use `useQuery` / `useMutation`.
- Is it **subscribing to an external store**? Use `useSyncExternalStore` (or wrap in a hook).
- Is it **logging derived state**? Configure `QueryCache({ onError })` globally instead of per-component effect.

If after that an effect still belongs in a component, keep its dependency array tight and prefer `AbortController` for any async work.

## Styling

- Tailwind utilities first.
- Use **design tokens** — `hsl(var(--primary))`, `bg-destructive`, `text-muted-foreground`. Don't hardcode hex (`#ef4444`) when a token exists.
- Dark-mode awareness: tokens flip automatically. Hardcoded colors break dark mode.
- CSS Modules acceptable when utility soup hurts readability.
- No CSS-in-JS runtime libraries.

## Forms

- Native `<form onSubmit>` over click-handler-on-button.
- Server-side validation is the source of truth; client-side is UX.
- Disable submit during pending mutation (`isPending`).
- Show server errors near the field where possible. Use `role="alert"` for top-level error messages.

## Loading / Empty / Error — three states, always

Every data-driven component handles all three:

```tsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorBanner onRetry={refetch} />;
if (!data?.length) return <EmptyState />;
return <List items={data} />;
```

The "no data yet" state is not the same as "error". The "error" state is not the same as "empty".

## Testing

- `QueryClientProvider` + `MemoryRouter` wrappers in test setup helpers.
- Mock `api` from `../lib/api`, not `fetch`.
- Prefer `@testing-library/user-event` over `fireEvent`.
- Assert on **what the user sees** (`getByRole`, `getByText`), not on `getByTestId` if a role works.
- Avoid `mockReturnValueOnce` ordering — switch to `mockImplementation` keyed on argument when a hook is called multiple times.

## Anti-rationalization

| Excuse                                        | Counter                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| "I need a wrapper component for consistency." | Two consumers minimum. Until then, inline.                                       |
| "Adding ARIA fixes accessibility."            | Native HTML fixes accessibility. ARIA is for when native doesn't fit.            |
| "I'll memoize everything."                    | `useMemo` costs too. Measure first. Most components don't need it.               |
| "An `useEffect` to log errors is fine."       | TanStack Query exposes errors. Log via global handler, not per-component effect. |
| "I'll use `any` here, it's just a chart."     | Charts are user-facing. `any` propagates. Type it.                               |
| "It's only one missing focus ring."           | One missing focus ring breaks keyboard users.                                    |

## Red flags in PRs

- `<div role="button">` / `<div onClick>` instead of `<button>`.
- Hardcoded color hex when a token exists.
- `useEffect` that only logs.
- TanStack Query data copied into `useState`.
- Component file with both fetching and UI logic and form state — split.
- Inline `style={{ ... }}` with token-replaceable values.
- Missing loading or empty state on a data-driven view.
- New chart with no text equivalent for accessibility.

## Verification before merge

- [ ] Component renders correctly in dev (`bun run --filter @smartfinance/frontend dev`).
- [ ] Keyboard-only walkthrough of the changed UI works (Tab, Enter/Space, Esc).
- [ ] Loading / empty / error all visually verified.
- [ ] No new hardcoded color literals where a token exists.
- [ ] No new `useEffect` for fetching or for purely-derived state.
- [ ] No new `any`.
- [ ] Tests use `getByRole` / `getByLabelText` over `getByTestId` where possible.
- [ ] Dark mode visually correct.
