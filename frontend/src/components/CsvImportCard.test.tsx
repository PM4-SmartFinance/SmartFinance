import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsvImportCard } from "./CsvImportCard";

// The card just opens the wizard; the wizard's behaviour is tested separately.
// Stub it so the card suite stays focused on drop-zone + result handling.
interface StubWizardProps {
  file: File;
  onClose: () => void;
  onImported: (r: { imported: number; refreshHint: boolean }) => void;
}
const wizardProps: StubWizardProps[] = [];

vi.mock("./CsvImportWizard", () => ({
  CsvImportWizard: (props: StubWizardProps) => {
    wizardProps.push(props);
    return (
      <div data-testid="wizard">
        <span>wizard for {props.file.name}</span>
        <button type="button" onClick={() => props.onImported({ imported: 3, refreshHint: false })}>
          stub-import-ok
        </button>
        <button type="button" onClick={() => props.onImported({ imported: 3, refreshHint: true })}>
          stub-import-hint
        </button>
        <button type="button" onClick={() => props.onClose()}>
          stub-close
        </button>
      </div>
    );
  },
}));

function makeCsvFile(name = "export.csv") {
  return new File(["date,amount\n2025-01-01,42"], name, { type: "text/csv" });
}

function fileInput() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

beforeEach(() => {
  wizardProps.length = 0;
});

describe("initial render", () => {
  it("renders the card title and drop zone", () => {
    render(<CsvImportCard />);
    expect(screen.getByText("Import Transactions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File drop zone" })).toBeInTheDocument();
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });

  it("does not mount the wizard before a file is chosen", () => {
    render(<CsvImportCard />);
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });
});

describe("file validation", () => {
  it("rejects a non-CSV file and does not open the wizard", () => {
    render(<CsvImportCard />);
    fireEvent.change(fileInput(), {
      target: { files: [new File(["x"], "data.xlsx", { type: "application/vnd.ms-excel" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Only .csv files are accepted.");
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });

  it("rejects a file over 10 MB", () => {
    render(<CsvImportCard />);
    const big = new File(["x".repeat(11 * 1024 * 1024)], "big.csv", { type: "text/csv" });
    fireEvent.change(fileInput(), { target: { files: [big] } });
    expect(screen.getByRole("alert")).toHaveTextContent("File exceeds the 10 MB size limit.");
  });

  it("clears a previous type error when a valid CSV is selected next", () => {
    render(<CsvImportCard />);
    fireEvent.change(fileInput(), {
      target: { files: [new File(["x"], "wrong.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(fileInput(), { target: { files: [makeCsvFile()] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("opening the wizard", () => {
  it("mounts the wizard with the selected file", async () => {
    render(<CsvImportCard />);
    await userEvent.upload(fileInput(), makeCsvFile("bank.csv"));
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
    expect(wizardProps.at(-1)!.file.name).toBe("bank.csv");
  });

  it("mounts the wizard for a dropped file", () => {
    render(<CsvImportCard />);
    const zone = screen.getByRole("button", { name: "File drop zone" });
    fireEvent.drop(zone, {
      preventDefault: () => {},
      dataTransfer: { files: [makeCsvFile("d.csv")] },
    });
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
    expect(wizardProps.at(-1)!.file.name).toBe("d.csv");
  });

  it("closes the wizard without a result when onClose is called", async () => {
    render(<CsvImportCard />);
    await userEvent.upload(fileInput(), makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "stub-close" }));
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File drop zone" })).toBeInTheDocument();
  });
});

describe("result screen", () => {
  it("shows the imported count after the wizard reports success", async () => {
    render(<CsvImportCard />);
    await userEvent.upload(fileInput(), makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "stub-import-ok" }));
    expect(screen.getByText("3 transactions imported successfully.")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });

  it("shows a refresh hint when the wizard reports a partial invalidation failure", async () => {
    render(<CsvImportCard />);
    await userEvent.upload(fileInput(), makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "stub-import-hint" }));
    expect(
      screen.getByText("Imported, but the dashboard may need a manual refresh."),
    ).toBeInTheDocument();
  });

  it("returns to the drop zone when 'Import another file' is clicked", async () => {
    render(<CsvImportCard />);
    await userEvent.upload(fileInput(), makeCsvFile());
    await userEvent.click(screen.getByRole("button", { name: "stub-import-ok" }));
    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));
    expect(screen.getByText("Drop a CSV file here, or click to browse")).toBeInTheDocument();
  });
});
