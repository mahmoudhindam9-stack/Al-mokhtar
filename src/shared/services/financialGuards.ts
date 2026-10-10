/**
 * Financial safety helpers used by ERP mutation paths.
 *
 * These helpers intentionally fail closed: invalid monetary values, rates,
 * or invalid journal lines must never be silently accepted.
 */
export function assertPositiveAmount(value: unknown, field = "amount"): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${field} must be a finite positive number`);
  }
  return amount;
}

export function assertValidExchangeRate(value: unknown, field = "exchange_rate"): number {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`${field} must be a finite positive number`);
  }
  return rate;
}

export function assertBalancedJournalLines(
  lines: Array<{ debit?: unknown; credit?: unknown }>,
): void {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error("A journal entry requires at least two lines");
  }

  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    const debit = Number(line?.debit ?? 0);
    const credit = Number(line?.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      throw new Error("Journal debit/credit values must be finite and non-negative");
    }
    if (debit > 0 && credit > 0) {
      throw new Error("A journal line cannot contain both debit and credit");
    }
    if (debit === 0 && credit === 0) {
      throw new Error("A journal line must contain a positive debit or credit");
    }
    debitTotal += debit;
    creditTotal += credit;
  }

  // Keep the tolerance tight enough to catch real accounting mistakes while
  // allowing normal floating-point arithmetic noise.
  if (Math.abs(debitTotal - creditTotal) > 0.000001) {
    throw new Error(`Unbalanced journal entry: debit=${debitTotal}, credit=${creditTotal}`);
  }
}

export function assertSameCurrency(
  currency: unknown,
  expectedCurrency: unknown,
  field = "currency",
): string {
  const actual = String(currency ?? "")
    .trim()
    .toUpperCase();
  const expected = String(expectedCurrency ?? "")
    .trim()
    .toUpperCase();
  if (!actual || !expected || actual !== expected) {
    throw new Error(`${field} does not match the expected currency`);
  }
  return actual;
}
