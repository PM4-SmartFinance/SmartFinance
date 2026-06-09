import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CsvImportWizard } from "./CsvImportWizard";
import { api, ApiError } from "../lib/api";

vi.mock("../lib/api", () => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: { get: vi.fn(), upload: vi.fn(), post: vi.fn() },
    ApiError: MockApiError,
  };
});

const mockGet = vi.mocked(api.get);
const mockUpload = vi.mocked(api.upload);
const mockPost = vi.mocked(api.post);

const FORMATS = [
  { value: "neon", label: "Neon" },
  { value: "zkb", label: "ZKB" },
  { value: "wise", label: "Wise" },
  { value: "ubs", label: "UBS" },
];

type Acct = {
  id: string;
  name: string;
  iban: string;
  accountNumber: string | null;
  active: boolean;
};
const ACC1: Acct = {
  id: "acc-1",
  name: "Main",
  iban: "CH93 0001",
  accountNumber: null,
  active: true,
};
const ACC2: Acct = {
  id: "acc-2",
  name: "Savings",
  iban: "CH56 0002",
  accountNumber: null,
  active: true,
};

function baseDetect(over: Partial<Record<string, unknown>> = {}) {
  return {
    detectedFormat: "neon",
    confidence: 1,
    columns: ["Date", "Amount", "Description"],
    headerSignature: "sig",
    savedMapping: null,
    suggestedAccountId: "acc-1",
    ...over,
  };
}

let accountsValue: Acct[];
let detectResponder: () => Promise<unknown>;
let importResponders: Array<() => Promise<unknown>>;
let importFallback: () => Promise<unknown>;

const ok = (v: unknown) => () => Promise.resolve(v);
const fail = (e: unknown) => () => Promise.reject(e);

const isDetect = (p: unknown) => typeof p === "string" && p.includes("/transactions/import/detect");
const setDetect = (r: unknown) => (detectResponder = ok(r));
const setImport = (fn: () => Promise<unknown>) => (importFallback = fn);
const queueImport = (...fns: Array<() => Promise<unknown>>) => importResponders.push(...fns);
const importCalls = () => mockUpload.mock.calls.filter(([p]) => !isDetect(p));
const detectCalls = () => mockUpload.mock.calls.filter(([p]) => isDetect(p));

function makeCsvFile(name = "export.csv") {
  return new File(["date,amount\n2025-01-01,42"], name, { type: "text/csv" });
}

function renderWizard(extra?: { onClose?: () => void; onImported?: (r: unknown) => void }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = extra?.onClose ?? vi.fn();
  const onImported = extra?.onImported ?? vi.fn();
  render(
    <QueryClientProvider client={client}>
      <CsvImportWizard file={makeCsvFile()} onClose={onClose} onImported={onImported} />
    </QueryClientProvider>,
  );
  return { onClose, onImported };
}

async function openOption(triggerLabel: string, optionName: string | RegExp) {
  await userEvent.click(screen.getByLabelText(triggerLabel));
  await userEvent.click(await screen.findByRole("option", { name: optionName }));
}

beforeEach(() => {
  mockGet.mockReset();
  mockUpload.mockReset();
  mockPost.mockReset();

  accountsValue = [ACC1];
  detectResponder = ok(baseDetect());
  importResponders = [];
  importFallback = ok({ imported: 3 });

  mockGet.mockImplementation((path: string) => {
    if (path === "/transactions/import/formats") return Promise.resolve({ formats: FORMATS });
    if (path === "/accounts") return Promise.resolve({ accounts: accountsValue });
    return Promise.resolve({});
  });
  mockUpload.mockImplementation((path: string) => {
    if (isDetect(path)) return detectResponder();
    return (importResponders.shift() ?? importFallback)();
  });
  mockPost.mockImplementation((path: string, body: unknown) => {
    if (path === "/accounts") {
      const input = body as { name: string; iban: string };
      const created: Acct = {
        id: "acc-new",
        name: input.name,
        iban: input.iban,
        accountNumber: null,
        active: true,
      };
      accountsValue = [...accountsValue, created];
      return Promise.resolve({ account: created });
    }
    return Promise.resolve({});
  });
});

describe("detection on open", () => {
  it("posts the file to the detect endpoint once", async () => {
    renderWizard();
    await waitFor(() => expect(detectCalls()).toHaveLength(1));
    expect(detectCalls()[0]![0]).toBe("/transactions/import/detect");
    expect((detectCalls()[0]![1] as FormData).get("file")).toBeInstanceOf(File);
  });

  it("shows the analyzing state until detection settles", async () => {
    let resolve!: (v: unknown) => void;
    detectResponder = () => new Promise((r) => (resolve = r));
    renderWizard();
    expect(await screen.findByText("Analyzing file…")).toBeInTheDocument();
    resolve(baseDetect());
    await waitFor(() => expect(screen.queryByText("Analyzing file…")).not.toBeInTheDocument());
  });
});

describe("prefill from detection", () => {
  it("imports a built-in format with format + accountId and no mapping", async () => {
    setDetect(baseDetect({ detectedFormat: "zkb" }));
    renderWizard();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const [path, body] = importCalls()[0]!;
    expect(path).toContain("format=zkb");
    expect(path).toContain("accountId=acc-1");
    expect((body as FormData).get("mapping")).toBeNull();
  });

  it("leaves format and account empty and disables import when nothing matched", async () => {
    setDetect(baseDetect({ detectedFormat: null, suggestedAccountId: null, savedMapping: null }));
    accountsValue = [ACC1, ACC2];
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText("Account")).toBeInTheDocument());
    expect(screen.getByLabelText("Format")).toHaveTextContent("Select a format");
    expect(screen.getByLabelText("Account")).toHaveTextContent("Select an account");
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });
});

describe("saved mapping (smart importer)", () => {
  it("pre-selects the saved mapping and prefills the form", async () => {
    const saved = { date: "Date", description: "Description", amount: "Amount" };
    setDetect(
      baseDetect({ detectedFormat: null, savedMapping: saved, suggestedAccountId: "acc-1" }),
    );
    renderWizard();

    // The saved mapping being pre-selected reveals the mapping form.
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const [path, body] = importCalls()[0]!;
    expect(path).toContain("format=custom");
    expect(path).toContain("accountId=acc-1");
    const fd = body as FormData;
    expect([...fd.keys()]).toEqual(["mapping", "file"]);
    expect(JSON.parse(fd.get("mapping") as string)).toEqual(saved);
  });
});

describe("custom mapping", () => {
  it("maps columns and imports via format=custom", async () => {
    setDetect(
      baseDetect({
        detectedFormat: null,
        columns: ["Datum", "Beschreibung", "Betrag"],
        savedMapping: null,
        suggestedAccountId: "acc-1",
      }),
    );
    renderWizard();
    // Wait for detection to settle (controls rendered).
    await screen.findByLabelText("Format");

    await openOption("Format", "Custom mapping");
    await openOption("Date column", "Datum");
    await openOption("Description column", "Beschreibung");
    await openOption("Amount column", "Betrag");
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const fd = importCalls()[0]![1] as FormData;
    expect([...fd.keys()]).toEqual(["mapping", "file"]);
    expect(JSON.parse(fd.get("mapping") as string)).toEqual({
      date: "Datum",
      description: "Beschreibung",
      amount: "Betrag",
    });
  });
});

describe("inline create account", () => {
  it("shows the create form when the user has no active account, then selects the new one", async () => {
    accountsValue = [];
    setDetect(baseDetect({ detectedFormat: "neon", suggestedAccountId: null }));
    renderWizard();

    await waitFor(() => expect(screen.getByText("No account yet")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Account name"), "New");
    await userEvent.type(screen.getByLabelText("IBAN"), "CH93 0076 2011 6238 5295 7");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    // Create form gone (account now exists) and the new account auto-selected,
    // which — with the pre-filled Neon format — enables Import.
    await waitFor(() => expect(screen.queryByText("No account yet")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());
  });
});

describe("errors and lifecycle", () => {
  it("surfaces a backend import error", async () => {
    setImport(fail(new ApiError(422, null, "Column 'Betrag' is not numeric")));
    renderWizard();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Column 'Betrag' is not numeric"),
    );
  });

  it("calls onImported and onClose on success", async () => {
    queueImport(ok({ imported: 5 }));
    const { onImported, onClose } = renderWizard();
    await waitFor(() => expect(screen.getByRole("button", { name: "Import" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({ imported: 5, refreshHint: false }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const { onClose } = renderWizard();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
