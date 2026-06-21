import { describe, it, expect } from "vitest";
import { parseWithMapping, validateColumnMapping, type ColumnMapping } from "./generic.parser.js";
import { ServiceError } from "../../errors.js";

/** Runs `fn` and returns whatever it throws (or undefined), so assertions stay
 *  out of catch blocks (vitest/no-conditional-expect). */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe("validateColumnMapping", () => {
  it("accepts a single-amount mapping", () => {
    const m = validateColumnMapping({ date: "D", description: "Desc", amount: "Amt" });
    expect(m).toEqual({ date: "D", description: "Desc", amount: "Amt" });
  });

  it("accepts a debit/credit mapping with subject and dateFormat", () => {
    const m = validateColumnMapping({
      date: "D",
      description: "Desc",
      debit: "Out",
      credit: "In",
      subject: "Ref",
      dateFormat: "dmy-dot",
    });
    expect(m.debit).toBe("Out");
    expect(m.dateFormat).toBe("dmy-dot");
  });

  it.each([
    ["missing date", { description: "Desc", amount: "A" }],
    ["missing description", { date: "D", amount: "A" }],
    ["neither amount nor debit/credit", { date: "D", description: "Desc" }],
    ["both amount and debit", { date: "D", description: "Desc", amount: "A", debit: "B" }],
    ["empty-string field", { date: "D", description: "Desc", amount: "  " }],
    ["bad dateFormat", { date: "D", description: "Desc", amount: "A", dateFormat: "nope" }],
    ["not an object", "x"],
  ])("rejects %s with 400", (_label, input) => {
    const err = catchError(() => validateColumnMapping(input));
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).statusCode).toBe(400);
  });
});

describe("parseWithMapping", () => {
  const amountMapping: ColumnMapping = { date: "Date", description: "Name", amount: "Amount" };

  it("parses a single signed-amount file with ISO dates", () => {
    const csv = ["Date,Name,Amount", "2025-01-15,Shop,-42.50", "2025-01-16,Salary,1000"].join("\n");
    const txns = parseWithMapping(csv, amountMapping);
    expect(txns).toHaveLength(2);
    expect(txns[0]).toMatchObject({ amount: -42.5, description: "Shop", subject: "" });
    expect(txns[0]!.date.toISOString()).toBe("2025-01-15T00:00:00.000Z");
    expect(txns[1]!.amount).toBe(1000);
  });

  it("maps by header name regardless of column order", () => {
    const csv = ["Amount,Name,Date", "-5,Shop,2025-02-01"].join("\n");
    const txns = parseWithMapping(csv, amountMapping);
    expect(txns[0]).toMatchObject({ amount: -5, description: "Shop" });
  });

  it("treats debit as negative and credit as positive", () => {
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Name",
      debit: "Out",
      credit: "In",
    };
    const csv = ["Date;Name;Out;In", "01.03.2025;Rent;1200;", "02.03.2025;Refund;;50"].join("\n");
    const txns = parseWithMapping(csv, mapping);
    expect(txns[0]!.amount).toBe(-1200);
    expect(txns[1]!.amount).toBe(50);
  });

  it("auto-detects DD.MM.YYYY, DD-MM-YYYY and DD/MM/YYYY dates", () => {
    const csv = ["Date,Name,Amount", "15.01.2025,A,1", "16-01-2025,B,2", "17/01/2025,C,3"].join(
      "\n",
    );
    const txns = parseWithMapping(csv, amountMapping);
    expect(txns.map((t) => t.date.toISOString())).toEqual([
      "2025-01-15T00:00:00.000Z",
      "2025-01-16T00:00:00.000Z",
      "2025-01-17T00:00:00.000Z",
    ]);
  });

  it("parses Swiss thousands separators and comma decimals", () => {
    const csv = ["Date;Name;Amount", "2025-01-01;Big;1'234.50", "2025-01-02;Comma;12,75"].join(
      "\n",
    );
    const txns = parseWithMapping(csv, { date: "Date", description: "Name", amount: "Amount" });
    expect(txns[0]!.amount).toBe(1234.5);
    expect(txns[1]!.amount).toBe(12.75);
  });

  it("skips continuation rows that carry no date", () => {
    const csv = ["Date,Name,Amount", "2025-01-01,A,1", ",continuation,", "2025-01-02,B,2"].join(
      "\n",
    );
    expect(parseWithMapping(csv, amountMapping)).toHaveLength(2);
  });

  it("throws 422 listing columns the mapping references but the file lacks", () => {
    const csv = ["Date,Name,Value", "2025-01-01,A,1"].join("\n");
    // mapping wants "Amount", file has "Value"
    const err = catchError(() => parseWithMapping(csv, amountMapping));
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).statusCode).toBe(422);
    expect((err as ServiceError).message).toContain("Amount");
    expect((err as ServiceError).message).toContain("Available columns");
  });

  it("throws 422 on an invalid date", () => {
    const csv = ["Date,Name,Amount", "not-a-date,A,1"].join("\n");
    expect(() => parseWithMapping(csv, amountMapping)).toThrow(ServiceError);
  });

  it("throws 422 when there are no data rows", () => {
    expect(() => parseWithMapping("Date,Name,Amount", amountMapping)).toThrow(/no data rows/);
  });

  it("throws 422 when the file has no header", () => {
    expect(() => parseWithMapping("", amountMapping)).toThrow(/no header/);
  });
});
