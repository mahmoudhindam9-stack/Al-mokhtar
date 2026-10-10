import { describe, expect, it } from "vitest";
import { parseOracleNumber, parseOracleDate } from "./oracleImportDiagnostics";
import { parseOracleSheetRowsDetailed } from "./oracleParser";

describe("Oracle import parser", () => {
  it("parses Excel serial dates used by xlsx exports", () => {
    const date = parseOracleDate(44197);
    expect(date).not.toBeNull();
    expect(date?.toISOString().startsWith("2021-")).toBe(true);
  });

  it("parses Oracle numeric variants without changing their value", () => {
    expect(parseOracleNumber("1,234.56")).toBe(1234.56);
    expect(parseOracleNumber("1.234,56")).toBe(1234.56);
    expect(parseOracleNumber("(1,234.56)")).toBe(-1234.56);
    expect(parseOracleNumber("١٬٢٣٤٫٥٦")).toBe(1234.56);
  });

  it("accepts a 2021-style sheet with reordered columns and preserves currency/rate", () => {
    const result = parseOracleSheetRowsDetailed([
      [
        "رقم القيد",
        "تاريخ القيد",
        "رقم الحساب",
        "اسم الحساب",
        "العملة",
        "سعر الصرف",
        "مدين",
        "دائن",
        "البيان",
      ],
      ["1001", "2021-03-15", "13010111", "حساب سوداني", "SSP", "450", "4,500", "", "حركة 2021"],
      ["1001", "2021-03-15", "401000", "إيراد", "USD", "1", "", "10", "حركة 2021"],
    ]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe("2021-03-15");
    expect(result.rows[0].base_debit).toBe(4500);
    expect(result.rows[0].rate).toBe(450);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("reports the real row and field instead of silently converting bad data to zero", () => {
    const result = parseOracleSheetRowsDetailed([
      ["رقم الحساب", "اسم الحساب", "مدين", "دائن", "تاريخ"],
      ["13010111", "حساب", "not-a-number", "100", "31/02/2021"],
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.diagnostics.some((d) => d.row === 2 && d.field === "debit")).toBe(true);
    expect(result.diagnostics.some((d) => d.row === 2 && d.field === "date")).toBe(true);
  });
});
