import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, Camera, CheckCircle2, MapPin, Send, User, Briefcase } from "lucide-react";
import { erpStore } from "@/shared/services/erpStore";

export const Route = createFileRoute("/maintenance-request")({
  head: () => ({ meta: [{ title: "بلاغ صيانة ذاتي — المختار" }] }),
  component: PublicMaintenanceRequestPage,
});

function PublicMaintenanceRequestPage() {
  const params = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);
  const facilityId = params.get("facilityId") || "";
  const subFacilityId = params.get("subFacilityId") || "";
  const initialLocation = params.get("location") || "";
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState(initialLocation);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة صالحًا.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة أكبر من 5 ميجابايت.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(typeof reader.result === "string" ? reader.result : "");
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const cleanName = name.trim();
    const cleanLocation = location.trim();
    const cleanDescription = description.trim();
    if (!cleanName || !cleanLocation || !cleanDescription) {
      setError("يرجى إدخال الاسم والموقع ووصف العطل.");
      return;
    }

    setSubmitting(true);
    try {
      const state = erpStore.getState() as any;
      const facilities = Array.isArray(state.maintenanceFacilities) ? state.maintenanceFacilities : [];
      const facility = facilities.find((item: any) => item.id === facilityId);
      const branchNodes = (nodes: any[], prefix = ""): { id: string; name: string }[] => {
        const result: { id: string; name: string }[] = [];
        for (const node of nodes || []) {
          const path = prefix ? `${prefix} > ${node.name}` : node.name;
          result.push({ id: node.id, name: path });
          result.push(...branchNodes(node.children || node.subFacilities || [], path));
        }
        return result;
      };
      const selectedBranch = facility && subFacilityId
        ? branchNodes(facility.subFacilities || []).find((branch) => branch.id === subFacilityId)
        : undefined;
      const resolvedLocation = facility
        ? selectedBranch ? `${facility.name} > ${selectedBranch.name}` : facility.name
        : cleanLocation;
      const currentOrders = Array.isArray(state.maintenanceWorkOrders) ? state.maintenanceWorkOrders : [];
      const nextOrderNumber = currentOrders.reduce(
        (highest: number, order: any) => Math.max(highest, Number(order.orderNumber) || 0),
        1000,
      ) + 1;
      const createdAt = new Date().toISOString();
      const order = {
        id: `maintenance-public-${Date.now()}`,
        orderNumber: nextOrderNumber,
        title: `بلاغ صيانة ذاتي من ${cleanName}`,
        description: cleanDescription,
        facilityId: facility?.id || "",
        subFacilityId: selectedBranch?.id || "",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        priority: "HIGH",
        status: "PENDING",
        assignedTo: [],
        maintenanceType: ["PUBLIC_REQUEST"],
        requiredParts: "",
        needsParts: false,
        laborCost: 0,
        partsCost: 0,
        createdBy: "PUBLIC_USER",
        createdAt,
        notes: [],
        image,
        isPublicRequest: true,
        publicRequesterName: cleanName,
        publicRequesterJobTitle: jobTitle.trim(),
        publicLocation: resolvedLocation || cleanLocation,
      };
      erpStore.state = { ...state, maintenanceWorkOrders: [...currentOrders, order] };
      erpStore.saveState();
      erpStore.logAction(
        "PUBLIC_USER",
        "استلام بلاغ صيانة ذاتي",
        `تم استلام بلاغ صيانة رقم #${nextOrderNumber} من ${cleanName} للموقع ${resolvedLocation || cleanLocation}`,
        "CREATE",
      );
      setSubmittedOrder(order);
    } catch (caught: any) {
      setError(caught?.message || "تعذر إرسال البلاغ. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedOrder) {
    return (
      <main dir="rtl" className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 size={34}/></div>
          <h1 className="text-2xl font-black">تم استلام بلاغ الصيانة</h1>
          <p className="text-sm text-muted-foreground">شكرًا لك {submittedOrder.publicRequesterName}، تم تسجيل البلاغ للموقع التالي:</p>
          <p className="rounded-xl bg-muted/40 p-3 font-bold">{submittedOrder.publicLocation}</p>
          <p className="text-lg font-black">رقم البلاغ: #{submittedOrder.orderNumber}</p>
          <p className="text-xs text-muted-foreground">احتفظ برقم البلاغ لمراجعته مع فريق الصيانة.</p>
          <button type="button" onClick={() => window.location.reload()} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">إرسال بلاغ آخر</button>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <header className="bg-primary px-6 py-8 text-center text-primary-foreground sm:px-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><AlertTriangle size={28}/></div>
          <h1 className="text-2xl font-black">بلاغ صيانة ذاتي</h1>
          <p className="mt-2 text-sm opacity-90">نموذج مختصر لإرسال عطل إلى فريق الصيانة</p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <MapPin className="ml-1 inline" size={15}/>
            {initialLocation ? "الموقع المحدد من رمز QR:" : "حدد موقع العطل:"}
            {initialLocation && <p className="mt-1 font-bold text-foreground">{initialLocation}</p>}
          </div>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">الاسم *</span>
            <span className="relative block"><User className="absolute right-3 top-3 text-muted-foreground" size={17}/><input className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-10" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} placeholder="اكتب اسمك"/></span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">الوظيفة / الصفة</span>
            <span className="relative block"><Briefcase className="absolute right-3 top-3 text-muted-foreground" size={17}/><input className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-10" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} maxLength={120} placeholder="موظف، زائر، مسؤول…"/></span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">موقع العطل *</span>
            <input className="w-full rounded-xl border border-input bg-background px-3 py-2.5" value={location} onChange={(event) => setLocation(event.target.value)} required maxLength={240} readOnly={!!initialLocation} placeholder="الدور أو الغرفة أو الموقع"/>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">وصف المشكلة *</span>
            <textarea className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2.5" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={4000} placeholder="اشرح العطل وما الذي حدث…"/>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-bold">صورة للمشكلة (اختياري)</span>
            <span className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground hover:bg-muted/40">
              <Camera size={20}/>{image ? "تم إرفاق الصورة — اضغط للتغيير" : "التقط صورة أو اختر ملفًا"}
              <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload}/>
            </span>
            {image && <img src={image} alt="معاينة صورة العطل" className="max-h-56 w-full rounded-xl border object-contain"/>}
          </label>
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-black text-primary-foreground disabled:opacity-60">
            <Send size={18}/>{submitting ? "جاري إرسال البلاغ…" : "إرسال البلاغ"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">لا تحتاج إلى حساب للدخول إلى نموذج البلاغ. ستُسجل الأولوية الأولية على أنها مرتفعة ليقوم الفريق بمراجعتها.</p>
        </form>
      </section>
    </main>
  );
}
