// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Download, Calculator, ShieldAlert, CalendarDays, RefreshCw, WalletCards } from "lucide-react";
import { erpStore } from "@/shared/services/erpStore";

export const Route = createFileRoute("/admin/ai-accountant")({
  head: () => ({ meta: [{ title: "المحاسب AI - المختار لإدارة المشروعات" }] }),
  component: AIAccountantPage,
});

const labels = {
  comprehensive: "مالي شامل",
  income: "الإيرادات والمصروفات",
  tax: "الضرائب",
  insurance: "التأمينات الاجتماعية",
  assets: "الأصول والالتزامات",
  payroll: "الرواتب والأجور",
};

function toLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inRange(value: unknown, from: string, to: string) {
  const date = String(value || "").slice(0, 10);
  return date.length === 10 && date >= from && date <= to;
}

function money(value: number) {
  return Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function changeRange(period: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "day") start.setTime(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  if (period === "quarter") start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "half") start.setMonth(now.getMonth() < 6 ? 0 : 6, 1);
  if (period === "year") start.setMonth(0, 1);
  return { from: toLocalDate(start), to: toLocalDate(now) };
}

export function AIAccountantPage() {
  const [period, setPeriod] = useState("month");
  const [reportType, setReportType] = useState("comprehensive");
  const defaultRange = changeRange("month");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [taxType, setTaxType] = useState("all");
  const [generated, setGenerated] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [erpState, setErpState] = useState(() => ({ ...erpStore.getState() }));

  useEffect(() => {
    return erpStore.subscribe(() => setErpState({ ...erpStore.getState() }));
  }, []);

  const report = useMemo(() => {
    const state = erpState || {};
    const accounts = Array.isArray(state.accounts) ? state.accounts : [];
    const accountByCode = new Map(accounts.map((account: any) => [String(account.code), account]));
    const journalEntries = (state.journalEntries || []).filter((entry: any) =>
      inRange(entry.date || entry.created_at, from, to),
    );
    const journalRows = journalEntries.map((entry: any) => {
      let income = 0;
      let expenses = 0;
      let classifiedLines = 0;
      let debit = 0;
      let credit = 0;
      for (const line of Array.isArray(entry.lines) ? entry.lines : []) {
        const lineDebit = Number(line.debit || 0);
        const lineCredit = Number(line.credit || 0);
        const rate = Number(line.rate || 1);
        debit += lineDebit * rate;
        credit += lineCredit * rate;
        const account: any = accountByCode.get(String(line.account_code));
        if (account?.type === "revenue") {
          income += Math.max(0, lineCredit - lineDebit) * rate;
          classifiedLines += 1;
        } else if (account?.type === "expense") {
          expenses += Math.max(0, lineDebit - lineCredit) * rate;
          classifiedLines += 1;
        }
      }
      return {
        date: String(entry.date || entry.created_at || "").slice(0, 10),
        reference: entry.reference || entry.id || "—",
        description: entry.description || "قيد يومية",
        income,
        expenses,
        debit,
        credit,
        source: "قيد يومية",
        classifiedLines,
      };
    });
    const hasClassifiedJournal = journalRows.some((row: any) => row.classifiedLines > 0);

    let rows: any[] = [];
    let source = "لا توجد سجلات مالية للفترة المحددة";
    if (hasClassifiedJournal) {
      rows = journalRows;
      source = "قيود اليومية المصنفة حسب دليل الحسابات";
    } else {
      const vouchers = (state.vouchers || []).filter((voucher: any) =>
        !voucher.deleted && inRange(voucher.created_at || voucher.date, from, to) && voucher.type !== "transfer",
      );
      if (vouchers.length) {
        rows = vouchers.map((voucher: any) => {
          const isIncome = voucher.type === "receipt";
          const amount = Number(voucher.amount || 0);
          return {
            date: String(voucher.created_at || voucher.date || "").slice(0, 10),
            reference: voucher.voucher_number || voucher.id || "—",
            description: voucher.description || voucher.category || "سند مالي",
            income: isIncome ? amount : 0,
            expenses: isIncome ? 0 : amount,
            debit: 0,
            credit: 0,
            source: isIncome ? "سند قبض" : "سند صرف",
            classifiedLines: 0,
          };
        });
        source = "سندات القبض والصرف (لم تتوفر قيود مصنفة للفترة)";
      } else {
        const transactions = (state.treasuryTransactions || []).filter((tx: any) =>
          inRange(tx.created_at || tx.date, from, to) &&
          !["transfer_in", "transfer_out", "transfer", "reconciliation"].includes(String(tx.type || "").toLowerCase()),
        );
        rows = transactions.map((tx: any) => {
          const type = String(tx.type || "").toLowerCase();
          const isIncome = ["sales", "deposit", "receipt", "income"].includes(type);
          const isExpense = ["expense", "purchase", "withdrawal", "payment"].includes(type);
          const amount = Number(tx.amount || 0);
          return {
            date: String(tx.created_at || tx.date || "").slice(0, 10),
            reference: tx.related_entity_id || tx.id || "—",
            description: tx.note || tx.description || type || "حركة خزينة",
            income: isIncome ? amount : 0,
            expenses: isExpense ? amount : 0,
            debit: 0,
            credit: 0,
            source: "حركة خزينة",
            classifiedLines: 0,
          };
        });
        source = transactions.length ? "حركات الخزينة (ملخص نقدي، وليس قائمة دخل مدققة)" : "لا توجد سجلات مالية للفترة المحددة";
      }
    }

    const employees = (state.employees || []).filter((employee: any) => !employee.deleted);
    const selectedRows = rows.filter((row: any) => {
      if (reportType === "income") return row.income > 0 || row.expenses > 0;
      if (reportType === "payroll") return /راتب|أجور|salary|payroll/i.test(String(row.description || ""));
      return true;
    });
    return {
      rows: selectedRows,
      totalRows: rows.length,
      income: rows.reduce((sum: number, row: any) => sum + Number(row.income || 0), 0),
      expenses: rows.reduce((sum: number, row: any) => sum + Number(row.expenses || 0), 0),
      debit: rows.reduce((sum: number, row: any) => sum + Number(row.debit || 0), 0),
      credit: rows.reduce((sum: number, row: any) => sum + Number(row.credit || 0), 0),
      employees,
      journalCount: journalEntries.length,
      source,
      accountsCount: accounts.length,
      totalAssets: accounts.filter((account: any) => account.type === "asset").reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0),
      totalLiabilities: accounts.filter((account: any) => account.type === "liability").reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0),
    };
  }, [erpState, from, to, reportType]);

  const setQuickPeriod = (value: string) => {
    setPeriod(value);
    if (value !== "custom") {
      const range = changeRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const generateReport = () => {
    if (!from || !to || from > to) {
      setValidationError("تأكد من اختيار تاريخ بداية ونهاية صحيحين.");
      setGenerated(false);
      return;
    }
    setValidationError("");
    setGenerated(true);
  };

  const exportCsv = () => {
    const values = [
      ["التاريخ", "المرجع", "البيان", "الإيرادات (ج.م)", "المصروفات (ج.م)", "المصدر"],
      ...report.rows.map((row: any) => [row.date, row.reference, row.description, row.income, row.expenses, row.source]),
      [],
      ["الإجمالي", "", "", report.income, report.expenses, report.source],
    ];
    const csv = "\uFEFF" + values.map((row: any[]) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Al-Mokhtar-${reportType}-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6">
      <div className="ai-accountant-controls flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">المحاسب AI</h1>
          <p className="text-sm text-muted-foreground mt-1">تقارير مالية قابلة للمراجعة والتصدير من سجلات المختار الفعلية</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono">الإصدار {report.source}</Badge>
          <Button variant="outline" onClick={() => setErpState({ ...erpStore.getState() })} className="gap-2">
            <RefreshCw size={16}/> تحديث البيانات
          </Button>
        </div>
      </div>

      <Card className="ai-accountant-controls">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays size={19}/> إعداد التقرير</CardTitle>
          <CardDescription>تتحدث الأرقام من مخزن البرنامج عند تغيّر البيانات. القيم الضريبية والتأمينية القانونية تظل للمراجعة ولا تُعرض كاستحقاقات نهائية دون بياناتها الأساسية.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>نوع التقرير</Label><Select value={reportType} onValueChange={setReportType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="comprehensive">تقرير مالي شامل</SelectItem><SelectItem value="income">الإيرادات والمصروفات</SelectItem><SelectItem value="tax">الضرائب</SelectItem><SelectItem value="insurance">التأمينات الاجتماعية</SelectItem><SelectItem value="assets">الأصول والالتزامات</SelectItem><SelectItem value="payroll">الرواتب والأجور</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>الفترة</Label><Select value={period} onValueChange={setQuickPeriod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="day">اليوم</SelectItem><SelectItem value="month">الشهر الحالي</SelectItem><SelectItem value="quarter">الربع الحالي</SelectItem><SelectItem value="half">النصف الحالي</SelectItem><SelectItem value="year">السنة الحالية</SelectItem><SelectItem value="custom">فترة مخصصة</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={from} onChange={(event) => {setPeriod("custom");setFrom(event.target.value);}}/></div>
          <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={(event) => {setPeriod("custom");setTo(event.target.value);}}/></div>
          <div className="space-y-2 md:col-span-2"><Label>نوع الضريبة (لتقرير الضرائب)</Label><Select value={taxType} onValueChange={setTaxType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">كل الالتزامات المحتمل انطباقها</SelectItem><SelectItem value="income">ضريبة الدخل</SelectItem><SelectItem value="property">الضريبة العقارية</SelectItem><SelectItem value="vat">ضريبة القيمة المضافة</SelectItem><SelectItem value="withholding">الخصم والتحصيل تحت حساب الضريبة</SelectItem><SelectItem value="stamp">ضريبة الدمغة</SelectItem></SelectContent></Select></div>
          <div className="flex items-end"><Button className="w-full gap-2" onClick={generateReport}><FileText size={16}/> إنشاء التقرير</Button></div>
          {validationError && <p role="alert" className="text-sm text-destructive md:col-span-4">{validationError}</p>}
        </CardContent>
      </Card>

      {generated && <div id="ai-accountant-report" className="printable-area space-y-4">
        <div className="print-brand-header" dir="rtl"><img src="/al-mokhtar-mark.svg" alt="شعار المختار"/><div><strong>المختار</strong><span>لإدارة المشروعات</span></div></div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-black">تقرير المختار — {labels[reportType]}</h2><p className="text-sm text-muted-foreground mt-1">من {from} إلى {to} · أُنشئ في {new Date().toLocaleString("ar-EG")}</p></div>
          <div className="ai-accountant-controls flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} className="gap-2"><Download size={16}/> تصدير Excel/CSV</Button>
            <Button onClick={() => window.print()} className="gap-2"><Printer size={16}/> طباعة / PDF</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">مصدر البيانات: {report.source}. عدد القيود المطابقة للفترة: {report.journalCount}.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardDescription>الإيرادات المصنفة</CardDescription><CardTitle className="text-2xl text-primary">{money(report.income)} ج.م</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>المصروفات المصنفة</CardDescription><CardTitle className="text-2xl">{money(report.expenses)} ج.م</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>صافي الإيرادات ناقص المصروفات</CardDescription><CardTitle className={`text-2xl ${report.income-report.expenses < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}>{money(report.income-report.expenses)} ج.م</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>سجلات التقرير</CardDescription><CardTitle className="text-2xl">{report.totalRows}</CardTitle></CardHeader></Card>
        </div>

        {reportType === "assets" && <Card><CardHeader><CardTitle>ملخص الأصول والالتزامات المسجلة</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-3"><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">إجمالي أرصدة حسابات الأصول</p><p className="text-xl font-black">{money(report.totalAssets)} ج.م</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">إجمالي أرصدة حسابات الالتزامات</p><p className="text-xl font-black">{money(report.totalLiabilities)} ج.م</p></div></CardContent></Card>}

        {(reportType === "comprehensive" || reportType === "income" || reportType === "assets" || reportType === "payroll") && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Calculator size={18}/> تفاصيل السجلات المالية</CardTitle><CardDescription>يتم عرض المبالغ كما وردت في سجلات البرنامج؛ إذا لم يكن دليل الحسابات يصنف قيود اليومية فقد يعتمد الملخص على السندات أو حركات الخزينة ويظهر مصدرها بوضوح.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-muted"><tr><th className="p-3">التاريخ</th><th className="p-3">المرجع</th><th className="p-3">البيان</th><th className="p-3">الإيراد</th><th className="p-3">المصروف</th><th className="p-3">المصدر</th></tr></thead><tbody className="divide-y divide-border">{report.rows.length ? report.rows.map((row:any,index:number)=><tr key={row.reference+`-`+index} className="hover:bg-muted/50"><td className="p-3 whitespace-nowrap">{row.date || "—"}</td><td className="p-3 font-mono text-xs">{row.reference}</td><td className="p-3">{row.description}</td><td className="p-3 font-bold">{row.income ? money(row.income)+" ج.م" : "—"}</td><td className="p-3 font-bold">{row.expenses ? money(row.expenses)+" ج.م" : "—"}</td><td className="p-3 text-xs text-muted-foreground">{row.source}</td></tr>):<tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد سجلات للفترة المختارة. تحقق من التاريخ أو أضف السجلات المالية أولاً.</td></tr>}</tbody><tfoot className="bg-muted/60 font-black"><tr><td colSpan={3} className="p-3">الإجمالي</td><td className="p-3">{money(report.income)} ج.م</td><td className="p-3">{money(report.expenses)} ج.م</td><td className="p-3">—</td></tr></tfoot></table></div></CardContent></Card>}

        {(reportType === "comprehensive" || reportType === "tax") && <Card><CardHeader><CardTitle>مراجعة الالتزامات الضريبية</CardTitle><CardDescription>قائمة مراجعة وليست قيمة مستحقة نهائيًا.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">{[
          ["income","ضريبة الدخل على الأرباح وفق الشكل القانوني وطبيعة النشاط"],
          ["property","الضريبة العقارية بحسب العقارات الخاضعة وصفة المالك/المستغل"],
          ["vat","ضريبة القيمة المضافة بحسب التسجيل وطبيعة التوريدات والإيرادات"],
          ["withholding","الخصم والتحصيل تحت حساب الضريبة"],
          ["stamp","ضريبة الدمغة عند انطباقها"],
        ].filter(([key])=>taxType==="all"||key===taxType).map(([key,text])=><div key={key} className="border rounded-lg p-3">{text}<p className="text-muted-foreground mt-1">يستلزم الحساب المعتمد بيانات التسجيل والفواتير والخصومات والإقرارات والفترة الضريبية.</p></div>)}</CardContent></Card>}

        {(reportType === "comprehensive" || reportType === "insurance" || reportType === "payroll") && <Card><CardHeader><CardTitle>مراجعة التأمينات الاجتماعية للعاملين</CardTitle></CardHeader><CardContent><p className="text-sm">عدد الموظفين المسجلين: {report.employees.length}. يجب حساب حصة العامل وحصة المنشأة وفق أجر الاشتراك التأميني وتاريخ بدء التأمين والحدود السارية لكل فترة. التقرير لا يستنتج الأجور أو الاستحقاقات الناقصة.</p><div className="mt-3 overflow-x-auto rounded-xl border"><table className="w-full min-w-[520px] text-right text-sm"><thead className="bg-muted"><tr><th className="p-3">الموظف</th><th className="p-3">الوظيفة</th><th className="p-3">الحالة</th><th className="p-3">المرتب المسجل</th></tr></thead><tbody className="divide-y divide-border">{report.employees.length ? report.employees.map((employee:any)=> <tr key={employee.id}><td className="p-3">{employee.name || employee.full_name || employee.name_ar || "—"}</td><td className="p-3">{employee.position || employee.job_title || employee.role || "—"}</td><td className="p-3">{employee.status || "—"}</td><td className="p-3">{employee.salary == null ? "غير مكتمل" : money(Number(employee.salary))+" ج.م"}</td></tr>) : <tr><td colSpan={4} className="p-5 text-center text-muted-foreground">لا توجد بيانات موظفين ضمن السجل الحالي.</td></tr>}</tbody></table></div><p className="text-xs text-muted-foreground mt-3">أكمل بيانات أجر الاشتراك ورقم التأمين وتاريخ بداية التأمين لكل موظف قبل اعتماد كشف السداد.</p></CardContent></Card>}

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert size={18}/> ملاحظات المراجعة</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><p>• يعتمد التقرير على بيانات التطبيق المتاحة للفترة والتصنيفات الموجودة في دليل الحسابات.</p><p>• قد تختلف حركات الخزينة عن الإيرادات المحاسبية؛ عند استخدامها كمصدر احتياطي يوضح التقرير ذلك صراحةً.</p><p>• راجع التقرير مع محاسب قانوني قبل تقديم الإقرارات أو اعتماد السداد.</p></CardContent></Card>
      </div>}

      <Card className="ai-accountant-controls"><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards size={18}/> مصادر قانونية ومحاسبية للمراجعة</CardTitle><CardDescription>تُفتح المصادر الرسمية في نافذة جديدة، ويجب التحقق من سريان القواعد على فترة التقرير.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><a className="block underline text-primary" href="https://www.incometax.gov.eg/ar/content/qwanyn-aldrybt-ly-aldkhl" target="_blank" rel="noreferrer">مصلحة الضرائب المصرية — قوانين ضريبة الدخل</a><a className="block underline text-primary" href="https://www.nosi.gov.eg/ar/News/Pages/2025-11-30.aspx" target="_blank" rel="noreferrer">الهيئة القومية للتأمين الاجتماعي</a><a className="block underline text-primary" href="https://portal.eta.gov.eg/en/node/837" target="_blank" rel="noreferrer">مصلحة الضرائب — التشريعات والإرشادات</a><p className="text-muted-foreground">هذه الأداة تنظّم بيانات التقرير وتساعد على المراجعة، ولا تُقدّم إقرارًا ضريبيًا أو إجراء سداد تلقائيًا.</p></CardContent></Card>
      <style>{`@media print { body * { visibility: hidden !important; } #ai-accountant-report, #ai-accountant-report * { visibility: visible !important; } #ai-accountant-report { position: absolute !important; inset: 0 auto auto 0; width: 100% !important; margin: 0 !important; padding: 0 !important; } .ai-accountant-controls { display: none !important; } .print-brand-header { display: flex !important; } }`}</style>
    </div>
  );
}
