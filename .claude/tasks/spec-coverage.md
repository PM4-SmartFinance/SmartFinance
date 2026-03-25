# Spec Coverage Check

Analyse test coverage for changed files. Identify missing tests and untested edge cases.

## Steps

1. **Identify changed files** — run `git diff main...HEAD --name-only` to list all files changed on the current branch. Filter to source files (`.ts`, `.tsx`) in `src/` directories.

2. **Map source files to test files** — for each changed source file, check if a corresponding test file exists:
   - `<name>.test.ts` / `<name>.test.tsx` (co-located)
   - `__tests__/<name>.test.ts` (test directory)
   - Flag files without any test file.

3. **Read existing tests** — for each test file found, read it and catalogue:
   - Number of test cases (`it` / `test` blocks)
   - What scenarios are covered (happy path, error cases, edge cases, boundary values)
   - Whether mocks/stubs are used appropriately

4. **Read source files** — for each changed source file, identify:
   - Public functions/methods and their signatures
   - Error paths (throw statements, early returns, catch blocks)
   - Branching logic (if/else, switch, ternary)
   - External dependencies (DB calls, API calls, file system)

5. **Gap analysis** — compare source complexity against test coverage:
   - Untested public functions
   - Missing error case tests
   - Untested branches or conditional paths
   - Missing integration tests (e.g. controller + service together)
   - Missing edge cases (empty arrays, null values, boundary numbers)

6. **Run coverage report** — execute `bun run test:coverage` and parse the output. Highlight files below 70% line coverage.

7. **Write report** — output a structured markdown report:
   - Summary table: file → test file → test count → estimated coverage → status
   - Detailed gaps per file with suggested test cases
   - Priority ranking: critical gaps first (untested business logic > untested utilities)

## Notes

- This project uses **Vitest** as test runner.
- Test files should be co-located with source files (`*.test.ts` next to `*.ts`).
- Focus on business logic in services and repositories. UI component tests are lower priority.
- The quality target is at least 70% coverage on core business logic.
