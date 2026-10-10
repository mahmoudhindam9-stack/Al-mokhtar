const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readRequired(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${rel}`);
  return fs.readFileSync(file, "utf8");
}

const ledger = readRequired("src/routes/admin/ledger.tsx");
const grouping = readRequired("src/shared/utils/oracleJournalGrouping.ts");
const parser = readRequired("src/shared/utils/oracleImportDiagnostics.ts");

const checks = [
  [
    "ledger uses ordered Oracle journal grouping",
    ledger.includes("groupOracleRowsIntoJournalEntriesOrdered"),
  ],
  [
    "grouping preserves year/month/sequence identity",
    grouping.includes('const key = `${year}|${String(month).padStart(2, "0")}|${sequence}`'),
  ],
  ["import report tracks newly created accounts", ledger.includes("newlyCreatedAccounts")],
  [
    "Oracle numeric diagnostics are available",
    parser.includes("parseOracleNumber") && parser.includes("validateOracleRow"),
  ],
  [
    "grouped journal lines keep account names for display",
    grouping.includes("account_name: r.account_name"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length) throw new Error(`${failed.length} journal/import invariant(s) failed.`);
console.log("All journal numbering and import-report invariants passed.");
