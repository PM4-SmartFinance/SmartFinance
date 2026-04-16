# Git and Branching Strategy

To ensure a stable `main` branch for our Docker builds and maintain a clean history across the frontend and backend monorepo, SmartFinance uses a continuous delivery workflow based on GitHub Flow.

We tightly integrate GitHub with Jira. By including Jira ticket IDs in our branches and commits, Jira will automatically track our development progress, link code changes to requirements, and update ticket statuses.

## 1. Branching Workflow

SmartFinance uses two permanent branches:

- **`main`** (Production) — stable, release-only. Never commit directly. Updated only via release PRs from `develop` at end of sprint.
- **`develop`** (Pre-Production/Staging) — active integration branch. All feature/bugfix PRs target `develop` for testing before release.

All new development must happen in isolated branches created from the latest `develop`. Direct commits to `main` or `develop` are strictly prohibited.

## 2. Branch Naming Conventions

Prefix your branches to indicate the type of work being done, followed by the Jira ticket number, and a brief kebab-case description. Including the Jira ID allows Jira to link the branch directly to the ticket.

Format: `<type>/<JIRA-ID>-<description>`

- **feature/** - For new functionalities or modules.
  Example: `feature/KAN-19-import-adapter-interface`
- **bugfix/** - For fixing bugs found in the application.
  Example: `bugfix/KAN-22-postgres-connection-timeout`
- **docs/** - For documentation updates.
  Example: `docs/KAN-23-define-branching-strategy`
- **refactor/** - For code changes that neither fix a bug nor add a feature
  Example: `refactor/KAN-25-api-service-layer`

## 3. Commit Message Conventions

We follow Conventional Commits to make our history readable. You must include the Jira ticket ID in your commit message. This ensures every individual code change is logged in the history of the Jira ticket.

Format: `<type>(<scope>)?: [<JIRA-ID>] <subject>`

- **Types:**
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code (formatting)
  - `refactor`: A code change that neither fixes a bug nor adds a feature
  - `test`: Adding missing tests or correcting existing tests
  - `chore`: Changes to the build process or auxiliary tools
  - `ci`: Changes to CI/CD configuration
  - `build`: Changes that affect the build system or dependencies
  - `perf`: Changes that improve performance

- **Scope (Optional):** Use any lowercase scope text to indicate the affected part of the monorepo (for example, `frontend`, `backend`, `docker`, `db`, `root`, `infra`).

- **Examples:**
  - `feat(backend): [KAN-10] implement RBAC middleware for protected routes`
  - `fix(frontend): [KAN-15] resolve layout shift on mobile dashboard`
  - `docs(root): [KAN-23] add CONTRIBUTING.md with team branching strategy`

## 4. Pull Request (PR) Process

1. Open a PR against the `develop` branch once your feature or fix is complete.
2. Include the Jira ticket ID in the PR title (e.g., `[KAN-23] Define branching strategy`). This automatically links the PR to Jira.
3. Ensure the automated CI pipeline passes successfully.
4. Request a review from at least one other team member.
5. Address any feedback and update the branch.
6. Once approved, use **Squash and Merge** to integrate your code into `develop`.
7. Delete the feature branch after merging.

**Release PRs:** At the end of each sprint, a release PR is created from `develop` → `main`. This is the only time code is merged into `main`.

## 5. Pre-commit Hooks and Linting

We use Husky and lint-staged to automatically format and lint code before it is committed.

- When you run `git commit`, Prettier will format your staged files, and ESLint will check for structural errors.
- If ESLint finds severe, unfixable errors, your commit will be safely blocked.
- **How to handle failures:** Read the terminal output to locate the specific line causing the linting error. Fix the issue in your IDE, stage the file again using `git add <file>`, and re-run your `git commit` command. Do not use the `--no-verify` flag to bypass these checks.
