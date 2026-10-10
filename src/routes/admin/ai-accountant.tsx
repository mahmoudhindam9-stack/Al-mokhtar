// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText, Calculator, ShieldAlert, CalendarDays } from "lucide-react";
import { erpStore } from "@/shared/services/erpStore";

export const Route = createFileRoute("/admin/ai-accountant")({
  head: () => ({ meta: [{ title: "المحاسب AI - المختار" }] }),
  component: AIAccountantPage,
});

function AIAccountantPage() {
  const [period, setPeriod] = useState("month");
  const [reportType, setReportType] = useState("comprehensive");
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [taxType, setTaxType] = useState("all");
  const [generated, setGenerated] = useState(false);
  const state = useMemo(() => erpStore.getState(), []);
  const transactions = (state?.journalEntries || state?.journal_entries || state?.vouchers || []).filter((x:any) => {
    const d = String(x.date || x.created_at || x.entry_date || "").slice(0,10);
    return d && d >= from && d <= to;
  });
  const employees = state?.employees || [];
  const total = (items:any[], keys:string[]) => items.reduce((s,x) => s + Number(keys.map(k=>x?.[k]).find(v=>v!==undefined && v!==null) || 0),0);
  const income = total(transactions.filter((x:any)=>/income|revenue|إيراد|دخل/i.test(String(x.type||x.category||x.account_name||""))),["amount","total","debit"]);
  const expenses = total(transactions.filter((x:any)=>/expense|مصروف|رواتب/i.test(String(x.type||x.category||x.account_name||""))),["amount","total","credit"]);
  const print = () => window.print();
  return <div dir="rtl" className="printable-area p-4 md:p-6 space-y-6"><div className="print-brand-header" dir="rtl"><img src="/al-mokhtar-mark.svg" alt="شعار المختار"/><div><strong>المختار</strong><span>لإدارة المشروعات</span></div></div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-black">المحاسب AI</h1><p className="text-sm text-muted-foreground mt-1">تقارير مالية وضريبية وتأمينية لمنشأة المختار</p></div>
      <Button onClick={print} className="gap-2 print:hidden"><Printer size={16}/> طباعة / حفظ PDF</Button>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays size={19}/> إعداد التقرير</CardTitle><CardDescription>اختر نوع التقرير والفترة. يتم إعداد الأرقام من البيانات المتاحة في النظام، وتُعرض الالتزامات القانونية كتقديرات إلى أن تستكمل بيانات التسجيل والمراجعة.</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="space-y-2"><Label>نوع التقرير</Label><Select value={reportType} onValueChange={setReportType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="comprehensive">تقرير مالي شامل</SelectItem><SelectItem value="income">الإيرادات والمصروفات</SelectItem><SelectItem value="tax">الضرائب</SelectItem><SelectItem value="insurance">التأمينات الاجتماعية</SelectItem><SelectItem value="assets">الأصول والالتزامات</SelectItem><SelectItem value="payroll">الرواتب والأجور</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>الفترة</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="day">يوم</SelectItem><SelectItem value="month">شهر</SelectItem><SelectItem value="quarter">ربع سنة (Quarter)</SelectItem><SelectItem value="half">نصف سنة</SelectItem><SelectItem value="year">سنة</SelectItem><SelectItem value="custom">فترة مخصصة</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
        <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
        <div className="space-y-2 md:col-span-2"><Label>نوع الضريبة (لتقرير الضرائب)</Label><Select value={taxType} onValueChange={setTaxType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">كل الضرائب المحتمل انطباقها</SelectItem><SelectItem value="income">ضريبة الدخل</SelectItem><SelectItem value="property">الضريبة العقارية</SelectItem><SelectItem value="vat">ضريبة القيمة المضافة</SelectItem><SelectItem value="withholding">الخصم والتحصيل تحت حساب الضريبة</SelectItem><SelectItem value="stamp">ضريبة الدمغة</SelectItem></SelectContent></Select></div>
        <div className="flex items-end"><Button className="w-full" onClick={()=>setGenerated(true)}><FileText size={16} className="ml-2"/> إنشاء التقرير</Button></div>
      </CardContent>
    </Card>
    {generated && <div id="ai-accountant-report" className="space-y-4">
      <Card><CardHeader><CardTitle>تقرير المختار — {({comprehensive:"مالي شامل",income:"الإيرادات والمصروفات",tax:"الضرائب",insurance:"التأمينات الاجتماعية",assets:"الأصول والالتزامات",payroll:"الرواتب والأجور"} as any)[reportType]}</CardTitle><CardDescription>الفترة من {from} إلى {to} · العملة الأساسية تُراجع حسب إعدادات المنشأة</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">السجلات المالية المطابقة للفترة</p><p className="text-2xl font-bold">{transactions.length}</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">إجمالي الإيرادات المكتشفة</p><p className="text-2xl font-bold">{income.toLocaleString("ar-EG")} ج.م</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">إجمالي المصروفات المكتشفة</p><p className="text-2xl font-bold">{expenses.toLocaleString("ar-EG")} ج.م</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">الموظفون في سجل الموارد البشرية</p><p className="text-2xl font-bold">{employees.length}</p></div>
      </CardContent></Card>
      {(reportType==="comprehensive"||reportType==="tax") && <Card><CardHeader><CardTitle>مراجعة الالتزامات الضريبية</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        {["ضريبة الدخل على الأرباح وفق الشكل القانوني وطبيعة النشاط","الضريبة العقارية بحسب العقارات الخاضعة وصفة المالك/المستغل","ضريبة القيمة المضافة بحسب التسجيل وطبيعة التوريدات والإيرادات","الخصم والتحصيل تحت حساب الضريبة وضريبة الدمغة عند انطباقها","الضرائب والرسوم الأخرى التي تقتضيها معاملات المنشأة"].filter((_,i)=>taxType==="all"||(["income","property","vat","withholding","stamp"][i]===taxType)).map(x=><div key={x} className="border rounded-lg p-3">{x}<p className="text-muted-foreground mt-1">يتطلب حسابًا نهائيًا: ملف ضريبي محدث، الشكل القانوني، بيانات العقارات والفواتير والإقرارات والخصومات.</p></div>)}
      </CardContent></Card>}
      {(reportType==="comprehensive"||reportType==="insurance"||reportType==="payroll") && <Card><CardHeader><CardTitle>مراجعة التأمينات الاجتماعية للعاملين</CardTitle></CardHeader><CardContent><p className="text-sm">عدد الموظفين المسجلين في الموارد البشرية: {employees.length}. يجب حساب حصة العامل وحصة المنشأة لكل موظف على أساس أجر الاشتراك التأميني المسجل، وتاريخ الالتحاق، وحالة التأمين، والحدود التأمينية السارية للفترة. لا تُستنتج الأجور الناقصة ولا تُعامل البيانات غير المكتملة كمبالغ نهائية.</p><div className="mt-3 rounded-lg border p-3 text-sm">أكمل بيانات أجر الاشتراك ورقم التأمين وتاريخ بداية التأمين لكل موظف قبل اعتماد كشف السداد.</div></CardContent></Card>}
      <Card><CardHeader><CardTitle>ملاحظات ومراجعات مطلوبة</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><p>• التقرير يعتمد على السجلات المتاحة في التطبيق وقد تتطلب مطابقة القيود تصنيفًا محاسبيًا دقيقًا.</p><p>• لا تُعرض قيمة ضريبة أو تأمين على أنها مستحقة نهائيًا ما لم تتوفر بيانات الأساس القانوني والحسابات المطلوبة.</p><p>• راجع التقرير مع محاسب قانوني قبل تقديم الإقرارات أو السداد.</p></CardContent></Card>
    </div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert size={18}/> مصادر قانونية رسمية</CardTitle><CardDescription>يجب تحديث القواعد عند صدور أي تعديل جديد، وتحديد السنة الضريبية/فترة الاستحقاق في كل تقرير.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">
      <a className="block underline text-primary" href="https://www.incometax.gov.eg/ar/content/qwanyn-aldrybt-ly-aldkhl" target="_blank" rel="noreferrer">مصلحة الضرائب المصرية — قوانين ضريبة الدخل</a>
      <a className="block underline text-primary" href="https://www.nosi.gov.eg/ar/News/Pages/2025-11-30.aspx" target="_blank" rel="noreferrer">الهيئة القومية للتأمين الاجتماعي — حدود أجر الاشتراك لعام 2026</a>
      <a className="block underline text-primary" href="https://portal.eta.gov.eg/en/node/837" target="_blank" rel="noreferrer">مصلحة الضرائب — التشريعات الأخرى ومنها قانون العمل رقم 14 لسنة 2025</a>
      <p className="text-muted-foreground">تنبيه: هذا القسم أداة مساعدة لإعداد التقارير، وليس بديلًا عن مراجعة محاسب/مستشار قانوني. لا يتم تقديم إقرار ضريبي أو إجراء سداد تلقائي.</p>
    </CardContent></Card>
    <style>{`@media print { body * { visibility: hidden; } #ai-accountant-report, #ai-accountant-report * { visibility: visible; } #ai-accountant-report { position: absolute; inset: 0; width: 100%; } }`}</style>
  </div>;
}
