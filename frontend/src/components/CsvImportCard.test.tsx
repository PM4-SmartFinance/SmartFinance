import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { CsvImportCard } from "./CsvImportCard";
import { BudgetProgressWidget } from "./BudgetProgressWidget";
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
    api: { get: vi.fn(), upload: vi.fn() },
    ApiError: MockApiError,
  };
});

const mockGet = vi.mocked(api.get);
const mockUpload = vi.mocked(api.upload);

const CANDIDATES = [
  { id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" },
  { id: "acc-2", name: "Savings", iban: "CH56 0483 5012 3456 7800 9" },
];

function ambiguousError() {
  return new ApiError(
    409,
    {
      error: {
        statusCode: 409,
        message: "Multiple accounts available. Choose one and retry.",
        code: "AMBIGUOUS_ACCOUNT",
        candidates: CANDIDATES,
      },
    },
    "Multiple accounts available. Choose one and retry.",
  );
}

function noMatchError() {
  return new ApiError(
    409,
    {
      error: {
        statusCode: 409,
        message: "No account available for this user.",
        code: "NO_MATCH",
        candidates: [],
      },
    },
    "No account available for this user.",
  );
}

// ── Path-aware api.upload mock ────────────────────────────────────────────────
// Detection (on file select) and the import both go through `api.upload`. We
// route by path so per-test stubs for the import call never get consumed by the
// detect call. `detectResponder` defaults to a confident Neon match so the
// pre-existing (non-wizard) tests keep their original behaviour.

const NEON_COLUMNS = ["Date", "Amount", "Description"];
const CONFIDENT_DETECT = {
  detectedFormat: "neon",
  confidence: 1,
  columns: NEON_COLUMNS,
  headerSignature: "neon-sig",
  savedMapping: null,
};

function isDetect(path: unknown): boolean {
  return typeof path === "string" && path.includes("/transactions/import/detect");
}

let detectResponder: () => Promise<unknown>;
let importResponders: Array<() => Promise<unknown>>;
let importFallback: () => Promise<unknown>;

const ok = (value: unknown) => () => Promise.resolve(value);
const fail = (err: unknown) => () => Promise.reject(err);

function setDetect(result: unknown) {
  detectResponder = ok(result);
}
function setDetectError(err: unknown) {
  detectResponder = fail(err);
}
function setImport(responder: () => Promise<unknown>) {
  importFallback = responder;
}
function queueImport(...responders: Array<() => Promise<unknown>>) {
  importResponders.push(...responders);
}
function importCalls() {
  return mockUpload.mock.calls.filter(([path]) => !isDetect(path));
}
function detectCalls() {
  return mockUpload.mock.calls.filter(([path]) => isDetect(path));
}

function renderCard(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

  const renderResult = render(
    <QueryClientProvider client={client}>
      <CsvImportCard />
    </QueryClientProvider>,
  );

  return { ...renderResult, queryClient: client };
}

function makeCsvFile(name = "export.csv") {
  return new File(["date,amount\n2025-01-01,42"], name, { type: "text/csv" });
}

async function selectFile(name = "export.csv") {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(input, makeCsvFile(name));
}

// Waits for detection to settle and the upload button to become enabled.
async function waitForUploadReady() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
}

const FORMATS = [
  { value: "neon", label: "Neon" },
  { value: "zkb", label: "ZKB" },
  { value: "wise", label: "Wise" },
  { value: "ubs", label: "UBS" },
];

beforeEach(() => {
  mockGet.mockReset();
  mockUpload.mockReset();
  mockGet.mockImplementation((path: string) => {
    if (path === "/transactions/import/formats") {
      return Promise.resolve({ formats: FORMATS });
    }
    return Promise.resolve({});
  });

  detectResponder = ok(CONFIDENT_DETECT);
  importResponders = [];
  importFallback = ok({ imported: 3 });
  mockUpload.mockImplementation((path: string) => {
    if (isDetect(path)) return detectResponder();
    return (importResponders.shift() ?? importFallback)();
  });
});

// ── Initial render ──────────────────────────────────────────────────────────

describe("initial render", () => {
  it("renders the card title", () => {
    renderCard();
    expect(screen.getByText("Import Transactions")).toBeInTheDocument();
  });

  it("renders the drop zone", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "File drop zone" })).toBeInTheDocument();
  });

  it("renders the idle drop zone hint text", () => {
    renderCard();
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });

  it("renders all format options from the API", async () => {
    renderCard();
    await userEvent.click(screen.getByLabelText("Bank format"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Neon" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "ZKB" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Wise" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "UBS" })).toBeInTheDocument();
  });

  it("defaults format selection to Neon", async () => {
    renderCard();
    await userEvent.click(screen.getByLabelText("Bank format"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Neon" })).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("renders the upload button as disabled when no file is selected", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  it("never fetches /accounts on mount (server is authoritative)", () => {
    renderCard();
    expect(mockGet).not.toHaveBeenCalledWith("/accounts");
  });
});

// ── File selection via input ──────────────────────────────────────────────────

describe("file input", () => {
  it("updates the drop zone text when a CSV is selected", async () => {
    renderCard();
    await selectFile("bank-export.csv");
    expect(screen.getByText("Selected: bank-export.csv")).toBeInTheDocument();
  });

  it("shows an error for a non-CSV file", () => {
    renderCard();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["data"], "data.xlsx", { type: "application/vnd.ms-excel" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Only .csv files are accepted.");
  });

  it("shows an error for a file exceeding 10 MB", () => {
    renderCard();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const bigFile = new File(["x".repeat(11 * 1024 * 1024)], "big.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.getByRole("alert")).toHaveTextContent("File exceeds the 10 MB size limit.");
  });

  it("clears a previous type error when a valid CSV is selected next", () => {
    renderCard();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["data"], "wrong.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("enables the upload button once a CSV is selected and detection settles", async () => {
    renderCard();
    await selectFile();
    await waitForUploadReady();
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
  });
});

// ── Drag and drop ─────────────────────────────────────────────────────────────

describe("drag and drop", () => {
  it("shows the drag-active hint text on dragover", () => {
    renderCard();
    const zone = screen.getByRole("button", { name: "File drop zone" });
    fireEvent.dragOver(zone, { preventDefault: () => {} });
    expect(screen.getByText("Release to select file")).toBeInTheDocument();
  });

  it("restores the idle hint text on dragleave", () => {
    renderCard();
    const zone = screen.getByRole("button", { name: "File drop zone" });
    fireEvent.dragOver(zone, { preventDefault: () => {} });
    fireEvent.dragLeave(zone);
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });

  it("accepts a dropped CSV file", () => {
    renderCard();
    const zone = screen.getByRole("button", { name: "File drop zone" });
    const file = makeCsvFile("dropped.csv");
    fireEvent.drop(zone, {
      preventDefault: () => {},
      dataTransfer: { files: [file] },
    });
    expect(screen.getByText("Selected: dropped.csv")).toBeInTheDocument();
  });

  it("shows a type error for a dropped non-CSV file", () => {
    renderCard();
    const zone = screen.getByRole("button", { name: "File drop zone" });
    fireEvent.drop(zone, {
      preventDefault: () => {},
      dataTransfer: { files: [new File(["x"], "image.png", { type: "image/png" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Only .csv files are accepted.");
  });
});

// ── Format selector ───────────────────────────────────────────────────────────

describe("format selector", () => {
  it("changes the selected format", async () => {
    renderCard();
    await userEvent.click(screen.getByLabelText("Bank format"));
    await waitFor(() => expect(screen.getByRole("option", { name: "ZKB" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("option", { name: "ZKB" }));
    expect(screen.getByLabelText("Bank format")).toHaveTextContent(/zkb/i);
  });
});

// ── Upload flow (single-account / backend resolved) ─────────────────────────

describe("upload", () => {
  async function setupReadyCard() {
    renderCard();
    await selectFile();
    await waitForUploadReady();
  }

  it("calls api.upload with a FormData body and without accountId on the first attempt", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const [path, formData] = importCalls()[0]!;
    expect(path).toContain("/transactions/import");
    expect(path).toContain("format=neon");
    expect(path).not.toContain("accountId=");
    expect(formData).toBeInstanceOf(FormData);
  });

  it("includes the file under the 'file' field in the FormData", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const formData = importCalls()[0]![1] as FormData;
    expect(formData.get("file")).toBeInstanceOf(File);
  });

  it("shows a success message with the imported count", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText("3 transactions imported successfully.")).toBeInTheDocument(),
    );
  });

  it("refetches BudgetProgressWidget data after successful import", async () => {
    let budgetRequests = 0;
    mockGet.mockImplementation((path: string) => {
      if (path === "/transactions/import/formats") {
        return Promise.resolve({ formats: FORMATS });
      }
      if (path === "/categories" || path.startsWith("/categories?")) {
        return Promise.resolve({ categories: [{ id: "cat-1", categoryName: "Groceries" }] });
      }
      if (path.startsWith("/budgets?")) {
        budgetRequests += 1;
        if (budgetRequests <= 3) {
          return Promise.resolve({ budgets: [], categorySpending: [] });
        }
        return Promise.resolve({
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "75.00",
              scaledLimit: "100.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <div>
            <BudgetProgressWidget />
            <CsvImportCard />
          </div>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "No tracked budget totals yet. Create budgets and import transactions to populate these charts.",
        ),
      ).toBeInTheDocument();
    });

    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] }));
    await waitFor(() => {
      expect(
        screen.queryByText(
          "No tracked budget totals yet. Create budgets and import transactions to populate these charts.",
        ),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText("Tracked total").length).toBeGreaterThan(0);
    });
    expect(budgetRequests).toBeGreaterThan(3);
  });

  it("uses singular 'transaction' when imported count is 1", async () => {
    setImport(ok({ imported: 1 }));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText("1 transaction imported successfully.")).toBeInTheDocument(),
    );
  });

  it("shows the zero-rows message when imported is 0", async () => {
    setImport(ok({ imported: 0 }));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(
        screen.getByText("No new transactions found (all rows may be duplicates)."),
      ).toBeInTheDocument(),
    );
  });

  it("shows an error message when the upload fails with a non-409 ApiError", async () => {
    setImport(fail(new ApiError(422, null, "Invalid CSV format")));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid CSV format"));
  });

  it("shows the actual error message for non-ApiError errors", async () => {
    setImport(fail(new Error("Network error")));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network error"));
  });

  it("invalidates the transactions query cache on successful upload", async () => {
    const { queryClient } = renderCard();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["transactions"] }));
  });

  it("invalidates the budgets and dashboard caches on successful upload", async () => {
    const { queryClient } = renderCard();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("renders a refresh hint when post-import invalidation fails", async () => {
    const { queryClient } = renderCard();
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("invalidation boom"));
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(
        screen.getByText("Imported, but the dashboard may need a manual refresh."),
      ).toBeInTheDocument(),
    );
  });

  it("does not invalidate the transactions cache when upload fails", async () => {
    setImport(fail(new Error("Network error")));
    const { queryClient } = renderCard();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network error"));
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["transactions"] });
  });
});

// ── Account resolution (server-driven prompt) ────────────────────────────────

describe("account resolution", () => {
  it("renders an account selector when the server responds 409 AMBIGUOUS_ACCOUNT", async () => {
    queueImport(fail(ambiguousError()));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(screen.getByText("Multiple accounts available")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("resubmits with the chosen accountId after the user picks an account", async () => {
    queueImport(fail(ambiguousError()), ok({ imported: 4 }));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(screen.getByLabelText("Choose import account")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Choose import account"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Savings/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("option", { name: /Savings/ }));

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(importCalls()).toHaveLength(2));
    const [secondPath] = importCalls()[1]!;
    expect(secondPath).toContain("accountId=acc-2");
    await waitFor(() =>
      expect(screen.getByText("4 transactions imported successfully.")).toBeInTheDocument(),
    );
  });

  it("shows the inline create-account form and hides the upload button on 409 NO_MATCH", async () => {
    queueImport(fail(noMatchError()));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(screen.getByText("No account yet")).toBeInTheDocument());
    expect(screen.getByLabelText("Account name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("does not show the generic upload-failed alert when resolution UI is showing", async () => {
    queueImport(fail(ambiguousError()));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(screen.getByText("Multiple accounts available")).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Multiple accounts available. Choose one and retry.", {
        selector: "p.text-destructive",
      }),
    ).not.toBeInTheDocument();
  });
});

// ── Auto-detect wizard (KAN-163) ──────────────────────────────────────────────

const UNKNOWN_COLUMNS = ["Buchungsdatum", "Beschreibung", "Betrag", "Soll", "Haben"];

function detectNull(savedMapping: unknown = null) {
  return {
    detectedFormat: null,
    confidence: 0,
    columns: UNKNOWN_COLUMNS,
    headerSignature: "unknown-sig",
    savedMapping,
  };
}

// Opens a labelled column Select and clicks the option with the given column name.
async function mapColumn(label: string, column: string) {
  await userEvent.click(screen.getByLabelText(label));
  const option = await screen.findByRole("option", { name: column });
  await userEvent.click(option);
}

describe("auto-detect wizard", () => {
  it("runs detection on file select", async () => {
    renderCard();
    await selectFile();
    await waitFor(() => expect(detectCalls()).toHaveLength(1));
    const detectBody = detectCalls()[0]![1] as FormData;
    expect(detectCalls()[0]![0]).toBe("/transactions/import/detect");
    expect(detectBody.get("file")).toBeInstanceOf(File);
  });

  it("pre-selects the detected bank format and imports via the normal path", async () => {
    setDetect({ ...CONFIDENT_DETECT, detectedFormat: "zkb" });
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByLabelText("Bank format")).toHaveTextContent(/zkb/i));
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const [path, formData] = importCalls()[0]!;
    expect(path).toContain("format=zkb");
    expect((formData as FormData).get("mapping")).toBeNull();
  });

  it("shows the mapping form on no match and imports via format=custom", async () => {
    setDetect(detectNull());
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    await mapColumn("Date column", "Buchungsdatum");
    await mapColumn("Description column", "Beschreibung");
    await mapColumn("Amount column", "Betrag");
    await waitForUploadReady();

    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const [path, formData] = importCalls()[0]!;
    expect(path).toContain("format=custom");

    const fd = formData as FormData;
    expect([...fd.keys()]).toEqual(["mapping", "file"]);
    expect(JSON.parse(fd.get("mapping") as string)).toEqual({
      date: "Buchungsdatum",
      description: "Beschreibung",
      amount: "Betrag",
    });
  });

  it("supports a debit/credit split mapping", async () => {
    setDetect(detectNull());
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    await mapColumn("Date column", "Buchungsdatum");
    await mapColumn("Description column", "Beschreibung");
    await userEvent.click(screen.getByRole("radio", { name: "Separate debit & credit" }));
    await mapColumn("Debit column", "Soll");
    await mapColumn("Credit column", "Haben");
    await waitForUploadReady();

    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const fd = importCalls()[0]![1] as FormData;
    expect(JSON.parse(fd.get("mapping") as string)).toEqual({
      date: "Buchungsdatum",
      description: "Beschreibung",
      debit: "Soll",
      credit: "Haben",
    });
  });

  it("prefills and enables the form from a saved mapping", async () => {
    const saved = { date: "Buchungsdatum", description: "Beschreibung", amount: "Betrag" };
    setDetect(detectNull(saved));
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    // Pre-filled → upload immediately available without touching the selects.
    await waitForUploadReady();
    expect(screen.getByLabelText("Date column")).toHaveTextContent("Buchungsdatum");
    expect(screen.getByLabelText("Amount column")).toHaveTextContent("Betrag");

    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const fd = importCalls()[0]![1] as FormData;
    expect(JSON.parse(fd.get("mapping") as string)).toEqual(saved);
  });

  it("includes optional subject and dateFormat only when set", async () => {
    setDetect(detectNull());
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    await mapColumn("Date column", "Buchungsdatum");
    await mapColumn("Description column", "Beschreibung");
    await mapColumn("Amount column", "Betrag");
    await mapColumn("Subject column (optional)", "Soll");
    await userEvent.click(screen.getByLabelText("Date format (optional)"));
    await userEvent.click(await screen.findByRole("option", { name: "DD.MM.YYYY" }));
    await waitForUploadReady();

    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    const fd = importCalls()[0]![1] as FormData;
    expect(JSON.parse(fd.get("mapping") as string)).toEqual({
      date: "Buchungsdatum",
      description: "Beschreibung",
      amount: "Betrag",
      subject: "Soll",
      dateFormat: "dmy-dot",
    });
  });

  it("falls back to the manual dropdown when detection errors", async () => {
    setDetectError(new Error("detect boom"));
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByLabelText("Bank format")).toBeInTheDocument());
    expect(screen.queryByText("Map your columns")).not.toBeInTheDocument();

    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    expect(importCalls()[0]![0]).toContain("format=neon");
  });

  it("surfaces an actionable backend 422 mapping error", async () => {
    setDetect(detectNull());
    setImport(fail(new ApiError(422, null, "Column 'Betrag' is not numeric")));
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    await mapColumn("Date column", "Buchungsdatum");
    await mapColumn("Description column", "Beschreibung");
    await mapColumn("Amount column", "Betrag");
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Column 'Betrag' is not numeric"),
    );
  });

  it("preserves the mapping across a 409 account-resolution retry", async () => {
    setDetect(detectNull());
    queueImport(fail(ambiguousError()), ok({ imported: 2 }));
    renderCard();
    await selectFile();
    await waitFor(() => expect(screen.getByText("Map your columns")).toBeInTheDocument());

    await mapColumn("Date column", "Buchungsdatum");
    await mapColumn("Description column", "Beschreibung");
    await mapColumn("Amount column", "Betrag");
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    const accountSelect = await screen.findByLabelText("Choose import account");
    await userEvent.click(accountSelect);
    await userEvent.click(await screen.findByRole("option", { name: /Savings/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(importCalls()).toHaveLength(2));
    const [secondPath, secondBody] = importCalls()[1]!;
    expect(secondPath).toContain("format=custom");
    expect(secondPath).toContain("accountId=acc-2");
    const fd = secondBody as FormData;
    expect(JSON.parse(fd.get("mapping") as string)).toEqual({
      date: "Buchungsdatum",
      description: "Beschreibung",
      amount: "Betrag",
    });
  });
});

// ── Reset after success ───────────────────────────────────────────────────────

describe("reset", () => {
  it("returns to the idle state when 'Import another file' is clicked", async () => {
    setImport(ok({ imported: 5 }));
    renderCard();
    await selectFile();
    await waitForUploadReady();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => screen.getByText("Import another file"));

    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));

    expect(screen.getByRole("button", { name: "File drop zone" })).toBeInTheDocument();
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });
});
