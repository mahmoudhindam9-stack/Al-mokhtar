import { describe, expect, it } from "vitest";
import {
  assertBalancedJournalLines,
  assertPositiveAmount,
  assertSameCurrency,
  assertValidExchangeRate,
} from "./financialGuards";

describe("financialGuards", () => {
  it("accepts positive monetary amounts", () => {
    expect(assertPositiveAmount("125.50")).toBe(125.5);
  });

  it("rejects zero, negative and non-finite amounts", () => {
    expect(() => assertPositiveAmount(0)).toThrow();
    expect(() => assertPositiveAmount(-1)).toThrow();
    expect(() => assertPositiveAmount("not-a-number")).toThrow();
  });

  it("accepts only positive finite exchange rates", () => {
    expect(assertValidExchangeRate("2.5")).toBe(2.5);
    expect(() => assertValidExchangeRate(0)).toThrow();
    expect(() => assertValidExchangeRate(-2)).toThrow();
  });

  it("rejects unbalanced or malformed journal lines", () => {
    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 90 },
      ]),
    ).toThrow();

    expect(() => assertBalancedJournalLines([{ debit: 100, credit: 0 }])).toThrow();

    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 20 },
        { debit: 0, credit: 80 },
      ]),
    ).toThrow();
  });

  it("accepts balanced journal entries", () => {
    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });

  it("requires an explicit currency match", () => {
    expect(assertSameCurrency("usd", "USD")).toBe("USD");
    expect(() => assertSameCurrency("USD", "EGP")).toThrow();
  });
});
