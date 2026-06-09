import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import * as argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

// End-to-end coverage for the import wizard endpoints (KAN-163): header
// auto-detection, manual-mapping import, and saved-mapping reuse.

type SessionCookie = { name: string; value: string };

const TEST_USER_EMAIL = "import.detect.kan163@example.com";
const PASSWORD = "TestPass#123";
const BOUNDARY = "----KAN163Boundary";

let app: FastifyInstance;
let sessionCookie: string;
let userId: string;
let accountId: string;

function fileOnlyBody(filename: string, content: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: text/csv\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

// The mapping field must precede the file part so the controller can read it
// from `fileData.fields`.
function mappingAndFileBody(mapping: unknown, content: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="mapping"\r\n\r\n`),
    Buffer.from(JSON.stringify(mapping)),
    Buffer.from(`\r\n--${BOUNDARY}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="custom.csv"\r\n`),
    Buffer.from(`Content-Type: text/csv\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

function post(url: string, body: Buffer) {
  return app.inject({
    method: "POST",
    url,
    cookies: { session: sessionCookie },
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    payload: body,
  });
}

const NEON_HEADER =
  '"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"';
const NEON_ROW = '"2025-01-15";"42.00";"";"";"";"Grocery Store";"ref";"uncategorized";"";"no";"no"';

const CUSTOM_CSV = [
  "Datum,Empfaenger,Wert",
  "2025-03-01,Coffee,-4.50",
  "2025-03-02,Salary,2000",
].join("\n");
const CUSTOM_MAPPING = { date: "Datum", description: "Empfaenger", amount: "Wert" };

beforeAll(async () => {
  await prisma.dimUser.deleteMany({ where: { email: TEST_USER_EMAIL } });

  const currency = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  const hashedPassword = await argon2.hash(PASSWORD);
  const user = await prisma.dimUser.create({
    data: { email: TEST_USER_EMAIL, password: hashedPassword, defaultCurrencyId: currency.id },
  });
  userId = user.id;

  const account = await prisma.dimAccount.create({
    data: {
      name: "KAN-163 Account",
      iban: "CH99 0000 0000 1163 1163 9",
      userId,
      currencyId: currency.id,
    },
  });
  accountId = account.id;

  app = await buildApp();
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: TEST_USER_EMAIL, password: PASSWORD },
  });
  const cookies = (res.cookies as SessionCookie[]) ?? [];
  const session = cookies.find((c) => c.name === "session");
  if (!session) throw new Error("No session cookie after login");
  sessionCookie = session.value;
});

afterAll(async () => {
  await prisma.dimUser.deleteMany({ where: { email: TEST_USER_EMAIL } });
  await app.close();
});

describe("POST /transactions/import/detect", () => {
  it("auto-detects a built-in importer with full confidence", async () => {
    const res = await post(
      "/api/v1/transactions/import/detect",
      fileOnlyBody("neon.csv", [NEON_HEADER, NEON_ROW].join("\n")),
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detectedFormat).toBe("neon");
    expect(body.confidence).toBe(1);
    // Single active account → suggested automatically.
    expect(body.suggestedAccountId).toBe(accountId);
    // First data row returned for the mapping preview.
    expect(Array.isArray(body.sampleRow)).toBe(true);
    expect(body.sampleRow[0]).toBe("2025-01-15");
    expect(body.savedMapping).toBeNull();
  });

  it("returns null format with columns for an unrecognised header and persists nothing", async () => {
    const before = await prisma.factTransactions.count({ where: { userId } });
    const res = await post("/api/v1/transactions/import/detect", fileOnlyBody("x.csv", CUSTOM_CSV));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detectedFormat).toBeNull();
    expect(body.columns).toEqual(["Datum", "Empfaenger", "Wert"]);
    const after = await prisma.factTransactions.count({ where: { userId } });
    expect(after).toBe(before);
  });
});

describe("POST /transactions/import?format=custom", () => {
  it("rejects a custom import with no mapping field", async () => {
    const res = await post(
      "/api/v1/transactions/import?format=custom",
      fileOnlyBody("custom.csv", CUSTOM_CSV),
    );
    expect(res.statusCode).toBe(400);
  });

  it("imports via a manual mapping and then reuses the saved mapping on detect", async () => {
    const importRes = await post(
      "/api/v1/transactions/import?format=custom",
      mappingAndFileBody(CUSTOM_MAPPING, CUSTOM_CSV),
    );
    expect(importRes.statusCode).toBe(200);
    expect(importRes.json().imported).toBe(2);

    // Acceptance criterion: a saved mapping is applied automatically on a
    // subsequent detect of the same header signature.
    const detectRes = await post(
      "/api/v1/transactions/import/detect",
      fileOnlyBody("again.csv", CUSTOM_CSV),
    );
    expect(detectRes.statusCode).toBe(200);
    expect(detectRes.json().savedMapping).toEqual(CUSTOM_MAPPING);
  });
});
