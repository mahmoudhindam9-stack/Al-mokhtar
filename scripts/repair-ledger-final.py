from pathlib import Path
import re
import subprocess

p = Path('src/routes/admin/ledger.tsx')
# Always start from the exact source committed on this branch before any prior
# in-run mutation. This makes the repair idempotent and removes malformed prior injections.
clean = subprocess.check_output(['git', 'show', 'HEAD:src/routes/admin/ledger.tsx'], text=True)
s = clean

anchor = 'import { AccountSearchSelect } from "@/components/AccountSearchSelect";\n'
if 'printAccountingDocument' not in s:
    if anchor not in s:
        raise SystemExit('ledger import anchor missing')
    s = s.replace(anchor, anchor + 'import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";\n', 1)

# Find the component's final render return, not a nested callback return.
positions = [m.start() for m in re.finditer(r'\n  return \(\n', s)]
if not positions:
    raise SystemExit('LedgerPage render return not found')
render_idx = positions[-1]

helpers = r'''
  const getLedgerReportRows = () => {
    const entries = [...(erpState?.journalEntries || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries.map((entry) => {
      const debit = (entry.lines || []).reduce((n, l) => n + Number(l.debit || 0), 0);
      const credit = (entry.lines || []).reduce((n, l) => n + Number(l.credit || 0), 0);
      return {
        date: entry.date || '-',
        reference: entry.reference || '-',
        description: entry.description || '-',
        currency: entry.currency || 'EGP',
        debit,
        credit,
        accounts: (entry.lines || []).map((line) => {
          const acc = erpStore.getState().accounts.find((a) => a.code === line.account_code);
          return `${line.account_code || ''} — ${line.account_name || acc?.name_ar || 'حساب غير معرف'}`;
        }).join(' | '),
      };
    });
  };

  const printLedgerReport = (asAccountingDocument = false) => {
    const rows = getLedgerReportRows();
    printAccountingDocument({
      title: asAccountingDocument ? 'مستند محاسبي — دفتر الأستاذ العام' : 'تقرير القيود المحاسبية',
      subtitle: `عدد القيود: ${rows.length} | المصدر الموحد: دفتر الأستاذ العام`,
      documentNo: `LEDGER-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
      columns: [
        { key: 'date', label: 'التاريخ' },
        { key: 'reference', label: 'رقم القيد' },
        { key: 'description', label: 'البيان' },
        { key: 'currency', label: 'العملة', align: 'center' },
        { key: 'debit', label: 'المدين', align: 'left' },
        { key: 'credit', label: 'الدائن', align: 'left' },
        { key: 'accounts', label: 'الحسابات وأكوادها' },
      ],
      rows,
      totals: [
        { label: 'عدد القيود', value: String(rows.length) },
        { label: 'إجمالي المدين', value: rows.reduce((n, r) => n + r.debit, 0).toLocaleString('en-US') },
        { label: 'إجمالي الدائن', value: rows.reduce((n, r) => n + r.credit, 0).toLocaleString('en-US') },
      ],
    });
  };

  const exportLedgerReportToExcel = () => {
    const rows = getLedgerReportRows();
    if (!rows.length) {
      toast({ title: 'لا توجد قيود', description: 'لا توجد قيود لتصديرها.', variant: 'destructive' });
      return;
    }
    const sheetRows = rows.map((r) => ({
      'التاريخ': r.date,
      'رقم القيد': r.reference,
      'البيان': r.description,
      'العملة': r.currency,
      'المدين': r.debit,
      'الدائن': r.credit,
      'الحسابات وأكوادها': r.accounts,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القيود');
    XLSX.writeFile(wb, `القيود_المحاسبية_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

'''
s = s[:render_idx] + helpers + s[render_idx:]

# Insert verified controls directly after the root JSX opening element of LedgerPage.
new_render_idx = s.find('\n  return (\n', render_idx)
if new_render_idx == -1:
    new_render_idx = s.rfind('\n  return (\n')
root_match = re.search(r'(\n  return \(\n\s*<div[\s\S]*?>\n)', s[new_render_idx:])
if not root_match:
    raise SystemExit('LedgerPage root JSX div not found')
insert_at = new_render_idx + root_match.end()
controls = '''    <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
      <Button type="button" variant="outline" onClick={() => printLedgerReport(false)} className="font-bold gap-2" title="طباعة القيود"><Printer size={15} /> طباعة القيود</Button>
      <Button type="button" variant="outline" onClick={() => printLedgerReport(true)} className="font-bold gap-2" title="طباعة مستند محاسبي"><FileText size={15} /> مستند محاسبي</Button>
      <Button type="button" variant="outline" onClick={exportLedgerReportToExcel} className="font-bold gap-2" title="تصدير القيود إلى Excel"><FileSpreadsheet size={15} /> Excel</Button>
    </div>
'''
s = s[:insert_at] + controls + s[insert_at:]

p.write_text(s, encoding='utf-8')
print('ledger final repair complete')
