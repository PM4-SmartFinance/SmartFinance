import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CsvImportCard } from "./CsvImportCard";
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

const ACCOUNTS = [
  { id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" },
  { id: "acc-2", name: "Savings", iban: "CH56 0483 5012 3456 7800 9" },
];

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CsvImportCard />
    </QueryClientProvider>,
  );
}

function makeCsvFile(name = "export.csv") {
  return new File(["date,amount\n2025-01-01,42"], name, { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ accounts: ACCOUNTS });
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

  it("renders all three format options", async () => {
    renderCard();
    await userEvent.click(screen.getByLabelText("Bank format"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Neon" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "ZKB" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Wise" })).toBeInTheDocument();
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
});

// ── Accounts loading ─────────────────────────────────────────────────────────

describe("accounts", () => {
  it("shows the no-accounts message while accounts are loading", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    renderCard();
    expect(screen.getByText("No accounts found. Create an account first.")).toBeInTheDocument();
  });

  it("renders the account selector once accounts load", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByLabelText("Account")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Account"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Main Account/ })).toBeInTheDocument(),
    );
  });

  it("renders all accounts as options", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByLabelText("Account")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Account"));
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Main Account/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Savings/ })).toBeInTheDocument();
    });
  });

  it("shows an error message when the accounts query fails", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderCard();
    await waitFor(() =>
      expect(screen.getByText("Failed to load accounts. Please try again.")).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("No accounts found. Create an account first."),
    ).not.toBeInTheDocument();
  });

  it("shows the no-accounts message when the user has no accounts", async () => {
    mockGet.mockResolvedValue({ accounts: [] });
    renderCard();
    await waitFor(() =>
      expect(screen.getByText("No accounts found. Create an account first.")).toBeInTheDocument(),
    );
  });
});

// ── File selection via input ──────────────────────────────────────────────────

describe("file input", () => {
  it("updates the drop zone text when a CSV is selected", async () => {
    renderCard();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile("bank-export.csv"));
    expect(screen.getByText("Selected: bank-export.csv")).toBeInTheDocument();
  });

  it("shows an error for a non-CSV file", () => {
    renderCard();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    // fireEvent bypasses the accept attribute, matching what happens when a user
    // overrides the file picker filter in the browser
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

  it("enables the upload button after a valid CSV is selected and an account is available", async () => {
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
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

// ── Upload flow ───────────────────────────────────────────────────────────────

describe("upload", () => {
  async function setupReadyCard() {
    mockUpload.mockResolvedValue({ imported: 3 });
    renderCard();
    // Wait for accounts to load
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
  }

  it("calls api.upload with a FormData body on submit", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledOnce());
    const [path, formData] = mockUpload.mock.calls[0]!;
    expect(path).toContain("/transactions/import");
    expect(path).toContain("format=neon");
    expect(path).toContain("accountId=");
    expect(formData).toBeInstanceOf(FormData);
  });

  it("includes the file under the 'file' field in the FormData", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledOnce());
    const formData = mockUpload.mock.calls[0]![1] as FormData;
    expect(formData.get("file")).toBeInstanceOf(File);
  });

  it("shows a success message with the imported count", async () => {
    await setupReadyCard();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText("3 transactions imported successfully.")).toBeInTheDocument(),
    );
  });

  it("uses singular 'transaction' when imported count is 1", async () => {
    mockUpload.mockResolvedValue({ imported: 1 });
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText("1 transaction imported successfully.")).toBeInTheDocument(),
    );
  });

  it("shows the zero-rows message when imported is 0", async () => {
    mockUpload.mockResolvedValue({ imported: 0 });
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(
        screen.getByText("No new transactions found (all rows may be duplicates)."),
      ).toBeInTheDocument(),
    );
  });

  it("shows an error message when the upload fails with an ApiError", async () => {
    mockUpload.mockRejectedValue(new ApiError(422, null, "Invalid CSV format"));
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid CSV format"));
  });

  it("shows the actual error message for non-ApiError errors", async () => {
    mockUpload.mockRejectedValue(new Error("Network error"));
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network error"));
  });
});

// ── Reset after success ───────────────────────────────────────────────────────

describe("reset", () => {
  it("returns to the idle state when 'Import another file' is clicked", async () => {
    mockUpload.mockResolvedValue({ imported: 5 });
    renderCard();
    await waitFor(() =>
      expect(
        screen.queryByText("No accounts found. Create an account first."),
      ).not.toBeInTheDocument(),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => screen.getByText("Import another file"));

    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));

    expect(screen.getByRole("button", { name: "File drop zone" })).toBeInTheDocument();
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });
});
