// @ts-nocheck
import { type JournalEntry, type JournalLine } from "@/shared/services/erpStore";
import {
  parseOracleDate,
  parseOracleNumber,
  type OracleImportDiagnostic,
} from "@/shared/utils/oracleImportDiagnostics";

export interface ParsedOracleRow {
  index: number;
  account_code: string;
  account_name: string;
  base_debit: number;
  base_credit: number;
  description: string;
  date: string;
  document_number: string;
  journal_number: string;
  period: string;
  currency_code: string;
  currency_name: string;
  rate: number;
  curr_debit: number;
  curr_credit: number;
}

export interface OracleParseResult {
  rows: ParsedOracleRow[];
  diagnostics: OracleImportDiagnostic[];
  headerIndex: number;
  detectedColumns: Record<string, number>;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[\s_\-./():]+/g, "")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

export function parseDateDDMMYYYY(rawDate: unknown): string {
  const parsed = parseOracleDate(rawDate);
  if (parsed) return parsed.toISOString().split("T")[0];
  // Keep the legacy behavior for truly empty rows, but never silently turn an
  // invalid non-empty Oracle date into today's date.
  return cleanText(rawDate) ? "" : new Date().toISOString().split("T")[0];
}

export function parseCurrency(
  currCode: unknown,
  currName?: string,
  desc?: string,
  accCode?: string,
): "USD" | "SSP" | "EGP" {
  const codeStr = cleanText(currCode);
  const nameStr = cleanText(currName).toLowerCase();
  if (nameStr.includes("دولار") || nameStr.includes("usd") || nameStr.includes("$")) return "USD";
  if (nameStr.includes("سودان") || nameStr.includes("ssp") || nameStr.includes("sdg")) return "SSP";
  if (nameStr.includes("مصر") || nameStr.includes("egp") || nameStr.includes("le")) return "EGP";

  // Preserve the application's existing Oracle currency mapping.
  if (codeStr === "0" || codeStr === "0.0") return "USD";
  if (codeStr === "1" || codeStr === "1.0") return "SSP";
  if (codeStr === "2" || codeStr === "2.0") return "EGP";

  const descStr = cleanText(desc).toLowerCase();
  if (descStr.includes("سودان") || descStr.includes("ssp")) return "SSP";
  if (descStr.includes("مصر") || descStr.includes("egp")) return "EGP";
  if (descStr.includes("دولار") || descStr.includes("usd") || descStr.includes("$")) return "USD";

  const aCode = cleanText(accCode);
  if (
    aCode.startsWith("1301011") ||
    aCode.startsWith("13020100") ||
    aCode.startsWith("13020120") ||
    aCode.startsWith("13020130") ||
    aCode.startsWith("13030100")
  )
    return "SSP";
  if (aCode.startsWith("13010125") || aCode.startsWith("13010120")) return "EGP";
  if (aCode.startsWith("1301010") || aCode.startsWith("13020110") || aCode.startsWith("13020140"))
    return "USD";
  return "USD";
}

function readNumber(value: unknown, fallback: number | null = 0): number | null {
  const parsed = parseOracleNumber(value);
  return parsed == null ? fallback : parsed;
}

function findHeaderIndex(rawRows: any[][]): number {
  const index = rawRows.slice(0, 20).findIndex((row) => {
    const text = (row || []).map(normalizeHeader).join("|");
    return (
      /كودالحساب|رقمالحساب|accountcode|accountnumber/i.test(text) &&
      /مدين|debit/i.test(text) &&
      /دائن|credit/i.test(text)
    );
  });
  return index >= 0 ? index : 0;
}

function detectColumns(headerRow: any[]): Record<string, number> {
  const c: Record<string, number> = {
    accountCode: -1,
    accountName: -1,
    debit: -1,
    credit: -1,
    currencyCode: -1,
    currencyName: -1,
    period: -1,
    journalNumber: -1,
    date: -1,
    description: -1,
    documentNumber: -1,
    exchangeRate: -1,
    debitCurrency: -1,
    creditCurrency: -1,
  };

  headerRow.forEach((cell, idx) => {
    const h = cleanText(cell).toLowerCase();
    const hn = normalizeHeader(cell);
    if (
      c.currencyCode === -1 &&
      /كود.*(العملة|عملة)|رمز.*(العملة|عملة)|نوع.*(العملة|عملة)|curr(ency)?[-_ ]?code/i.test(h)
    )
      c.currencyCode = idx;
    else if (
      c.exchangeRate === -1 &&
      /المعامل|معامل|سعر.*الصرف|سعر.*صرف|معامل.*التحويل|rate|exchange|factor/i.test(h)
    )
      c.exchangeRate = idx;
    else if (
      c.period === -1 &&
      /^الفترة$|^فترة$|رقم.*الفترة|كود.*الفترة|^period$|^per$|period.*name|period_name/i.test(h)
    )
      c.period = idx;
    else if (
      c.accountCode === -1 &&
      /كود الحساب|رقم الحساب|account.*code|account.*number|^code$/i.test(h)
    )
      c.accountCode = idx;
    else if (c.accountName === -1 && /اسم الحساب|account.*name|^name$/i.test(h))
      c.accountName = idx;
    else if (
      c.debitCurrency === -1 &&
      /مدين.*(عملة|عمله|بالعملة)|(currency|curr).*debit|debit.*(currency|curr)/i.test(h)
    )
      c.debitCurrency = idx;
    else if (
      c.creditCurrency === -1 &&
      /دائن.*(عملة|عمله|بالعملة)|(currency|curr).*credit|credit.*(currency|curr)/i.test(h)
    )
      c.creditCurrency = idx;
    else if (c.debit === -1 && /قيمة.*مدين|مبلغ.*مدين|^مدين$|^debit$|^dr$/i.test(h)) c.debit = idx;
    else if (c.credit === -1 && /قيمة.*دائن|مبلغ.*دائن|^دائن$|^credit$|^cr$/i.test(h))
      c.credit = idx;
    else if (
      c.currencyName === -1 &&
      c.currencyCode !== idx &&
      /العملة|عملة|currency|curr/i.test(h)
    )
      c.currencyName = idx;
    else if (c.documentNumber === -1 && /رقم.*المستند|document.*no|doc.*no/i.test(hn))
      c.documentNumber = idx;
    else if (
      c.journalNumber === -1 &&
      /رقم.*القيد|رقم.*السند|^سند$|^قيد$|journal.*no|voucher.*no|^ref$|trx.*no/i.test(h)
    )
      c.journalNumber = idx;
    else if (c.date === -1 && /تاريخ.*القيد|تاريخ|^date$|datum/i.test(h)) c.date = idx;
    else if (
      c.description === -1 &&
      /بيان الحساب|بيان|^شرح$|^الوصف$|description|desc|narration/i.test(h)
    )
      c.description = idx;
  });

  if (c.accountCode < 0) c.accountCode = 1;
  if (c.accountName < 0) c.accountName = 2;
  if (c.debit < 0) c.debit = 3;
  if (c.credit < 0) c.credit = 4;
  if (c.description < 0) c.description = 5;
  if (c.date < 0) c.date = 6;
  if (c.journalNumber < 0) c.journalNumber = 7;
  if (c.period < 0) c.period = 8;
  if (c.currencyCode < 0 && c.currencyName < 0) c.currencyCode = 9;
  if (c.currencyName < 0) c.currencyName = 10;
  if (c.exchangeRate < 0) c.exchangeRate = 11;
  return c;
}

export function parseOracleSheetRowsDetailed(rawRows: any[][]): OracleParseResult {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      rows: [],
      diagnostics: [{ row: 0, message: "Oracle file contains no rows." }],
      headerIndex: 0,
      detectedColumns: {},
    };
  }

  const headerIndex = findHeaderIndex(rawRows);
  const columns = detectColumns(rawRows[headerIndex] || []);
  const rows: ParsedOracleRow[] = [];
  const diagnostics: OracleImportDiagnostic[] = [];
  const dataRows = rawRows.slice(headerIndex + 1);

  dataRows.forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    if (!Array.isArray(row)) return;
    const accCode = cleanText(row[columns.accountCode]);
    const accName = cleanText(row[columns.accountName]);
    const description = cleanText(row[columns.description]);
    const rawDate = row[columns.date];
    const documentNumber = columns.documentNumber < 0 ? "" : cleanText(row[columns.documentNumber]);
    const journalNumber = cleanText(row[columns.journalNumber]);
    const period = cleanText(row[columns.period]);
    const currencyCode = cleanText(row[columns.currencyCode]);
    const currencyName = cleanText(row[columns.currencyName]);

    const rawDebit = row[columns.debit];
    const rawCredit = row[columns.credit];
    const parsedDebit = readNumber(rawDebit, null);
    const parsedCredit = readNumber(rawCredit, null);
    const rawRate = row[columns.exchangeRate];
    const parsedRate = readNumber(rawRate, null);

    const hasAnyContent = row.some((v) => cleanText(v) !== "");
    if (!hasAnyContent) return;

    if (!accCode && (parsedDebit ?? 0) === 0 && (parsedCredit ?? 0) === 0) {
      diagnostics.push({
        row: rowNumber,
        field: "account_code",
        message: "Row contains data but no account code or debit/credit amount.",
      });
      return;
    }
    if (parsedDebit == null && cleanText(rawDebit) !== "")
      diagnostics.push({
        row: rowNumber,
        field: "debit",
        message: `Invalid numeric value: ${String(rawDebit)}`,
      });
    if (parsedCredit == null && cleanText(rawCredit) !== "")
      diagnostics.push({
        row: rowNumber,
        field: "credit",
        message: `Invalid numeric value: ${String(rawCredit)}`,
      });

    const parsedDate = parseOracleDate(rawDate);
    if (!parsedDate && cleanText(rawDate))
      diagnostics.push({
        row: rowNumber,
        field: "date",
        message: `Invalid Oracle date: ${String(rawDate)}`,
      });

    const baseDebit = parsedDebit ?? 0;
    const baseCredit = parsedCredit ?? 0;
    const rate = parsedRate != null && parsedRate > 0 ? parsedRate : 1;
    const hasCurrencyAmounts = columns.debitCurrency >= 0 || columns.creditCurrency >= 0;
    let currDebit = hasCurrencyAmounts
      ? (readNumber(row[columns.debitCurrency], 0) ?? 0)
      : baseDebit;
    let currCredit = hasCurrencyAmounts
      ? (readNumber(row[columns.creditCurrency], 0) ?? 0)
      : baseCredit;

    // Preserve the existing currency conversion behavior. Only the parsing of
    // the source number/date is hardened here.
    if (
      hasCurrencyAmounts &&
      currDebit === 0 &&
      currCredit === 0 &&
      (baseDebit !== 0 || baseCredit !== 0)
    ) {
      const currency = parseCurrency(currencyCode, currencyName, description, accCode);
      if (currency === "USD") {
        currDebit = baseDebit;
        currCredit = baseCredit;
      } else {
        currDebit = baseDebit * rate;
        currCredit = baseCredit * rate;
      }
    }

    if (!accCode && baseDebit === 0 && baseCredit === 0 && currDebit === 0 && currCredit === 0)
      return;

    rows.push({
      index: rowNumber,
      account_code: accCode,
      account_name: accName,
      base_debit: baseDebit,
      base_credit: baseCredit,
      description: description || accName,
      date: parsedDate ? parsedDate.toISOString().split("T")[0] : "",
      document_number: documentNumber,
      journal_number: journalNumber,
      period,
      currency_code: currencyCode,
      currency_name: currencyName,
      rate,
      curr_debit: currDebit,
      curr_credit: currCredit,
    });
  });

  return { rows, diagnostics, headerIndex, detectedColumns: columns };
}

export function parseOracleSheetRows(rawRows: any[][]): ParsedOracleRow[] {
  return parseOracleSheetRowsDetailed(rawRows).rows;
}

export function parseOracleTextToRows(text: string): ParsedOracleRow[] {
  if (!text || !text.trim()) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const start = /كود الحساب|اسم الحساب|رقم القيد|مدين|دائن/i.test(lines[0]) ? 1 : 0;
  const rows: ParsedOracleRow[] = [];

  for (let i = start; i < lines.length; i++) {
    let cols = lines[i].split(/\t/);
    if (cols.length < 5) cols = lines[i].split(/\s{2,}/);
    if (cols.length < 5) cols = lines[i].split(/;/);
    if (cols.length < 5) continue;

    const accCode = cleanText(cols[1]);
    const accName = cleanText(cols[2]);
    const baseDebit = readNumber(cols[3], 0) ?? 0;
    const baseCredit = readNumber(cols[4], 0) ?? 0;
    const description = cleanText(cols[5]);
    const rawDate = cols[6];
    const journalNum = cleanText(cols[7]);
    const period = cleanText(cols[8]);
    const currCode = cleanText(cols[9]);
    const currName = cleanText(cols[10]);
    const rate = Math.max(readNumber(cols[11], 1) ?? 1, 0.0000001);
    let currDebit = readNumber(cols[12], 0) ?? 0;
    let currCredit = readNumber(cols[13], 0) ?? 0;
    const currency = parseCurrency(currCode, currName, description, accCode);

    if (currDebit === 0 && currCredit === 0) {
      if (currency === "USD") {
        currDebit = baseDebit;
        currCredit = baseCredit;
      } else {
        currDebit = baseDebit * rate;
        currCredit = baseCredit * rate;
      }
    }

    rows.push({
      index: i + 1,
      account_code: accCode,
      account_name: accName,
      base_debit: baseDebit,
      base_credit: baseCredit,
      description: description || accName,
      date: parseDateDDMMYYYY(rawDate),
      document_number: "",
      journal_number: journalNum,
      period,
      currency_code: currCode,
      currency_name: currName,
      rate,
      curr_debit: currDebit,
      curr_credit: currCredit,
    });
  }
  return rows;
}

export function groupOracleRowsIntoJournalEntries(rows: ParsedOracleRow[]): JournalEntry[] {
  if (!rows?.length) return [];
  const groups = new Map<
    string,
    { period: string; journalNum: string; date: string; rows: ParsedOracleRow[] }
  >();

  for (const row of rows) {
    const period = cleanText(row.period) || "1";
    const journalNum = cleanText(row.journal_number || row.document_number);
    const key = journalNum ? `j_${journalNum}` : `bal_${cleanText(row.account_code) || "?"}`;
    if (!groups.has(key)) groups.set(key, { period, journalNum, date: row.date, rows: [] });
    groups.get(key)!.rows.push(row);
  }

  const entries: JournalEntry[] = [];
  let seq = 1;
  for (const group of groups.values()) {
    const first = group.rows[0];
    const periodNum = parseInt(group.period, 10) || 1;
    const firstAcc = first.account_code || "";
    const journalNum = group.journalNum || (firstAcc ? `BAL-${firstAcc}` : String(seq));
    const reference = `${String(periodNum).padStart(2, "0")}/${String(journalNum).padStart(2, "0")}`;
    const primaryCurrency = parseCurrency(
      first.currency_code,
      first.currency_name,
      first.description,
      first.account_code,
    );

    const lines: JournalLine[] = group.rows.map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      debit: r.curr_debit,
      credit: r.curr_credit,
      description: r.description || r.account_name,
      currency: parseCurrency(r.currency_code, r.currency_name, r.description, r.account_code),
      rate: r.rate || 1,
    }));

    entries.push({
      sequence: seq++,
      id: `ORACLE-${reference.replace("/", "-")}-${Date.now().toString(36)}-${seq}`,
      date: group.date,
      reference,
      description: first.description || `قيد رقم (${reference}) - فترة ${periodNum}`,
      currency: primaryCurrency,
      lines,
    });
  }

  entries.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.reference || "").localeCompare(b.reference || "", undefined, { numeric: true });
  });
  entries.forEach((e, i) => {
    e.sequence = i + 1;
  });
  return entries;
}
