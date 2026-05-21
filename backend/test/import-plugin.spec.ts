import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import * as argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";
import FormData from "form-data";

type SessionCookie = { name: string; value: string };

const TEST_USER_EMAIL = "import.plugin.test@example.com";
const PASSWORD = "TestPass#123";

let app: FastifyInstance;
let sessionCookie: string;
let accountId: string;

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

  const account = await prisma.dimAccount.create({
    data: {
      name: "Plugin Test Account",
      iban: "CH99 0000 0000 9999 9999 9",
      userId: user.id,
      currencyId: currency.id,
    },
  });
  accountId = account.id;

  app = await buildApp();
  await app.ready();

  sessionCookie = await loginAs(TEST_USER_EMAIL);
});

afterAll(async () => {
  await app.close();
  await prisma.dimUser.deleteMany({ where: { email: TEST_USER_EMAIL } });
});

const MOCK_CSV = [
  "date,amount,description",
  "2024-03-01,-42.50,Coffee Shop",
  "2024-03-02,1500.00,Salary",
  "2024-03-03,-10.00,Supermarket",
].join("\n");

describe("mock-bank plugin — full import flow", () => {
  it("GET /transactions/import/formats includes mock-bank", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/import/formats",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const { formats } = res.json<{ formats: { value: string; label: string }[] }>();
    expect(formats.some((f) => f.value === "mock-bank")).toBe(true);
    expect(formats.some((f) => f.value === "neon")).toBe(true);
  });

  it("POST /transactions/import with mock-bank format inserts rows to DB", async () => {
    const form = new FormData();
    form.append("file", Buffer.from(MOCK_CSV), { filename: "test.csv", contentType: "text/csv" });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/import?accountId=${accountId}&format=mock-bank`,
      headers: { ...form.getHeaders(), cookie: `session=${sessionCookie}` },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ imported: number; categorized: number }>();
    expect(body.imported).toBe(3);

    const transactions = await prisma.factTransactions.findMany({
      where: { accountId },
      include: { merchant: true },
      orderBy: { createdAt: "asc" },
    });

    expect(transactions).toHaveLength(3);
    expect(transactions.map((t) => Number(t.amount))).toEqual(
      expect.arrayContaining([-42.5, 1500, -10]),
    );
    expect(transactions.map((t) => t.merchant.name)).toEqual(
      expect.arrayContaining(["Coffee Shop", "Salary", "Supermarket"]),
    );
  });

  it("returns 400 for an unregistered format", async () => {
    const form = new FormData();
    form.append("file", Buffer.from("data"), { filename: "test.csv", contentType: "text/csv" });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/import?accountId=${accountId}&format=nonexistent-bank`,
      headers: { ...form.getHeaders(), cookie: `session=${sessionCookie}` },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 422 for a malformed mock-bank CSV", async () => {
    const badCsv = ["date,amount,description", "not-a-date,-5.00,Shop"].join("\n");
    const form = new FormData();
    form.append("file", Buffer.from(badCsv), { filename: "bad.csv", contentType: "text/csv" });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/import?accountId=${accountId}&format=mock-bank`,
      headers: { ...form.getHeaders(), cookie: `session=${sessionCookie}` },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/import/formats",
    });
    expect(res.statusCode).toBe(401);
  });
});
