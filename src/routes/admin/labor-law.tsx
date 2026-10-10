// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Printer, FileText, Scale, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/labor-law")({
  head: () => ({ meta: [{ title: "قانون العمل واللوائح - المختار" }] }),
  component: LaborLawPage,
});

const sections = [
 {id:"organization", title:"لائحة تنظيم العمل", body:"تحدد اللائحة مواعيد العمل والراحة الأسبوعية ونظام الحضور والانصراف والإشراف والتكليفات وقواعد السلامة والصحة المهنية وآلية تقديم الشكاوى."},
 {id:"penalties", title:"لائحة الجزاءات والتحقيق", body:"لا يوقع جزاء إلا وفق القانون واللائحة المعتمدة وبعد توثيق الواقعة وسماع أقوال العامل وإتاحة حق الدفاع ومراعاة التناسب والحدود القانونية."},
 {id:"leave", title:"الإجازات", body:"تسجل الإجازات السنوية والعارضة والمرضية والرسمية وغيرها وفق قانون العمل الساري، ومدة الخدمة، وطبيعة العمل، والمستندات والإجراءات المطلوبة."},
 {id:"financial", title:"الأجور والمزايا والاستقطاعات", body:"توضح دورة صرف الأجر ومكوناته والعمل الإضافي والحوافز والاستقطاعات القانونية والتأمينات ومواعيد التسوية، مع حفظ سجل لكل تعديل واعتماد."},
 {id:"safety", title:"السلامة والشكاوى", body:"تحدد إجراءات الإبلاغ عن المخاطر والحوادث، ومسؤوليات الإدارة والعاملين، وسرية الشكاوى وآلية التحقيق والتصعيد."},
];
function LaborLawPage() {
 const [employer,setEmployer]=useState("المختار");
 const [address,setAddress]=useState("");
 const [activity,setActivity]=useState("منشأة إدارية سكنية تجارية");
 const [reviewer,setReviewer]=useState("");
 const [notes,setNotes]=useState("");
 const print=()=>window.print();
 return <div dir="rtl" className="printable-area p-4 md:p-6 space-y-6"><div className="print-brand-header" dir="rtl"><img src="/al-mokhtar-mark.svg" alt="شعار المختار"/><div><strong>المختار</strong><span>لإدارة المشروعات</span></div></div>
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">قانون العمل واللوائح</h1><p className="text-sm text-muted-foreground mt-1">قسم الموارد البشرية — إعداد مسودة لوائح منشأة {employer}</p></div><Button onClick={print} className="gap-2 print:hidden"><Printer size={16}/> طباعة / حفظ PDF</Button></div>
  <Card><CardHeader><CardTitle>بيانات المنشأة والاعتماد</CardTitle><CardDescription>املأ بيانات المنشأة قبل تجهيز نسخة للمراجعة والتقديم للجهة المختصة عند اللزوم.</CardDescription></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
   <div className="space-y-2"><Label>اسم المنشأة</Label><Input value={employer} onChange={e=>setEmployer(e.target.value)}/></div>
   <div className="space-y-2"><Label>طبيعة النشاط</Label><Input value={activity} onChange={e=>setActivity(e.target.value)}/></div>
   <div className="space-y-2"><Label>العنوان ومقر العمل</Label><Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="العنوان الكامل"/></div>
   <div className="space-y-2"><Label>المسؤول عن المراجعة/الاعتماد</Label><Input value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="الاسم والصفة"/></div>
  </CardContent></Card>
  <div id="labor-law-print" className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Scale size={20}/> مشروع لائحة تنظيم العمل وشؤون العاملين</CardTitle><CardDescription>منشأة {employer} · {activity} · {address || "العنوان: يستكمل"}</CardDescription></CardHeader><CardContent className="space-y-5">
   <p className="text-sm">تهدف هذه المسودة إلى تنظيم علاقة العمل داخل المنشأة وفق قانون العمل المصري رقم 14 لسنة 2025 ولائحته التنفيذية والقرارات السارية، وقانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019، مع مراعاة أي قواعد خاصة تنطبق على المنشأة.</p>
   {sections.map((s,i)=><section key={s.id} className="border rounded-xl p-4 space-y-2"><h2 className="font-bold">{i+1}. {s.title}</h2><p className="text-sm leading-7">{s.body}</p></section>)}
   <div className="space-y-2"><Label>بنود خاصة بالمنشأة / ملاحظات للمراجعة القانونية</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="أضف تفاصيل المواعيد ونظام الورديات والإجازات والمزايا التي تحتاج مراجعة واعتمادًا."/></div>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 text-sm"><div>إعداد الموارد البشرية: ____________________</div><div>المراجعة/الاعتماد: {reviewer || "____________________"}</div><div>التاريخ: ____ / ____ / ______</div><div>التوقيع والختم: ____________________</div></div>
  </CardContent></Card></div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert size={18}/> مهم قبل الاعتماد</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><p>هذه مسودة تنظيمية قابلة للتحرير والطباعة، وليست نسخة حكومية معتمدة أو ضمانًا لمطابقة كل حالة قانونية. لا يمكن وصف لائحة بأنها «معتمدة» قبل استكمال بيانات المنشأة ومراجعتها مع مختص واتباع إجراءات الاعتماد/الإيداع التي يفرضها القانون.</p><a className="block underline text-primary" href="https://portal.eta.gov.eg/en/node/837" target="_blank" rel="noreferrer">مصدر التشريعات الرسمية المنشورة — قانون العمل رقم 14 لسنة 2025</a></CardContent></Card>
  <style>{`@media print { body * { visibility: hidden; } #labor-law-print, #labor-law-print * { visibility: visible; } #labor-law-print { position: absolute; inset: 0; width: 100%; } }`}</style>
 </div>;
}
