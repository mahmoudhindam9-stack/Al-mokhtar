import { type JournalEntry, type JournalLine } from "@/shared/services/erpStore";
import { parseCurrency, type ParsedOracleRow } from "@/shared/utils/oracleParser";

/**
 * Oracle journal identity is YEAR + MONTH + JOURNAL NUMBER.
 * A reference such as 05/13 means journal 13 in May. The same number can
 * legitimately exist again in another month or year.
 */
export function groupOracleRowsIntoJournalEntriesOrdered(rows: ParsedOracleRow[]): JournalEntry[] {
  if (!rows?.length) return [];

  type OracleJournalGroup = {
    year: number;
    month: number;
    sequence: number;
    date: string;
    rows: ParsedOracleRow[];
  };

  const groups = new Map<string, OracleJournalGroup>();

  for (const row of rows) {
    const rawRef = String(row.journal_number || row.document_number || "").trim();
    const refParts = rawRef.split("/");
    const refMonth = Number(refParts[0]);
    const refSequence = Number(refParts[1]);
    const date = row.date ? new Date(row.date) : null;
    let year = date && !Number.isNaN(date.getTime()) ? date.getUTCFullYear() : 0;
    if (year === 0) {
      const textToSearch = `${row.period || ""} ${rawRef} ${row.description || ""} ${row.account_name || ""}`;
      const yearMatch = textToSearch.match(/20\d{2}/);
      if (yearMatch) year = Number(yearMatch[0]);
    }

    let month = Number(row.period);
    if (!(month >= 1 && month <= 12)) month = refMonth;
    if (!(month >= 1 && month <= 12)) {
      month = date && !Number.isNaN(date.getTime()) ? date.getUTCMonth() + 1 : 1;
    }

    let sequence = Number.isFinite(refSequence) && refSequence > 0 ? refSequence : Number(rawRef);
    if (!Number.isFinite(sequence) || sequence < 1) sequence = 0;

    const key = `${year}|${String(month).padStart(2, "0")}|${sequence}`;
    const entryDate =
      row.date ||
      (year > 0
        ? `${year}-${String(month).padStart(2, "0")}-01`
        : new Date().toISOString().split("T")[0]);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      if (!existing.date && entryDate) existing.date = entryDate;
    } else {
      groups.set(key, { year, month, sequence, date: entryDate, rows: [row] });
    }
  }

  const entries: JournalEntry[] = [];
  for (const group of groups.values()) {
    const first = group.rows[0];
    const reference = `${String(group.month).padStart(2, "0")}/${String(group.sequence).padStart(2, "0")}`;
    const lines: Array<JournalLine & { account_name?: string }> = group.rows.map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      debit: r.curr_debit,
      credit: r.curr_credit,
      description: r.description || r.account_name,
      currency: parseCurrency(r.currency_code, r.currency_name, r.description, r.account_code),
      rate: r.rate || 1,
    }));

    entries.push({
      sequence: 0,
      id: `ORACLE-${group.year}-${reference.replace("/", "-")}-${Date.now().toString(36)}-${entries.length + 1}`,
      date: group.date,
      reference,
      description: first.description || `قيد رقم (${reference})`,
      currency: parseCurrency(
        first.currency_code,
        first.currency_name,
        first.description,
        first.account_code,
      ),
      lines: lines as JournalLine[],
      branch_id: "main",
      created_at: group.date,
      created_by: "oracle-import",
      is_approved: false,
    });
  }

  entries.sort((a, b) => {
    const ya = Number(String(a.date || "").slice(0, 4)) || 0;
    const yb = Number(String(b.date || "").slice(0, 4)) || 0;
    const [ma, sa] = String(a.reference || "00/00")
      .split("/")
      .map(Number);
    const [mb, sb] = String(b.reference || "00/00")
      .split("/")
      .map(Number);
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return ya - yb || ma - mb || sa - sb || da - db;
  });

  entries.forEach((entry, index) => {
    entry.sequence = index + 1;
  });
  return entries;
}
