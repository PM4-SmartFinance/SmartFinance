import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import * as argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string };

const TEST_USER_EMAIL = "import.categorize.kan154@example.com";
const PASSWORD = "TestPass#123";
const BOUNDARY = "----KAN154Boundary";

let app: FastifyInstance;
let sessionCookie: string;
let accountId: string;
let userId: string;
let groceriesCategoryId: string;

function buildMultipartBody(filename: string, content: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: text/csv\r\n`),
    Buffer.from(`\r\n`),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

async function loginAs(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: PASSWORD },
  });
  const cookies = (res.cookies as SessionCookie[]) ?? [];
  const session = cookies.find((c) => c.name === "session");
  if (!session) throw new Error(`No session cookie after login for ${email}`);
  return session.value;
}

const ZKB_HEADER =
  '"Date";"Booking text";"Curr";"Amount details";"ZKB reference";"Reference number";"Debit CHF";"Credit CHF";"Value date";"Balance CHF";"Payment purpose";"Details"';

function zkbRow(date: string, bookingText: string, debit: string, ref: string): string {
  return `"${date}";"${bookingText}";"";"";"${ref}";"";"${debit}";"";"${date}";"0.00";"";""`;
}

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
      name: "KAN-154 Account",
      iban: "CH99 0000 0000 1154 1154 9",
      userId,
      currencyId: currency.id,
    },
  });
  accountId = account.id;

  const category = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId },
  });
  groceriesCategoryId = category.id;

  app = await buildApp();
  await app.ready();

  sessionCookie = await loginAs(TEST_USER_EMAIL);
});

afterAll(async () => {
  await app.close();
  await prisma.dimUser.deleteMany({ where: { email: TEST_USER_EMAIL } });
});

async function importZkb(csv: string) {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/transactions/import?accountId=${accountId}&format=zkb`,
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    cookies: { session: sessionCookie },
    payload: buildMultipartBody("zkb.csv", Buffer.from(csv)),
  });
  return {
    statusCode: res.statusCode,
    body: res.json<{ imported: number; categorized: number }>(),
  };
}

async function listAll() {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/transactions?startDate=2020-01-01&endDate=2030-12-31&limit=100",
    cookies: { session: sessionCookie },
  });
  return res.json<{
    data: Array<{ categoryId: string | null; categoryName: string | null; merchant: string }>;
  }>();
}

describe("KAN-154: imported transactions surface assigned categories via GET /transactions", () => {
  it("rule-first → import → list returns categoryName populated for matching rows", async () => {
    // Create rule BEFORE importing — auto-categorize runs during import.
    await prisma.categoryRule.create({
      data: {
        userId,
        categoryId: groceriesCategoryId,
        pattern: "Groceries",
        matchType: "contains",
        priority: 0,
      },
    });

    const csv = [
      ZKB_HEADER,
      zkbRow(
        "01.05.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Groceries",
        "3.60",
        "T0001",
      ),
      zkbRow(
        "01.05.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Groceries",
        "6.50",
        "T0002",
      ),
      zkbRow(
        "30.04.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Restaurant / food",
        "65.00",
        "T0003",
      ),
    ].join("\n");

    const { statusCode, body } = await importZkb(csv);
    expect(statusCode).toBe(200);
    expect(body.imported).toBe(3);
    expect(body.categorized).toBe(2);

    const list = await listAll();
    const groceriesRows = list.data.filter((r) => r.categoryId === groceriesCategoryId);
    expect(groceriesRows).toHaveLength(2);
    for (const row of groceriesRows) {
      expect(row.categoryName).toBe("Groceries");
    }

    // Reset state for next test.
    await prisma.categoryRule.deleteMany({ where: { userId } });
    await prisma.factTransactions.deleteMany({ where: { userId } });
  });

  it("import-first → rule creation retroactively categorizes matching rows (KAN-154 fix)", async () => {
    // Import BEFORE any rule exists — rows land uncategorized in DB.
    const csv = [
      ZKB_HEADER,
      zkbRow(
        "02.05.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Groceries",
        "4.40",
        "U0001",
      ),
      zkbRow(
        "02.05.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Groceries",
        "9.90",
        "U0002",
      ),
      zkbRow(
        "01.05.2026",
        "Purchase ZKB Visa Debit card no. xxxx 0000, Restaurant / food",
        "12.00",
        "U0003",
      ),
    ].join("\n");

    const importResult = await importZkb(csv);
    expect(importResult.statusCode).toBe(200);
    expect(importResult.body.imported).toBe(3);
    expect(importResult.body.categorized).toBe(0);

    const before = await listAll();
    expect(before.data.every((r) => r.categoryId === null)).toBe(true);

    // Now create the rule — the service must retroactively categorize.
    const ruleRes = await app.inject({
      method: "POST",
      url: "/api/v1/category-rules",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: groceriesCategoryId,
        pattern: "Groceries",
        matchType: "contains",
        priority: 0,
      },
    });
    expect(ruleRes.statusCode).toBe(201);

    const after = await listAll();
    const groceriesRows = after.data.filter((r) => r.categoryId === groceriesCategoryId);
    expect(groceriesRows).toHaveLength(2);
    for (const row of groceriesRows) {
      expect(row.categoryName).toBe("Groceries");
    }
  });
});
