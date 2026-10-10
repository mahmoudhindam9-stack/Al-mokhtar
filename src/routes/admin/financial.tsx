// @ts-nocheck
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { erpStore, type Account } from "@/shared/services/erpStore";
import { useToast } from "@/hooks/use-toast";
import { useSettings, formatTreasuryCurrency } from "@/hooks/use-settings";
import { AccountsPage } from "./accounts";
import { LedgerPage } from "./ledger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TreasuryReportModal } from "@/components/admin/TreasuryReportModal";
import { printTreasuryMovementDocument } from "@/shared/utils/printAccountingDocument";
import {
  Wallet,
  FileText,
  Landmark,
  BookOpen,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  PlusCircle,
  ArrowLeftRight,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Coins,
  CreditCard,
  Building,
  Printer,
  Trash2,
  Lock,
  LockKeyholeOpen,
  Eye,
  FileSpreadsheet,
} from "lucide-react";

export const Route = createFileRoute("/admin/financial")({
  head: () => ({ meta: [{ title: "قسم الإدارة المالية - المحاسبة والخزائن والقيود" }] }),
  component: FinancialManagementPage,
});

export function FinancialManagementPage() {
  const { toast } = useToast();
  const { formatPrice } = useSettings();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "vouchers_entry";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [erpState, setErpState] = useState(erpStore.getState());
  const currentBranch = erpStore.getCurrentBranch();

  useEffect(() => {
    setErpState(erpStore.getState());
    const unsub = erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (searchParams.get("tab")) {
      setActiveTab(searchParams.get("tab")!);
    }
  }, [location.search]);

  // Vouchers form state
  const [voucherForm, setVoucherForm] = useState({
    type: "payment" as "receipt" | "payment",
    category: "رواتب الموظفين",
    amount: "",
    treasury_id: "",
    description: "",
    cost_center: "الإدارة (Administration)",
  });

  // Treasury Actions state
  const [treasuryForm, setTreasuryForm] = useState({
    actionType: "deposit" as "deposit" | "withdrawal" | "transfer",
    treasury_id: "",
    target_treasury_id: "",
    amount: "",
    description: "",
    reference_no: "",
  });

  const [newTreasuryForm, setNewTreasuryForm] = useState({
    name_ar: "",
    type: "cash" as "cash" | "bank" | "pos" | "petty_cash",
    balance: "",
    account_code: "",
    bank_name: "",
    account_number: "",
    iban: "",
  });

  const [treasuryToDelete, setTreasuryToDelete] = useState<any>(null);
  const [isProcessingTreasuryAction, setIsProcessingTreasuryAction] = useState(false);
  const [selectedTreasuryForReport, setSelectedTreasuryForReport] = useState<any>(null);

  // Voucher submission
  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherForm.amount || Number(voucherForm.amount) <= 0) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى إدخال مبلغ صحيح للسند",
        variant: "destructive",
      });
      return;
    }

    try {
      const isPayment = voucherForm.type === "payment";
      let accountCode = isPayment ? "5101" : "4101";

      if (voucherForm.category.includes("رواتب")) accountCode = "5101";
      else if (voucherForm.category.includes("إيجار")) accountCode = "5102";
      else if (voucherForm.category.includes("مشتريات")) accountCode = "1301";
      else if (voucherForm.category.includes("كهرباء")) accountCode = "5103";
      else if (voucherForm.category.includes("صيانة")) accountCode = "5104";

      const created = erpStore.addVoucher({
        type: voucherForm.type,
        category: voucherForm.category,
        amount: Number(voucherForm.amount),
        treasury_id: voucherForm.treasury_id || undefined,
        description: voucherForm.description || "سند مالى يدوي",
        cost_center: voucherForm.cost_center,
        account_code: accountCode,
      });

      setErpState(erpStore.getState());
      setVoucherForm({
        type: "payment",
        category: "رواتب الموظفين",
        amount: "",
        treasury_id: "",
        description: "",
        cost_center: "الإدارة (Administration)",
      });

      toast({
        title: "✅ تم تسجيل السند بنجاح",
        description: `سند رقم ${created.voucher_number} بمبلغ ${created.amount.toLocaleString()} ج.م وخصمه/إضافته للخزينة تلقائياً.`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ في التنفيذ",
        description: error.message || "فشلت عملية إنشاء السند",
        variant: "destructive",
      });
    }
  };

  // Treasury action submission
  const handleTreasuryActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treasuryForm.treasury_id || !treasuryForm.amount || Number(treasuryForm.amount) <= 0) {
      toast({
        title: "بيانات غير مكتملة",
        description: "يرجى اختيار الخزينة وإدخال مبلغ أكبر من الصفر",
        variant: "destructive",
      });
      return;
    }

    if (
      treasuryForm.actionType === "transfer" &&
      (!treasuryForm.target_treasury_id ||
        treasuryForm.treasury_id === treasuryForm.target_treasury_id)
    ) {
      toast({
        title: "خطأ في التحويل",
        description: "يرجى اختيار خزينة مستهدفة مختلفة للتحويل",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessingTreasuryAction(true);
      if (treasuryForm.actionType === "deposit") {
        erpStore.depositToTreasury(
          treasuryForm.treasury_id,
          Number(treasuryForm.amount),
          treasuryForm.description || "إيداع نقدي مباشر",
          treasuryForm.reference_no,
        );
      } else if (treasuryForm.actionType === "withdrawal") {
        erpStore.withdrawFromTreasury(
          treasuryForm.treasury_id,
          Number(treasuryForm.amount),
          treasuryForm.description || "سحب نقدي مباشر",
          treasuryForm.reference_no,
        );
      } else if (treasuryForm.actionType === "transfer") {
        erpStore.transferBetweenTreasuries(
          treasuryForm.treasury_id,
          treasuryForm.target_treasury_id,
          Number(treasuryForm.amount),
          treasuryForm.description || "تحويل نقدي بين الخزائن",
          treasuryForm.reference_no,
        );
      }

      setErpState(erpStore.getState());
      setTreasuryForm({
        actionType: "deposit",
        treasury_id: "",
        target_treasury_id: "",
        amount: "",
        description: "",
        reference_no: "",
      });

      toast({
        title: "✅ تمت الحركة المالية بنجاح",
        description: "تم تحديث رصيد الخزائن وإنشاء قيد محاسبي آلي وتوثيق الحركة بنجاح.",
      });
    } catch (error: any) {
      toast({
        title: "فشلت الحركة",
        description: error.message || "حدث خطأ أثناء إجراء الحركة المالية",
        variant: "destructive",
      });
    } finally {
      setIsProcessingTreasuryAction(false);
    }
  };

  // Create new treasury
  const handleCreateTreasury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreasuryForm.name_ar) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم الخزينة أو الحساب البنكي",
        variant: "destructive",
      });
      return;
    }

    try {
      erpStore.addTreasury({
        name_ar: newTreasuryForm.name_ar,
        type: newTreasuryForm.type,
        balance: Number(newTreasuryForm.balance) || 0,
        account_code: newTreasuryForm.account_code || undefined,
        bank_name: newTreasuryForm.bank_name || undefined,
        account_number: newTreasuryForm.account_number || undefined,
        iban: newTreasuryForm.iban || undefined,
        currency: "EGP",
      });

      setErpState(erpStore.getState());
      setNewTreasuryForm({
        name_ar: "",
        type: "cash",
        balance: "",
        account_code: "",
        bank_name: "",
        account_number: "",
        iban: "",
      });

      toast({
        title: "✅ تم إضافة الخزينة",
        description: "تم إضافة الخزينة/الحساب الربط بدليل الحسابات بنجاح.",
      });
    } catch (error: any) {
      toast({
        title: "خطأ في الإنشاء",
        description: error.message || "لم نتمكن من إضافة الخزينة",
        variant: "destructive",
      });
    }
  };

  // Delete treasury
  const confirmDeleteTreasury = (id: string) => {
    try {
      const tr = treasuryToDelete;
      erpStore.deleteTreasury(id);
      setErpState(erpStore.getState());
      toast({
        title: "✅ تم حذف الخزينة بنجاح",
        description: `تم إزالة الخزينة "${tr?.name_ar || ""}" وتحديث دليل الحسابات بنجاح.`,
      });
      setTreasuryToDelete(null);
    } catch (error: any) {
      toast({
        title: "❌ لا يمكن حذف الخزينة",
        description: error.message || "فشلت عملية الحذف.",
        variant: "destructive",
      });
    }
  };

  const totalTreasuryEgp = useMemo(() => {
    return erpState.treasuries.reduce((sum, t) => sum + (t.balance || 0), 0);
  }, [erpState.treasuries]);

  return (
    <div className="space-y-6 pb-12 text-right">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="text-primary" size={32} />
            قسم الإدارة المالية والمحاسبة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة شاملة لسندات القبض والصرف، الخزائن والحسابات البنكية، شجرة الحسابات وحساب الأستاذ
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card p-3 rounded-2xl border border-border shadow-sm">
          <Wallet className="text-emerald-600" size={24} />
          <div>
            <span className="text-xs text-muted-foreground block font-bold">
              إجمالي السيولة النقدية:
            </span>
            <span className="text-lg font-black text-emerald-600">
              {totalTreasuryEgp.toLocaleString()} ج.م
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="vouchers_entry" className="rounded-lg font-bold py-2.5 px-4">
            <FileText size={16} className="ml-1.5 inline" />
            تسجيل سندات الإيراد والمصروف
          </TabsTrigger>
          <TabsTrigger value="treasury" className="rounded-lg font-bold py-2.5 px-4">
            <Wallet size={16} className="ml-1.5 inline" />
            إدارة الخزائن والحسابات البنكية
          </TabsTrigger>
          <TabsTrigger value="accounts" className="rounded-lg font-bold py-2.5 px-4">
            <Landmark size={16} className="ml-1.5 inline" />
            إدارة الحسابات
          </TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-lg font-bold py-2.5 px-4">
            <BookOpen size={16} className="ml-1.5 inline" />
            حساب الأستاذ والقيود
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: VOUCHERS ENTRY */}
        <TabsContent value="vouchers_entry" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Voucher Form */}
            <div className="lg:col-span-1 bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
              <h3 className="font-black text-base text-primary flex items-center gap-2">
                <PlusCircle size={20} />
                تسجيل سند مالي جديد
              </h3>
              <form onSubmit={handleVoucherSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs font-bold block mb-1">نوع السند *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={voucherForm.type === "payment" ? "default" : "outline"}
                      onClick={() => setVoucherForm({ ...voucherForm, type: "payment" })}
                      className="rounded-xl font-bold text-xs py-2"
                    >
                      سند صرف (مصروف)
                    </Button>
                    <Button
                      type="button"
                      variant={voucherForm.type === "receipt" ? "default" : "outline"}
                      onClick={() => setVoucherForm({ ...voucherForm, type: "receipt" })}
                      className="rounded-xl font-bold text-xs py-2"
                    >
                      سند قبض (إيراد)
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">التصنيف الرئيسي *</Label>
                  <select
                    value={voucherForm.category}
                    onChange={(e) => setVoucherForm({ ...voucherForm, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold"
                  >
                    {voucherForm.type === "payment" ? (
                      <>
                        <option value="رواتب الموظفين">رواتب الموظفين والأجور</option>
                        <option value="إيجار مقرات ومخازن">إيجار مقرات ومخازن</option>
                        <option value="كهرباء ومرافق ومياه">كهرباء ومرافق ومياه</option>
                        <option value="صيانة ومستلزمات تشغيل">صيانة ومستلزمات تشغيل</option>
                        <option value="مشتريات بضائع وخامات">مشتريات بضائع وخامات</option>
                        <option value="مصاريف نثرية وإدارية">مصاريف نثرية وإدارية</option>
                      </>
                    ) : (
                      <>
                        <option value="مبيعات نقدية ميكس">مبيعات نقدية ميكس</option>
                        <option value="تحصيل من عملاء ومؤجرين">تحصيل من عملاء ومؤجرين</option>
                        <option value="إيرادات خدمات وإيجارات">إيرادات خدمات وإيجارات</option>
                        <option value="إيرادات متنوعة أخري">إيرادات متنوعة أخري</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">المبلغ (ج.م) *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={voucherForm.amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })}
                    className="rounded-xl font-bold text-lg"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">الخزينة / الحساب المتأثر *</Label>
                  <select
                    value={voucherForm.treasury_id}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, treasury_id: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold"
                  >
                    <option value="">اختر الخزينة (تلقائي: الخزينة الرئيسية)</option>
                    {erpState.treasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar} (الرصيد: {t.balance?.toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">البيان / الشرح *</Label>
                  <Input
                    placeholder="مثال: صرف جزء من راتب الموظف..."
                    value={voucherForm.description}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, description: e.target.value })
                    }
                    className="rounded-xl text-sm font-bold"
                  />
                </div>

                <Button type="submit" className="w-full font-bold rounded-xl py-5 gap-2">
                  <CheckCircle size={18} />
                  حفظ السند والترحيل المحاسبي
                </Button>
              </form>
            </div>

            {/* Vouchers Log Table */}
            <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-foreground">
                  سجل السندات المالية المرحّلة
                </h3>
                <Badge variant="outline" className="font-bold">
                  {erpState.vouchers?.length || 0} سندات
                </Badge>
              </div>

              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-muted text-xs font-black border-b border-border">
                    <tr>
                      <th className="p-3">رقم السند</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">البيان</th>
                      <th className="p-3">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-bold">
                    {erpState.vouchers && erpState.vouchers.length > 0 ? (
                      erpState.vouchers.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-mono text-xs">{v.voucher_number}</td>
                          <td className="p-3">
                            <Badge
                              variant={v.type === "receipt" ? "default" : "destructive"}
                              className="text-[10px] font-bold"
                            >
                              {v.type === "receipt" ? "قبض" : "صرف"}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">{v.category}</td>
                          <td className="p-3 text-sm font-black text-primary">
                            {v.amount?.toLocaleString()} ج.م
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{v.description}</td>
                          <td className="p-3 text-[11px] text-muted-foreground">
                            {v.created_at
                              ? new Date(v.created_at).toLocaleDateString("ar-EG")
                              : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground font-bold"
                        >
                          لا توجد سندات مالية مسجلة حالياً
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: TREASURY MANAGEMENT */}
        <TabsContent value="treasury" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Financial Movements Form */}
            <div className="lg:col-span-1 bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
              <h3 className="font-black text-base text-primary flex items-center gap-2">
                <ArrowLeftRight size={20} />
                إجراء حركة مالية على الخزينة
              </h3>
              <form onSubmit={handleTreasuryActionSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs font-bold block mb-1">نوع الحركة *</Label>
                  <select
                    value={treasuryForm.actionType}
                    onChange={(e) =>
                      setTreasuryForm({
                        ...treasuryForm,
                        actionType: e.target.value as any,
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold"
                  >
                    <option value="deposit">إيداع نقدي (إيراد/تحصيل)</option>
                    <option value="withdrawal">سحب نقدي (مصروف/مصاريف)</option>
                    <option value="transfer">تحويل بين الخزائن والحسابات</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">
                    الخزينة المصدر / الرئيسية *
                  </Label>
                  <select
                    value={treasuryForm.treasury_id}
                    onChange={(e) =>
                      setTreasuryForm({ ...treasuryForm, treasury_id: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold"
                    required
                  >
                    <option value="">اختر الخزينة...</option>
                    {erpState.treasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar} ({t.balance?.toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                {treasuryForm.actionType === "transfer" && (
                  <div>
                    <Label className="text-xs font-bold block mb-1">
                      الخزينة المستهدفة للتحويل *
                    </Label>
                    <select
                      value={treasuryForm.target_treasury_id}
                      onChange={(e) =>
                        setTreasuryForm({
                          ...treasuryForm,
                          target_treasury_id: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold"
                      required
                    >
                      <option value="">اختر الخزينة المستلمة...</option>
                      {erpState.treasuries.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name_ar} ({t.balance?.toLocaleString()} ج.م)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-bold block mb-1">المبلغ (ج.م) *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={treasuryForm.amount}
                    onChange={(e) => setTreasuryForm({ ...treasuryForm, amount: e.target.value })}
                    className="rounded-xl font-bold text-lg"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold block mb-1">سبب / بيان الحركة *</Label>
                  <Input
                    placeholder="مثال: تحويل سيولة للمشتروات..."
                    value={treasuryForm.description}
                    onChange={(e) =>
                      setTreasuryForm({ ...treasuryForm, description: e.target.value })
                    }
                    className="rounded-xl text-sm font-bold"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isProcessingTreasuryAction}
                  className="w-full font-bold rounded-xl py-5 gap-2"
                >
                  <CheckCircle size={18} />
                  تنفيذ الحركة المالية
                </Button>
              </form>
            </div>

            {/* Treasuries List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-foreground">
                  قائمة الخزائن والحسابات البنكية
                </h3>
                <Badge variant="outline" className="font-bold">
                  {erpState.treasuries.length} حسابات
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {erpState.treasuries.map((t) => (
                  <Card
                    key={t.id}
                    className="rounded-2xl border-border shadow-sm hover:border-primary/50 transition-all"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={t.type === "bank" ? "secondary" : "default"}
                          className="text-[10px] font-bold"
                        >
                          {t.type === "bank" ? "حساب بنكي" : "خزينة نقدية"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDeleteTreasury(t.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <CardTitle className="text-base font-black mt-2">{t.name_ar}</CardTitle>
                      <CardDescription className="text-xs font-mono">
                        كود الحساب: {t.account_code || "1101"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="bg-muted/50 p-3 rounded-xl mt-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">
                          الرصيد الحالي:
                        </span>
                        <span className="text-lg font-black text-emerald-600">
                          {t.balance?.toLocaleString()} ج.م
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Create new treasury card */}
              <Card className="rounded-2xl border border-dashed border-border p-5 bg-card/50">
                <h4 className="font-black text-sm text-primary mb-3 flex items-center gap-2">
                  <Plus size={18} />
                  إضافة خزينة أو حساب بنكي جديد
                </h4>
                <form
                  onSubmit={handleCreateTreasury}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <div>
                    <Label className="text-xs font-bold mb-1 block">اسم الخزينة/البنك *</Label>
                    <Input
                      placeholder="مثال: البنك الأهلي المصري"
                      value={newTreasuryForm.name_ar}
                      onChange={(e) =>
                        setNewTreasuryForm({ ...newTreasuryForm, name_ar: e.target.value })
                      }
                      className="rounded-xl text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold mb-1 block">النوع *</Label>
                    <select
                      value={newTreasuryForm.type}
                      onChange={(e) =>
                        setNewTreasuryForm({ ...newTreasuryForm, type: e.target.value as any })
                      }
                      className="w-full h-9 px-2 rounded-xl border border-input bg-background text-xs font-bold"
                    >
                      <option value="cash">خزينة نقدية</option>
                      <option value="bank">حساب بنكي</option>
                      <option value="pos">عُهدة / POS</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold mb-1 block">الرصيد الافتتاحي (ج.م)</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newTreasuryForm.balance}
                      onChange={(e) =>
                        setNewTreasuryForm({ ...newTreasuryForm, balance: e.target.value })
                      }
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-3 text-left pt-2">
                    <Button type="submit" size="sm" className="font-bold rounded-xl gap-1">
                      <Plus size={16} />
                      حفظ الخزينة الجديدة
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: ACCOUNTS MANAGEMENT */}
        <TabsContent value="accounts" className="space-y-6 mt-4">
          <AccountsPage />
        </TabsContent>

        {/* TAB 4: GENERAL LEDGER */}
        <TabsContent value="ledger" className="space-y-6 mt-4">
          <LedgerPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
