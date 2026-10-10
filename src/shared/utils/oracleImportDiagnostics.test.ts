import { describe, expect, it } from "vitest";
import { parseOracleDate, parseOracleNumber } from "./oracleImportDiagnostics";

describe("Oracle import compatibility", () => {
  it("accepts ISO dates used by newer exports", () => {
    expect(parseOracleDate("2021-01-31")).not.toBeNull();
    expect(parseOracleDate("2024-12-31 23:59:59")).not.toBeNull();
  });

  it("accepts legacy slash dates", () => {
    expect(parseOracleDate("31/12/2020")).not.toBeNull();
  });

  it("accepts Oracle-style compact dates", () => {
    expect(parseOracleDate("20201231")).not.toBeNull();
  });

  it("normalizes common decimal/thousands conventions", () => {
    expect(parseOracleNumber("1,234.56")).toBe(1234.56);
    expect(parseOracleNumber("1.234,56")).toBe(1234.56);
    expect(parseOracleNumber("1234,56")).toBe(1234.56);
  });

  it("rejects invalid dates and numbers instead of throwing", () => {
    expect(parseOracleDate("2021-99-99")).toBeNull();
    expect(parseOracleNumber("abc")).toBeNull();
  });
});
