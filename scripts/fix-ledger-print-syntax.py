from pathlib import Path
import re

p = Path('src/routes/admin/ledger.tsx')
s = p.read_text(encoding='utf-8')

# Remove the previous malformed injection from anywhere in the component.
s, n = re.subn(
    r'\n\s*const getLedgerReportRows = \(\) => \{[\s\S]*?\n\s*const verifiedPrintControls = \([\s\S]*?\n\s*\);\n',
    '\n',
    s,
    count=1,
)

# Insert helpers immediately before the component's final JSX return.
return_positions = [m.start() for m in re.finditer(r'\n  return \(\n', s)]
if not return_positions:
    raise SystemExit('no component return found')
idx = return_positions[-1]

block = r'''
  const getLedgerReportRows = () => {
    const entries = (erpState?.journalEntries || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries.map((entry) => {
      const debit = (entry.lines || []).reduce((n, l) => n + Number(l.debit || 0), 0);
      const credit = (entry.lines || []).reduce((n, l) => n + Number(l.credit || 0), 0);
      return {
        date: entry.date || '-',
        reference: entry.reference || '-',
        description: entry.description || '-',
        currency: entry.currency || 'EGP',
        debit: debit,
        credit: credit,
        lines: (entry.lines || []).map((l) => `${l.account_code || ''} — ${l.account_name || erpStore.getState().accounts.find((a) => a.code === l.account_code)?.name_ar || 'حساب غير معرف'}`).join(' | '),
      };
    });
  };

  const printLedger = (accounting = false) => {
    const rows = getLedgerReportRows();
    printAccountingDocument({
      title: accounting ? 'مستند محاسبي — دفتر الأستاذ' : 'تقرير القيود المحاسبية',
      subtitle: `عدد القيود: ${rows.length} | المصدر: دفتر الأستاذ الموحد`,
      documentNo: `LEDGER-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
      columns: [
        { key: 'date', label: 'التاريخ' }, { key: 'reference', label: 'رقم القيد' }, { key: 'description', label: 'البيان' },
        { key: 'currency', label: 'العملة', align: 'center' }, { key: 'debit', label: 'إجمالي المدين', align: 'left' }, { key: 'credit', label: 'إجمالي الدائن', align: 'left' }, { key: 'lines', label: 'الحسابات وأكوادها' },
      ],
      rows,
      totals: [
        { label: 'عدد القيود', value: String(rows.length) },
        { label: 'إجمالي المدين', value: rows.reduce((n, r) => n + r.debit, 0).toLocaleString('en-US') },
        { label: 'إجمالي الدائن', value: rows.reduce((n, r) => n + r.credit, 0).toLocaleString('en-US') },
      ],
    });
  };

  const exportLedgerToExcel = () => {
    const rows = getLedgerReportRows();
    if (!rows.length) {
      toast({ title: 'لا توجد قيود', description: 'لا توجد قيود لتصديرها.', variant: 'destructive' });
      return;
    }
    const flat = rows.map((r) => ({ 'التاريخ': r.date, 'رقم القيد': r.reference, 'البيان': r.description, 'العملة': r.currency, 'المدين': r.debit, 'الدائن': r.credit, 'الحسابات': r.lines }));
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القيود');
    XLSX.writeFile(wb, `القيود_المحاسبية_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const verifiedPrintControls = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button type="button" variant="outline" onClick={() => printLedger(false)} className="font-bold gap-2"><Printer size={15}/> طباعة القيود</Button>
      <Button type="button" variant="outline" onClick={() => printLedger(true)} className="font-bold gap-2"><FileText size={15}/> مستند محاسبي</Button>
      <Button type="button" variant="outline" onClick={exportLedgerToExcel} className="font-bold gap-2"><FileSpreadsheet size={15}/> Excel</Button>
    </div>
  );
'''

s = s[:idx] + block + s[idx:]
# Render controls at the beginning of the root JSX, immediately after return fragment's first opening tag.
root = re.search(r'(\n  return \(\n)([\s\S]*?)', s)
if not root:
    raise SystemExit('root return regex failed')
# Insert before the first JSX comment/component child after the opening root tag by targeting the first newline after the first <div ...> following final return.
start = idx + len(block)
post = s[start:]
m = re.search(r'(\n\s*return \(\n\s*<div[^>]*>\n)', post)
if not m:
    # Fallback: first root <div> after final return, allowing multi-line attrs.
    m = re.search(r'(\n\s*return \(\n\s*<div[\s\S]*?>\n)', post)
if not m:
    raise SystemExit('root div not found')
insert_at = start + m.end()
s = s[:insert_at] + '    {verifiedPrintControls}\n' + s[insert_at:]

p.write_text(s, encoding='utf-8')
print('ledger print placement repaired')
