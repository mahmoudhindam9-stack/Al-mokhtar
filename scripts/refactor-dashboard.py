from pathlib import Path
import re

path = Path("src/routes/admin/index.tsx")
s = path.read_text(encoding="utf-8")

if '@/components/admin/AuditOperationsModal' not in s:
    anchor = 'import { inventoryService } from "@/features/inventory/services/inventoryService";\n'
    if anchor not in s:
        raise SystemExit("inventoryService import not found")
    s = s.replace(anchor, anchor + 'import { AuditOperationsModal } from "@/components/admin/AuditOperationsModal";\n', 1)

if 'const [isAuditOperationsOpen' not in s:
    anchor = '  const [activeTab, setActiveTab] = useState(tabParam);\n'
    if anchor not in s:
        raise SystemExit("activeTab state not found")
    s = s.replace(
        anchor,
        '  const [activeTab, setActiveTab] = useState(tabParam === "audit_logs" ? "dashboard" : tabParam);\n'
        '  const [isAuditOperationsOpen, setIsAuditOperationsOpen] = useState(false);\n',
        1,
    )

s = s.replace(
    '      setActiveTab(tabParam);\n',
    '      setActiveTab(tabParam === "audit_logs" ? "dashboard" : tabParam);\n',
    1,
)

if 'const accountingSummary = useMemo' not in s:
    marker = '  // Handle Voucher Submission\n'
    if marker not in s:
        raise SystemExit("voucher marker not found")
    block = '''  const accountingSummary = useMemo(() => {
    const accounts = erpState.accounts || [];
    const sumType = (type) => accounts
      .filter((a) => a.type === type)
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const sumByName = (pattern) => accounts
      .filter((a) => pattern.test(String(a.name_ar || "")))
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);

    const totalAssets = sumType("asset");
    const totalLiabilities = sumType("liability");
    const totalEquity = sumType("equity");
    const totalRevenues = sumType("revenue");
    const totalExpenses = sumType("expense");
    const journalEntries = erpState.journalEntries || [];
    let debitTotal = 0;
    let creditTotal = 0;
    let unbalancedEntries = 0;
    journalEntries.forEach((entry) => {
      const debit = (entry.lines || []).reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const credit = (entry.lines || []).reduce((sum, line) => sum + Number(line.credit || 0), 0);
      debitTotal += debit;
      creditTotal += credit;
      if (Math.abs(debit - credit) > 0.01) unbalancedEntries += 1;
    });

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenues,
      totalExpenses,
      netResult: totalRevenues - totalExpenses,
      cash: sumByName(/خزينة|صندوق|نقد|cash/i) || totalCashBalance,
      bank: sumByName(/بنك|مصرف|bank/i) || totalBankBalance,
      inventory: sumByName(/مخزون|مخازن|inventory|stock/i) || Number(s?.inventoryValue || 0),
      journalCount: journalEntries.length,
      debitTotal,
      creditTotal,
      unbalancedEntries,
      accountCount: accounts.length,
    };
  }, [erpState.accounts, erpState.journalEntries, totalCashBalance, totalBankBalance, s?.inventoryValue]);

'''
    s = s.replace(marker, block + marker, 1)

for old, new in [
    ('value={formatPrice(s?.revenue || 0)}', 'value={formatPrice(accountingSummary.totalRevenues || 0)}'),
    ('subtext="مبيعات تشغيلية مباشرة"', 'subtext="من دليل الحسابات المحاسبي"'),
    ('trend={s?.revenue ? "+14.2% اليوم" : "لا توجد مبيعات"}', 'trend={accountingSummary.totalRevenues ? "متزامن مع حساب الأستاذ" : "لا توجد إيرادات"}'),
    ('value={formatPrice(totalCashBalance)}', 'value={formatPrice(accountingSummary.cash || 0)}'),
    ('subtext="السيولة المتوفرة بالصناديق"', 'subtext="الرصيد المحاسبي للخزائن النقدية"'),
    ('value={formatPrice(totalBankBalance)}', 'value={formatPrice(accountingSummary.bank || 0)}'),
    ('subtext="إجمالي حسابات البنوك المعتمدة"', 'subtext="حسابات البنوك الظاهرة في دليل الحسابات"'),
    ('trend="CIB بنك مصر"', 'trend={accountingSummary.bank ? "متزامن مع الحسابات" : "لا توجد حسابات بنكية"}'),
    ('value={formatPrice(s?.inventoryValue || 0)}', 'value={formatPrice(accountingSummary.inventory || 0)}'),
]:
    if old in s:
        s = s.replace(old, new, 1)

if 'data-dashboard-accounting-sync="true"' not in s:
    dashboard_open = '<TabsContent value="dashboard" className="space-y-6 mt-4">'
    if dashboard_open not in s:
        raise SystemExit("dashboard tab opening not found")
    sync = '''<div data-dashboard-accounting-sync="true" className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center"><BookOpen size={18} className="text-primary" /></div>
                    <div><h2 className="text-base font-black text-slate-900">المركز المالي الموحد</h2><p className="text-xs text-muted-foreground mt-0.5">نفس مصدر البيانات المستخدم في دليل الحسابات وحساب الأستاذ والخزائن.</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-bold px-3 py-1.5"><CheckCircle size={13} className="ml-1" /> متزامن لحظياً</Badge><Badge variant="outline" className="font-bold px-3 py-1.5">{accountingSummary.accountCount.toLocaleString("en-US")} حساب</Badge><Badge variant="outline" className="font-bold px-3 py-1.5">{accountingSummary.journalCount.toLocaleString("en-US")} قيد</Badge></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="صافي النتيجة" value={formatPrice(accountingSummary.netResult || 0)} subtext="إجمالي الإيرادات − المصروفات" icon={TrendingUp} trend={accountingSummary.netResult >= 0 ? "نتيجة موجبة" : "نتيجة سالبة"} trendType={accountingSummary.netResult >= 0 ? "up" : "neutral"} accentColor={accountingSummary.netResult >= 0 ? "green" : "primary"} />
                <StatCard title="إجمالي المصروفات" value={formatPrice(accountingSummary.totalExpenses || 0)} subtext="من دليل المصروفات" icon={FileBarChart} trend="مصدر محاسبي" trendType="neutral" accentColor="amber" />
                <StatCard title="دفتر الأستاذ" value={accountingSummary.journalCount.toLocaleString("en-US")} subtext="إجمالي القيود المسجلة" icon={BookOpen} trend={accountingSummary.unbalancedEntries ? `${accountingSummary.unbalancedEntries} يحتاج مراجعة` : "القيود متزنة"} trendType={accountingSummary.unbalancedEntries ? "neutral" : "up"} accentColor={accountingSummary.unbalancedEntries ? "primary" : "green"} />
                <StatCard title="إجمالي الأصول" value={formatPrice(accountingSummary.totalAssets || 0)} subtext="من دليل الحسابات" icon={Building} trend="المصدر المحاسبي" trendType="neutral" accentColor="blue" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/70"><CardContent className="p-5"><div className="text-xs font-bold text-muted-foreground">الالتزامات</div><div className="mt-1 text-2xl font-black">{formatPrice(accountingSummary.totalLiabilities || 0)}</div><div className="mt-2 text-[11px] text-muted-foreground">مرتبط مباشرة بدليل الحسابات</div></CardContent></Card>
                <Card className="border-border/70"><CardContent className="p-5"><div className="text-xs font-bold text-muted-foreground">حقوق الملكية</div><div className="mt-1 text-2xl font-black">{formatPrice(accountingSummary.totalEquity || 0)}</div><div className="mt-2 text-[11px] text-muted-foreground">مرتبط مباشرة بدليل الحسابات</div></CardContent></Card>
                <Card className="border-border/70"><CardContent className="p-5"><div className="text-xs font-bold text-muted-foreground">ميزان الحركة</div><div className="mt-1 text-2xl font-black">{accountingSummary.debitTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div><div className="mt-2 text-[11px] text-muted-foreground">مدين مقابل {accountingSummary.creditTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} دائن</div></CardContent></Card>
              </div>
            </div>

            '''
    s = s.replace(dashboard_open, dashboard_open + '\n            ' + sync, 1)

old_trigger = '''          <TabsTrigger value="audit_logs" className="rounded-lg font-bold py-2 px-4">
            <History size={16} className="ml-1.5 inline" />
            سجل العمليات والرقابة الأمنية
          </TabsTrigger>'''
new_trigger = '''          <Button type="button" variant="outline" onClick={() => setIsAuditOperationsOpen(true)} className="rounded-lg font-bold py-2 px-4 h-auto gap-1.5">
            <History size={16} />
            سجل العمليات
          </Button>'''
if old_trigger in s:
    s = s.replace(old_trigger, new_trigger, 1)
else:
    s = re.sub(r'\s*<TabsTrigger value="audit_logs"[\s\S]*?</TabsTrigger>', '\n' + new_trigger, s, count=1)

s, removed = re.subn(r'\n\s*\{\/\* TAB 6: AUDIT LOGS \*\/\}[\s\S]*?<\/TabsContent>', '\n', s, count=1)
if removed == 0 and 'value="audit_logs"' in s:
    raise SystemExit("legacy audit tab content could not be removed")

if '<AuditOperationsModal ' not in s:
    tabs_close = '      </Tabs>\n'
    if tabs_close not in s:
        raise SystemExit("main Tabs close not found")
    s = s.replace(
        tabs_close,
        '      </Tabs>\n\n'
        '      <AuditOperationsModal\n'
        '        open={isAuditOperationsOpen}\n'
        '        onOpenChange={setIsAuditOperationsOpen}\n'
        '        logs={erpState.auditLogs || []}\n'
        '      />\n',
        1,
    )

s = s.replace('CIB بنك مصر', 'الحسابات البنكية الفعلية')
s = s.replace('placeholder="مثال: خزينة المشروبات، CIB دولار"', 'placeholder="مثال: خزينة المشروبات، دولار"')

path.write_text(s, encoding="utf-8")
print("Dashboard refactor applied")
