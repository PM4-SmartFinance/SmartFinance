// Bootstraps the first administrator on a fresh self-hosted database.
//
// Run inside the backend container, reading this file from stdin so the same
// logic is shared by the Linux/macOS and Windows setup scripts:
//
//   docker compose -f docker-compose.user.yml exec -T \
//     -e BOOTSTRAP_EMAIL=... -e BOOTSTRAP_PASSWORD=... \
//     backend node --input-type=module < scripts/bootstrap-admin.mjs
//
// Reference data (currencies, date dimension) is seeded by the backend
// entrypoint before the server accepts traffic, so the first successful POST
// creates the administrator as the very first ADMIN via the bootstrap rule.
//
// Exit codes (the setup scripts branch the completion banner on these):
//   0 — admin created with the supplied credentials (print the credentials).
//   3 — a user already exists, so first-user bootstrap already ran on an
//       earlier setup. The supplied default password may NOT be valid; the
//       scripts must NOT tell the operator to log in with it.
//   1 — fatal: the admin could not be created and does not already exist.

const API_URL = "http://localhost:3000/api/v1/users";
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 5000;
const LOGS_HINT =
  "Inspect the backend logs: docker compose -f docker-compose.user.yml logs backend";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLast = attempt === MAX_ATTEMPTS;

    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        // Bound each attempt so a backend that accepts the TCP connection but
        // never responds (e.g. a migration holding an advisory lock, a wedged
        // DB) cannot hang the whole setup indefinitely.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // Connection refused / DNS / abort-on-timeout — the backend is not ready
      // yet. On the final attempt the cause is named in the timeout message.
      if (isLast) {
        console.error(
          `Timeout: backend API did not become available after ${MAX_ATTEMPTS} attempts ` +
            `(${Math.round((MAX_ATTEMPTS * RETRY_DELAY_MS) / 1000)}s). Last error: ${String(err)}.`,
        );
        console.error(LOGS_HINT);
        process.exit(1);
      }
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    // 201 (created) means the admin was created with the supplied credentials.
    if (response.ok) {
      console.log("[OK] Default admin user created.");
      process.exit(0);
    }

    // A user already exists, so first-user bootstrap already happened on an
    // earlier run. 409 = this email exists; 401 = the unauthenticated POST is
    // rejected because the table is non-empty (the backend's authorize() gate
    // fires before the email-uniqueness check). Either way the stack is healthy
    // and re-running setup must not abort — but the supplied default password
    // may not match the existing account, so signal that with exit code 3.
    if (response.status === 409 || response.status === 401) {
      console.log(
        "[OK] A user already exists; first-user bootstrap already completed on an earlier run.",
      );
      process.exit(3);
    }

    // 5xx can be transient while the backend finishes booting/migrating — retry.
    if (response.status >= 500) {
      if (isLast) {
        console.error(
          `Backend kept returning a server error. Last response: HTTP ${response.status}: ${await safeBody(response)}.`,
        );
        console.error(LOGS_HINT);
        process.exit(1);
      }
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    // Any other 4xx (400 validation, 429 rate-limit, …) means the bootstrap did
    // NOT create the admin and the account does not already exist. Fail loudly
    // so the operator is not told to log in with credentials that do not work.
    console.error(
      `Failed to create admin user (HTTP ${response.status}): ${await safeBody(response)}`,
    );
    console.error(LOGS_HINT);
    process.exit(1);
  }
}

async function safeBody(response) {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}

bootstrapAdmin().catch((e) => {
  console.error("Seeding crashed:", e);
  console.error(LOGS_HINT);
  process.exit(1);
});
