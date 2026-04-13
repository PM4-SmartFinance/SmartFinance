# Dependency Audit & Alignment

Audit all `package.json` files (root, frontend, backend) and the `bun.lock` lockfile for dependency hygiene.

## Steps

1. **Read all package.json files** — root, `frontend/package.json`, `backend/package.json`.
2. **Find duplicates across workspaces** — identify packages that appear in more than one `package.json` with differing version ranges. List them and move them into root.
3. **Unify duplicates** — for any package appearing in multiple places, align to a single version range. Prefer the newest range that is compatible with all consumers. If a package belongs in root (shared tooling), hoist it there and remove from workspace-level files.
4. **Check for latest stable versions** — for every package, look up the latest stable release on npm (use `bun info <pkg>` or `npm view <pkg> version`). Flag packages where the current range excludes the latest version within the same major (e.g. `^5.1.0` when `5.4.2` is out — the range covers it, but the minimum should be bumped for clarity).
5. **Skip risky major bumps** — do NOT bump to a new major version if it was released less than ~6 months ago. Flag these for manual review instead.
6. **Update package.json files** — apply the aligned, updated version ranges.
7. **Regenerate lockfile** — run `bun install` to update `bun.lock`.
8. **Verify** — run `bun run lint` and `bun run --cwd frontend build` and `bun run --cwd backend build` to confirm nothing broke.

## Notes

- This project uses **Bun** as package manager — never use npm or yarn commands.
- Node.js version is pinned in `.tool-versions` — `@types/node` major should match that Node.js major version.
- Root `package.json` holds shared dev tooling (ESLint, Prettier, TypeScript, Husky, lint-staged).
- Frontend and backend each have their own runtime and dev dependencies.
