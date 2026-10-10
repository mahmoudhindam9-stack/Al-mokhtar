const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${relativePath}`);
  return fs.readFileSync(file, "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const grouping = read("src/shared/utils/oracleJournalGrouping.ts");
const translation = read("src/shared/services/translationService.ts");
const currencyGroups = read("src/components/JournalEntryCurrencyGroups.tsx");
const timer = read("src/components/OrderTimer.tsx");

const checks = [
  ["explicit TypeScript check is available", packageJson.scripts?.typecheck === "tsc --noEmit"],
  [
    "financial verification command is wired",
    packageJson.scripts?.["verify:financial"] === "node scripts/verify-financial-sync.cjs",
  ],
  [
    "journal verification command is wired",
    packageJson.scripts?.["verify:journal"] ===
      "node scripts/verify-journal-numbering-and-account-report.cjs",
  ],
  ["Oracle grouping is typed", !grouping.startsWith("// @ts-nocheck")],
  ["translation service is typed", !translation.startsWith("// @ts-nocheck")],
  ["currency group entry is typed", currencyGroups.includes("entry: JournalEntry;")],
  [
    "order timer exposes an accessible timer role",
    timer.includes('role="timer"') && timer.includes("aria-label="),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length) throw new Error(`${failed.length} cleanup invariant(s) failed.`);
console.log("All cleanup invariants passed.");
