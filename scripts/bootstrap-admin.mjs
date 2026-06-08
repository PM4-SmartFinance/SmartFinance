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

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;
  let attempts = 30;

  while (attempts > 0) {
    attempts--;
    let response;
    try {
      response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Backend not accepting connections yet -- retry.
      if (attempts === 0) {
        console.error("Timeout: Backend API did not become available.");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    // 201 (created) or 409 (already exists) both mean the admin is present.
    if (response.ok || response.status === 409) {
      console.log("[OK] Default admin user created (or already present).");
      process.exit(0);
    }

    // 5xx can be transient while the backend finishes booting/migrating -- retry.
    if (response.status >= 500) {
      if (attempts === 0) {
        console.error("Backend kept returning " + response.status + ": " + (await response.text()));
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    // 4xx (401/403/400/...) means the bootstrap did NOT create the admin (e.g.
    // users already exist, or validation failed). Fail loudly so the operator is
    // not told to log in with credentials that do not work.
    console.error(
      "Failed to create admin user (HTTP " + response.status + "): " + (await response.text()),
    );
    process.exit(1);
  }
}

bootstrapAdmin().catch((e) => {
  console.error("Seeding crashed:", e);
  process.exit(1);
});
