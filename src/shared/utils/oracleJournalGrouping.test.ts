import { describe, expect, it } from "vitest";
import { groupOracleRowsIntoJournalEntriesOrdered } from "./oracleJournalGrouping";
import type { ParsedOracleRow } from "./oracleParser";

const makeRow = (overrides: Partial<ParsedOracleRow> = {}): ParsedOracleRow => ({
  index: 2,
  account_code: "100100",
  account_name: "الصندوق",
  base_debit: 100,
  base_credit: 0,
  description: "حركة نقدية",
  date: "2026-01-15",
  document_number: "",
  journal_number: "01/7",
  period: "1",
  currency_code: "0",
  currency_name: "USD",
  rate: 1,
  curr_debit: 100,
  curr_credit: 0,
  ...overrides,
});

describe("Oracle ordered journal grouping", () => {
  it("keeps the same journal number separate across different months and years", () => {
    const entries = groupOracleRowsIntoJournalEntriesOrdered([
      makeRow({ index: 2, date: "2026-01-15", period: "1", journal_number: "01/7" }),
      makeRow({
        index: 3,
        account_code: "400100",
        account_name: "إيراد",
        curr_debit: 0,
        curr_credit: 100,
      }),
      makeRow({ index: 4, date: "2026-02-15", period: "2", journal_number: "02/7" }),
      makeRow({
        index: 5,
        account_code: "400200",
        account_name: "إيراد فبراير",
        curr_debit: 0,
        curr_credit: 100,
      }),
      makeRow({ index: 6, date: "2027-01-15", period: "1", journal_number: "01/7" }),
      makeRow({
        index: 7,
        account_code: "400300",
        account_name: "إيراد 2027",
        curr_debit: 0,
        curr_credit: 100,
      }),
    ]);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.reference)).toEqual(["01/07", "02/07", "01/07"]);
    expect(entries.map((entry) => entry.date)).toEqual(["2026-01-15", "2026-02-15", "2027-01-15"]);
  });

  it("combines rows with the same year/month/journal identity and preserves account names", () => {
    const entries = groupOracleRowsIntoJournalEntriesOrdered([
      makeRow({ index: 2, journal_number: "03/9", period: "3", date: "2026-03-10" }),
      makeRow({
        index: 3,
        account_code: "401000",
        account_name: "إيرادات المطعم",
        journal_number: "03/9",
        period: "3",
        date: "2026-03-10",
        curr_debit: 0,
        curr_credit: 100,
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].lines).toHaveLength(2);
    expect((entries[0].lines[1] as { account_name?: string }).account_name).toBe("إيرادات المطعم");
    expect(entries[0].sequence).toBe(1);
  });
});
