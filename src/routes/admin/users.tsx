// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Trash2,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Users as UsersIcon,
  Save,
  Undo2,
} from "lucide-react";
import { erpStore, UserPermission, SystemUser } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "المستخدمين والصلاحيات" }] }),
  component: UsersPage,
});

const roleLabels: Record<string, string> = {
  super_admin: "المدير العام (Super Admin) - كامل الصلاحيات",
  admin: "مدير المشروع / مدير النظام",
  manager: "مشرف / محاسب مالي",
  cashier: "كاشير نقاط البيع والتحصيل",
  captain: "مشرف عمليات ميداني",
  kitchen: "أمين تشغيل ومستودع",
};

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function profileToSystemUser(profile: any): SystemUser {
  return {
    id: profile.id,
    full_name: profile.full_name || profile.username || "",
    username: profile.username || String(profile.email || "").split("@")[0],
    phone: profile.phone || "",
    role: profile.role || "cashier",
    permissions: (profile.permissions || {}) as UserPermission,
    created_at: profile.created_at || new Date().toISOString(),
  };
}

interface PermissionItem {
  key: keyof UserPermission;
  name: string;
  desc: string;
  isSuperAdminOnly?: boolean;
}

interface PermissionCategory {
  id: string;
  name: string;
  desc: string;
  permissions: PermissionItem[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "orders_sales",
    name: "1. الطلبات والمبيعات (Orders & Sales)",
    desc: "التحكم في فواتير الصالة، سجلات المبيعات، والعربات ورموز الاستجابة السريعة",
    permissions: [
      {
        key: "orders",
        name: "الوصول الأساسي للطلبات",
        desc: "صلاحية فتح واستعراض شاشة الطلبات والمبيعات",
      },
      {
        key: "orders_view",
        name: "استعراض سجل الطلبات والفواتير",
        desc: "البحث في الفواتير المكتملة والمعلقة وتفاصيلها",
      },
      {
        key: "orders_create_custom",
        name: "إنشاء طلب مخصص / طلب جديد",
        desc: "إمكانية إنشاء فواتير جديدة وطلبات مخصصة",
      },
      {
        key: "orders_cancel_modify",
        name: "تعديل وإلغاء الطلبات",
        desc: "إمكانية إلغاء أو تعديل الطلبات والفواتير بعد تسجيلها",
      },
      {
        key: "orders_manage_carts",
        name: "إضافة وإدارة عربات وسلات الطلب",
        desc: "التحكم في عربات التسوق المعلقة للزبائن وحفظها",
      },
      {
        key: "orders_generate_qr",
        name: "توليد وطباعة QR Code للطلبات",
        desc: "توليد باركود ورموز QR للطاولات والفواتير الرقمية",
      },
    ],
  },
  {
    id: "pos_section",
    name: "2. نقطة البيع السريعة (Point of Sale - POS)",
    desc: "صلاحيات الكاشير، بيع الأصناف، الخصومات وحذف البنود",
    permissions: [
      {
        key: "pos",
        name: "الوصول لشاشة نقطة البيع (POS)",
        desc: "تمكين فتح شاشة الكاشير والبيع السريع",
      },
      {
        key: "pos_access",
        name: "تسجيل فواتير الكاشير المباشرة",
        desc: "إتمام عمليات البيع وإصدار إيصالات الدفع",
      },
      {
        key: "pos_create_custom_order",
        name: "إنشاء طلب مخصص / تعديل بنود فورية",
        desc: "إضافة أصناف حرة أو تعديل أسعار الأصناف يدوياً بالطلب",
      },
      {
        key: "pos_apply_discounts",
        name: "تطبيق الخصومات والكوبونات المالية",
        desc: "منح خصم مالي أو نسبة مئوية على إجمالي الفاتورة",
      },
      {
        key: "pos_void_items",
        name: "إلغاء وحذف عناصر من الفاتورة الحالية",
        desc: "حذف بند تم اختياره من الفاتورة قبل إتمام الدفع",
      },
    ],
  },
  {
    id: "delivery_section",
    name: "5. طلبات التوصيل الخارجي (Delivery Management)",
    desc: "توزيع وتعيين السائقين، تتبع خطوط السير وتأكيد التحصيل",
    permissions: [
      {
        key: "delivery",
        name: "الوصول لشاشة التوصيل الخارجي",
        desc: "فتح لوحة إدارة ومتابعة الطلبات الخارجية",
      },
      {
        key: "delivery_view",
        name: "استعراض طلبات الدليفري المعلقة والمنفذة",
        desc: "مشاهدة بيانات الزبائن وعناوين وأوقات التوصيل",
      },
      {
        key: "delivery_update_status",
        name: "تعيين السائق وتحديث حالة ومسار التوصيل",
        desc: "إسناد الطلب لكابتن التوصيل وتأكيد تحصيل المبالغ",
      },
    ],
  },
  {
    id: "inventory_section",
    name: "6. المخزون والمستودعات (Inventory & Warehouses)",
    desc: "أرصدة الأصناف، الجرد الدوري، التحويلات المخزنية وإتلاف التوالف",
    permissions: [
      {
        key: "inventory",
        name: "الوصول لإدارة المخزون",
        desc: "فتح شاشة المخازن وكروت الأصناف",
      },
      {
        key: "inventory_view",
        name: "استعراض كروت الأصناف والأرصدة الحالية",
        desc: "الاطلاع على مستويات المخزون وحد إعادة الطلب",
      },
      {
        key: "inventory_adjust_transfer",
        name: "تسجيل التحويلات الإذنية وتسوية الفوارق",
        desc: "تحويل الخامات بين المخزن الرئيسي والمطبخ/الفرع",
      },
      {
        key: "inventory_waste_dispose",
        name: "تسجيل توالف وهوالك المخزن والمطبخ",
        desc: "إثبات الهدر وإتلاف الخامات المنتهية الصلاحية محاسبياً",
      },
    ],
  },
  {
    id: "purchasing_section",
    name: "7. المشتريات والموردين (Purchasing & Suppliers)",
    desc: "تسجيل فواتير الشراء، حسابات الموردين، وإرجاع البضائع",
    permissions: [
      {
        key: "purchasing",
        name: "الوصول لإدارة المشتريات",
        desc: "فتح شاشة الموردين وفواتير الشراء الواردة",
      },
      {
        key: "purchasing_view",
        name: "استعراض فواتير وحسابات الموردين",
        desc: "مشاهدة كشوف حسابات الموردين والمستحقات",
      },
      {
        key: "purchasing_add_invoice",
        name: "إضافة واعتماد فواتير شراء جديدة",
        desc: "إدخال فواتير مشتريات وتحديث تكاليف وأرصدة المخزون",
      },
      {
        key: "purchasing_returns",
        name: "تسجيل المرتجعات والتسويات للموردين",
        desc: "إثبات مرتجع مشتريات وخصم قيمتها من رصيد المورد",
      },
    ],
  },
  {
    id: "production_section",
    name: "8. الإنتاج والتصنيع (Production & Recipes)",
    desc: "بطاقات الوصفات ومعايير الطهي وتكاليف التصنيع",
    permissions: [
      {
        key: "production",
        name: "الوصول لإدارة الإنتاج والتصنيع",
        desc: "فتح شاشة بطاقات الوصفات وأوامر التشغيل",
      },
      {
        key: "production_view",
        name: "استعراض بطاقات الوصفات (Recipes) والتكاليف",
        desc: "مشاهدة نسب المكونات وتكلفة إنتاج كل طبق",
      },
      {
        key: "production_execute",
        name: "تشغيل وتأكيد أوامر التصنيع والخلطات",
        desc: "خصم الخامات المجمعة وإضافة المنتج التام للمخزن",
      },
    ],
  },
  {
    id: "hr_section",
    name: "9. الموارد البشرية وشؤون الموظفين (HR & Payroll)",
    desc: "ملفات الموظفين، سجل الحضور، السلف والرواتب الشهرية",
    permissions: [
      {
        key: "hr",
        name: "الوصول لنظام الموارد البشرية",
        desc: "فتح شاشة الموظفين والرواتب",
      },
      {
        key: "hr_view_attendance",
        name: "إدارة بيانات الموظفين وسجلات الحضور والغياب",
        desc: "تسجيل الحضور والإنصراف وتحديث الملفات",
      },
      {
        key: "hr_manage_payroll_loans",
        name: "احتساب واعتماد مسيرات الرواتب والسلف والخصومات",
        desc: "إصدار مسيرات الرواتب الشهرية وخصم السلف تلقائياً",
      },
      {
        key: "hr_request_advance",
        name: "تقديم طلب سلفة مالية",
        desc: "إمكانية الموظف لطلب سلفة مالية وتحديد الأقساط",
      },
      {
        key: "hr_request_vacation",
        name: "تقديم طلب أجازة",
        desc: "إمكانية الموظف لتقديم طلب أجازة وتحديد الأيام",
      },
      {
        key: "hr_approve_reject_requests",
        name: "البت والقبول/الرفض لطلبات السلف والأجازات",
        desc: "صلاحية المدير المسؤول للقبول أو الرفض على الطلبات",
      },
      {
        key: "notifications_access",
        name: "الوصول لشريط التنبيهات والإشعارات",
        desc: "مشاهدة أرقام وتفاصيل التنبيهات في أعلى الشاشة",
      },
    ],
  },
  {
    id: "treasury_section",
    name: "10. الخزائن والبنوك (Treasury & Cash Management)",
    desc: "إدارة الخزائن، فتح وإغلاق الفترات، والتحويل والتسوية الجردية",
    permissions: [
      {
        key: "treasury",
        name: "الوصول لإدارة الخزائن والبنوك",
        desc: "فتح شاشة الخزائن النقدية والحسابات البنكية",
      },
      {
        key: "treasury_view",
        name: "استعراض الأرصدة وحركات الخزائن والبنوك",
        desc: "متابعة السيولة النقدية والرصيد الفعلي لكل عملة",
      },
      {
        key: "treasury_open_close",
        name: "فتح وإغلاق الفترات اليومية للخزينة",
        desc: "إتمام عمليات الإغلاق اليومي واستلام وتسليم العهد",
      },
      {
        key: "treasury_transfer_reconcile",
        name: "إجراء التسويات والتحويلات اليدوية بين الخزائن",
        desc: "تحويل أموال بين الخزائن أو تسجيل تسوية عجز/فائض",
      },
    ],
  },
  {
    id: "accounting_section",
    name: "11. الحسابات العامة ودفتر الأستاذ (Accounting & GL)",
    desc: "شجرة الحسابات، قيود اليومية المزدوجة، وقفل الفترات المالية",
    permissions: [
      {
        key: "accounting",
        name: "الوصول للنظام المحاسبي العام",
        desc: "فتح شجرة الحسابات ودفتر الأستاذ العام",
      },
      {
        key: "accounting_view",
        name: "استعراض الدليل المحاسبي وميزان المراجعة والأستاذ",
        desc: "الاطلاع على كشوف الحسابات وموازين المراجعة",
      },
      {
        key: "accounting_post_journal",
        name: "إنشاء وترحيل قيود اليومية المزدوجة اليدوية",
        desc: "إدخال القيود المزدوجة وترحيلها لدفتر اليومية",
      },
      {
        key: "accounting_lock_period",
        name: "قفل وفك قفل الفترات والسنة المالية",
        desc: "حماية القيود من التعديل وإغلاق السنة المالية",
      },
    ],
  },
  {
    id: "approvals_section",
    name: "12. اعتماد السندات والرقابة المالية (Approvals & Auditing)",
    desc: "اعتماد قيود اليومية وسندات الصرف والقبض ومراكز التكلفة",
    permissions: [
      {
        key: "journal_approval",
        name: "اعتماد وترحيل قيود اليومية",
        desc: "الموافقة على القيود التلقائية واليدوية وترحيلها النهائي",
      },
      {
        key: "expense_approval",
        name: "اعتماد سندات الصرف والمصروفات",
        desc: "مراجعة ودراسة مستندات الصرف واعتماد المصروفات بالفروع",
      },
      {
        key: "revenue_approval",
        name: "اعتماد سندات القبض والإيرادات",
        desc: "اعتماد استلام الإيرادات المتنوعة ومبيعات الهدر",
      },
      {
        key: "cost_centers",
        name: "إدارة مراكز التكلفة وتحليل الربحية",
        desc: "توزيع السندات وتحليل ربحية قطاعات المطبخ والبار",
      },
    ],
  },
  {
    id: "mall_section",
    name: "13. إدارة المول والوحدات (Mall & Units Management)",
    desc: "عقود إيجار وتمليك الوحدات والمحلات، تحصيل الإيجارات والمصروفات التشغيلية",
    permissions: [
      {
        key: "mall_manage_shops",
        name: "إدارة المحلات وعقود الإيجار والتحصيل",
        desc: "تسجيل وتعديل عقود الإيجار وإثبات تحصيل الإيجارات",
      },
      {
        key: "mall_garden_finance",
        name: "تسجيل إيرادات ومصروفات الحديقة الترفيهية",
        desc: "إثبات تذاكر وإيرادات الألعاب ومصروفات التشغيل",
      },
    ],
  },
  {
    id: "reports_section",
    name: "14. التقارير والقوائم المالية (Reports & Analytics)",
    desc: "تقارير المبيعات، قائمة الدخل، الميزانية العمومية والتدفقات النقدية",
    permissions: [
      {
        key: "reports",
        name: "الوصول لمنظومة التقارير",
        desc: "فتح شاشة التقارير والتحليلات الإحصائية",
      },
      {
        key: "reports_view_sales",
        name: "استعراض تقارير المبيعات والأرباح والتشغيل",
        desc: "متابعة المبيعات اليومية والشهرية وأعلى الأصناف مبيعاً",
      },
      {
        key: "reports_view_financials",
        name: "استعراض القوائم المالية والميزانية وقائمة الدخل",
        desc: "الاطلاع على المركز المالي وقائمة الأرباح والخسائر",
      },
    ],
  },
  {
    id: "super_admin_section",
    name: "15. صلاحيات المدير العام والسيستم (Super Admin & System)",
    desc: "الصلاحية الكاملة الشاملة، إدارة المستخدمين، النسخ الاحتياطي، وسجل الأمان",
    permissions: [
      {
        key: "super_admin_full_access",
        name: "صلاحية المدير العام الكاملة (Super Admin Full Override)",
        desc: "تجاوز كامل لكافة القيود وإتاحة الوصول غير المقيد لجميع شاشات النظام",
        isSuperAdminOnly: true,
      },
      {
        key: "users_roles",
        name: "الوصول لإدارة المستخدمين والصلاحيات",
        desc: "فتح صفحة المستخدمين وتعديل الحسابات",
      },
      {
        key: "system_manage_users",
        name: "إضافة وتعديل حسابات المستخدمين وتخصيص جدول الصلاحيات",
        desc: "إنشاء المستخدمين الجدد وتعديل كلمات المرور والصلاحيات",
      },
      {
        key: "branch_mgmt",
        name: "إعدادات الفروع وإعدادات المؤسسة الأساسية",
        desc: "إنشاء الفروع وتحديث بيانات الشركة وبيانات الترخيص",
      },
      {
        key: "developer_options",
        name: "خيارات المطور وتحديث النظام",
        desc: "تحديث الأكواد، مزامنة البيانات، وإدارة حركة أكسس",
        isSuperAdminOnly: true,
      },
      {
        key: "system_backup_update",
        name: "النسخ الاحتياطي واستيراد البيانات",
        desc: "تصدير قواعد البيانات، استيراد بيانات Oracle/Access وتصفير السيستم",
      },
      {
        key: "audit_logs",
        name: "سجل العمليات الأمني المتقدم (Audit Logs)",
        desc: "استعراض وتدقيق سجل المراقبة لكشف التلاعب وتتبع كافة الأنشطة",
      },
      {
        key: "system_audit_logs",
        name: "تفريغ وتصدير سجلات الرقابة الأمنية",
        desc: "تصدير تقارير الرقابة الجنائية والتحقيق في الحركات المالية",
      },
    ],
  },
  {
    id: "park_tickets",
    name: "12. إدارة الحديقة والمول التجاري",
    desc: "إدارة ورديات التذاكر، الخزائن، والتحكم في إغلاقات الحديقة",
    permissions: [
      {
        key: "manage_park_shifts",
        name: "الدخول وإدارة الورديات المفتوحة",
        desc: "صلاحية استعراض الورديات المعلقة للحديقة وتعديلها أو دخولها كمدير",
      },
      {
        key: "delete_park_shifts",
        name: "حذف وإلغاء ورديات الحديقة المعلقة",
        desc: "صلاحية الحذف النهائي لأي وردية معلقة في النظام",
      },
      {
        key: "park_reports",
        name: "استعراض الإيرادات وتقارير الإغلاق للحديقة",
        desc: "استعراض كل القيود المحاسبية، فواتير التذاكر والورديات المغلقة",
      },
    ],
  },
  {
    id: "maintenance_section",
    name: "16. قسم الصيانة (Maintenance)",
    desc: "الرئيسية وطلبات الصيانة والصيانة الدورية والعهد وربط مصروفات الصيانة",
    permissions: [
      {
        key: "maintenance_view",
        name: "عرض قسم الصيانة",
        desc: "فتح لوحة الصيانة ومشاهدة الطلبات وخريطة المباني والتقارير",
      },
      {
        key: "maintenance_manage_requests",
        name: "إدارة طلبات الصيانة",
        desc: "إنشاء وتعديل وإلغاء طلبات الصيانة وتعيين المسؤولين",
      },
      {
        key: "maintenance_manage_preventive",
        name: "إدارة الصيانة الدورية",
        desc: "إنشاء وتعديل وجدولة مهام الصيانة الدورية وإتمامها",
      },
      {
        key: "maintenance_manage_custody",
        name: "إدارة العهد",
        desc: "تسجيل العهد وتسليمها واستردادها وربطها بالموظفين والمخزون",
      },
      {
        key: "maintenance_post_finance",
        name: "ترحيل مصروفات الصيانة للمالية",
        desc: "إنشاء سند صرف وقيد مالي مرتبط بتكلفة طلب الصيانة",
      },
      {
        key: "maintenance_manage_buildings",
        name: "إدارة خريطة المباني",
        desc: "تعديل أسماء المباني وإضافة مبانٍ أو حذفها",
      },
      {
        key: "maintenance_export_reports",
        name: "تصدير تقارير الصيانة",
        desc: "تصدير ملخص طلبات الصيانة والتكلفة والعهد",
      },
    ],
  },
];

function UsersPage() {
  const { toast } = useToast();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [localUsers, setLocalUsers] = useState(erpStore.getUsers());

  // Delete User State
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    phone: "",
    password: "",
    role: "cashier",
  });
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [isConfirmUpsertOpen, setIsConfirmUpsertOpen] = useState(false);

  // Permissions Modal State
  const [permissionsUser, setPermissionsUser] = useState<SystemUser | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<UserPermission | null>(null);
  const [isConfirmSavePermsOpen, setIsConfirmSavePermsOpen] = useState(false);

  // Fiscal Period & Fiscal Year Lock Confirmations State
  const [isConfirmPeriodLockOpen, setIsConfirmPeriodLockOpen] = useState(false);
  const [isConfirmFiscalYearOpen, setIsConfirmFiscalYearOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConfirmPeriodLock = () => {
    const nextLock = !erpState.isAccountingPeriodLocked;
    setIsRefreshing(true);
    erpStore.setPeriodLock(nextLock);
    setErpState(erpStore.getState());
    setIsConfirmPeriodLockOpen(false);

    toast({
      title: nextLock ? "تم قفل قيود السنوات السابقة 🔒" : "تم فتح قيود السنوات السابقة للتعديل 🔓",
      description: nextLock
        ? "تم قفل الفترة بنجاح: لا يمكن الآن تعديل أو حذف أي قيود سابقة. جاري تحديث الصفحة..."
        : "تم فتح الفترة بنجاح: يمكنك الآن تعديل وحذف قيود السنوات السابقة بحرية. جاري تحديث الصفحة...",
    });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleConfirmFiscalYear = () => {
    const nextStatus = erpState.fiscalYearStatus === "open" ? "closed" : "open";
    setIsRefreshing(true);
    erpStore.setFiscalYearStatus(nextStatus);
    setErpState(erpStore.getState());
    setIsConfirmFiscalYearOpen(false);

    toast({
      title:
        nextStatus === "closed" ? "تم إغلاق السنة المالية 2026 🔴" : "تم فتح السنة المالية 2026 🟢",
      description:
        nextStatus === "closed"
          ? "السنة المالية 2026 أصبحت مغلقة ومرحلة الأرصدة. جاري تحديث الصفحة..."
          : "السنة المالية 2026 أصبحت مفتوحة وقابلة لتسجيل وتعديل القيود. جاري تحديث الصفحة...",
    });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  useEffect(() => {
    let mounted = true;
    const hosted = isHostedDeployment();
    const refreshLocalState = () => {
      if (!mounted) return;
      setErpState(erpStore.getState());
      if (!hosted) setLocalUsers(erpStore.getUsers());
    };
    const unsubscribe = erpStore.subscribe(refreshLocalState);

    if (hosted) {
      authService.getUsers()
        .then((profiles) => {
          if (!mounted) return;
          setLocalUsers(profiles.map(profileToSystemUser));
        })
        .catch((error) => {
          console.error("Failed to load the shared hosted user list.", error);
          if (mounted) {
            toast({
              title: "تعذر تحميل المستخدمين من قاعدة البيانات",
              description: "تأكد من أنك تملك صلاحية إدارة المستخدمين وأن ترحيل الصلاحيات تم تطبيقه.",
              variant: "destructive",
            });
          }
        });
    } else {
      setLocalUsers(erpStore.getUsers());
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const upsert = async () => {
    const username = form.username.trim();
    const normalizedUsername = username.toLowerCase();
    const emailToUse = username.includes("@")
      ? normalizedUsername
      : `${normalizedUsername}@restocash.local`;
    const hosted = isHostedDeployment();

    try {
      if (hosted) {
        const profiles = await authService.getUsers();

        if (editing) {
          if (form.password.trim()) {
            toast({
              title: "تغيير كلمة المرور غير متاح من شاشة التعديل",
              description: "كلمة مرور حساب الإنترنت لا تُحفظ في بيانات البرنامج. عدّل الاسم والدور والصلاحيات واترك حقل كلمة المرور فارغًا.",
              variant: "destructive",
            });
            return;
          }

          const currentProfile = profiles.find((profile: any) => profile.id === editing.id)
            || profiles.find((profile: any) => String(profile.username || "").toLowerCase() === editing.username.toLowerCase());
          if (!currentProfile) {
            throw new Error("الحساب غير موجود في قائمة المستخدمين المشتركة.");
          }
          const permissions = editing.permissions
            || currentProfile.permissions
            || erpState.userPermissions[editing.username]
            || erpState.userPermissions[form.role]
            || {};
          const updatedProfile = await authService.upsertProfile({
            id: currentProfile.id,
            username: normalizedUsername,
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            permissions,
            updated_at: new Date().toISOString(),
          });
          erpStore.upsertUser(profileToSystemUser(updatedProfile));
          setLocalUsers((await authService.getUsers()).map(profileToSystemUser));
          setEditing(null);
          setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
          setIsConfirmUpsertOpen(false);
          toast({ title: "تم تحديث المستخدم وصلاحيات حسابه المشتركة" });
          return;
        }

        if (profiles.some((profile: any) => String(profile.username || "").toLowerCase() === normalizedUsername)) {
          throw new Error("اسم المستخدم موجود بالفعل. اختر اسم دخول مختلفًا.");
        }

        const created = await authService.signUpNewUser(emailToUse, form.password, {
          username: normalizedUsername,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        });
        const authUserId = created?.user?.id;
        if (!authUserId) {
          throw new Error("تم إرسال طلب إنشاء الحساب لكن لم يرجع Supabase معرّف المستخدم. راجع إعدادات تأكيد البريد الإلكتروني.");
        }

        const defaultPermissions = erpState.userPermissions[form.role] || {};
        const createdProfile = await authService.upsertProfile({
          id: authUserId,
          username: normalizedUsername,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          permissions: defaultPermissions,
        });
        erpStore.updateUserPermission(normalizedUsername, defaultPermissions);
        erpStore.upsertUser(profileToSystemUser(createdProfile));
        setLocalUsers((await authService.getUsers()).map(profileToSystemUser));
        setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
        setIsConfirmUpsertOpen(false);
        toast({
          title: "تم إنشاء حساب الإنترنت",
          description: "تم تسجيل الحساب في قائمة المستخدمين المشتركة وحفظ صلاحيات دوره. راجع الصلاحيات التفصيلية قبل تسليم بيانات الدخول.",
        });
        return;
      }

      if (editing) {
        erpStore.upsertUser({
          ...editing,
          full_name: form.full_name,
          username,
          phone: form.phone,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
        setEditing(null);
        setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
        setIsConfirmUpsertOpen(false);
        toast({ title: "تم تحديث بيانات المستخدم محليًا" });
        return;
      }

      let cloudAccountError = "";
      try {
        await authService.signUpNewUser(emailToUse, form.password, {
          username: normalizedUsername,
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
        });
      } catch (error: any) {
        cloudAccountError = error?.message || "تعذر إنشاء حساب Supabase.";
        console.warn("Cloud sign-up unavailable; creating a local Al-Mokhtar user.", error);
      }

      const defaultPermissions = erpState.userPermissions[form.role] || {};
      const localUser: SystemUser = {
        id: `u-${Date.now()}`,
        full_name: form.full_name,
        username,
        phone: form.phone,
        role: form.role,
        password: form.password,
        permissions: defaultPermissions,
        created_at: new Date().toISOString(),
      };
      erpStore.upsertUser(localUser);
      erpStore.updateUserPermission(username, defaultPermissions);
      setLocalUsers(erpStore.getUsers());
      setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
      setIsConfirmUpsertOpen(false);
      toast({
        title: "تم إنشاء المستخدم المحلي",
        description: cloudAccountError
          ? `الحساب محلي فقط؛ تعذر إنشاء حساب الإنترنت: ${cloudAccountError}`
          : "تم حفظ المستخدم على هذا الجهاز.",
      });
    } catch (error: any) {
      toast({
        title: editing ? "تعذر تحديث المستخدم" : "تعذر إنشاء المستخدم",
        description: error?.message || "حدث خطأ أثناء حفظ حساب المستخدم وصلاحياته.",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    try {
      if (isHostedDeployment()) {
        // Removing the profile disables app access even if the Supabase identity remains.
        await authService.deleteUser(userToDelete);
        erpStore.deleteUser(userToDelete);
        setLocalUsers((await authService.getUsers()).map(profileToSystemUser));
        toast({
          title: "تم إلغاء وصول المستخدم",
          description: "حُذف الحساب من قائمة المختارين والصلاحيات. لا يستطيع دخول المختار بدون ملف مستخدم نشط.",
        });
      } else {
        erpStore.deleteUser(userToDelete);
        setLocalUsers(erpStore.getUsers());
        toast({ title: "تم حذف المستخدم المحلي" });
      }
    } catch (error: any) {
      toast({
        title: "تعذر حذف المستخدم",
        description: error?.message || "راجع صلاحية إدارة المستخدمين ثم حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const startEdit = (p: SystemUser) => {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? "",
      username: p.username ?? "",
      phone: p.phone ?? "",
      password: "",
      role: p.role,
    });
  };

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");

  const openPermissionsForUser = (user: SystemUser) => {
    setPermissionsUser(user);
    const currentPerms =
      user.permissions ||
      erpState.userPermissions[user.username] ||
      erpState.userPermissions[user.role] ||
      {};
    setEditedPermissions({ ...currentPerms });
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser || !editedPermissions) return;
    try {
      if (isHostedDeployment()) {
        const saved = await authService.upsertProfile({
          id: permissionsUser.id,
          username: permissionsUser.username,
          full_name: permissionsUser.full_name,
          phone: permissionsUser.phone,
          role: permissionsUser.role,
          permissions: editedPermissions,
          updated_at: new Date().toISOString(),
        });
        erpStore.updateUserPermission(permissionsUser.username, editedPermissions);
        erpStore.upsertUser(profileToSystemUser(saved));
        setLocalUsers((await authService.getUsers()).map(profileToSystemUser));
      } else {
        erpStore.updateUserPermission(permissionsUser.username, editedPermissions);
        setLocalUsers(erpStore.getUsers());
      }
      setErpState(erpStore.getState());
      setIsConfirmSavePermsOpen(false);
      setPermissionsUser(null);
      setEditedPermissions(null);
      toast({
        title: "تم حفظ الصلاحيات",
        description: isHostedDeployment()
          ? "تم حفظ صلاحيات المستخدم في قاعدة البيانات المشتركة، وستُستخدم عند تسجيل دخوله."
          : "تم حفظ صلاحيات المستخدم على هذا الجهاز.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر حفظ الصلاحيات",
        description: error?.message || "لم يتم حفظ التغييرات؛ تحقق من صلاحية إدارة المستخدمين.",
        variant: "destructive",
      });
    }
  };

  const togglePermission = (key: keyof UserPermission) => {
    if (!editedPermissions) return;
    setEditedPermissions({
      ...editedPermissions,
      [key]: !editedPermissions[key],
    });
  };

  const toggleCategoryPerms = (category: PermissionCategory, forceValue?: boolean) => {
    if (!editedPermissions) return;
    const currentAllChecked = category.permissions.every((p) => !!editedPermissions[p.key]);
    const targetValue = forceValue !== undefined ? forceValue : !currentAllChecked;
    const updated = { ...editedPermissions };
    category.permissions.forEach((p) => {
      updated[p.key] = targetValue;
    });
    setEditedPermissions(updated);
  };

  const selectAllPerms = (value: boolean) => {
    if (!editedPermissions) return;
    const updated: any = {};
    PERMISSION_CATEGORIES.forEach((cat) => {
      cat.permissions.forEach((p) => {
        updated[p.key] = value;
      });
    });
    setEditedPermissions(updated);
  };

  const applyRolePreset = (
    preset: "super_admin" | "manager" | "cashier" | "captain" | "kitchen",
  ) => {
    if (!editedPermissions) return;
    const updated: any = {};
    PERMISSION_CATEGORIES.forEach((cat) => {
      cat.permissions.forEach((p) => {
        updated[p.key] = false;
      });
    });

    if (preset === "super_admin") {
      PERMISSION_CATEGORIES.forEach((cat) => {
        cat.permissions.forEach((p) => {
          updated[p.key] = true;
        });
      });
    } else if (preset === "manager") {
      // Accounting, reports, approvals, inventory, purchasing, orders, hr
      const allowedCategories = [
        "orders_sales",
        "inventory_section",
        "purchasing_section",
        "accounting_section",
        "approvals_section",
        "reports_section",
        "hr_section",
        "maintenance_section",
      ];
      PERMISSION_CATEGORIES.forEach((cat) => {
        if (allowedCategories.includes(cat.id)) {
          cat.permissions.forEach((p) => {
            updated[p.key] = true;
          });
        }
      });
    } else if (preset === "cashier") {
      const allowedKeys = [
        "orders",
        "orders_view",
        "orders_create_custom",
        "orders_manage_carts",
        "orders_generate_qr",
        "pos",
        "pos_access",
        "pos_apply_discounts",
        "delivery",
        "delivery_view",
        "delivery_update_status",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    } else if (preset === "captain") {
      const allowedKeys = [
        "captain",
        "captain_access",
        "captain_create_order",
        "captain_transfer_tables",
        "captain_modify_items",
        "orders",
        "orders_view",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    } else if (preset === "kitchen") {
      const allowedKeys = [
        "kitchen",
        "kitchen_view",
        "kitchen_change_status",
        "kitchen_modify_order",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    }

    setEditedPermissions(updated);
  };

  return (
    <div className="space-y-8 p-1 sm:p-2">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5">
            <UsersIcon size={14} />
            إدارة الكوادر البشرية والرقابة
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground mt-2">
          إدارة المستخدمين وصلاحيات الوصول والرقابة
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          إضافة وتعديل حسابات المستخدمين والأنظمة، تخصيص جدول الصلاحيات (ACL)، وقفل الفترات والدفاتر
          المالية
        </p>
      </div>

      {/* User Registration & List */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <span>حسابات كادر العمل والمنظومة</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">الاسم الكامل</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="مثال: أحمد محمد"
              value={form.full_name}
              onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">اسم المستخدم / البريد (للدخول)</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="مثال: admin"
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">رقم الهاتف</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="01xxxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">الرقم السري</Label>
            <Input
              type="password"
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder={editing ? "اتركه فارغاً لعدم التغيير" : "الرقم السري"}
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <Label className="text-xs font-bold">الدور الوظيفي الأساسي</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold mt-1"
              value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
            >
              {Object.entries(roleLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6 flex justify-end items-end gap-2 mt-2">
            {editing && (
              <Button
                variant="outline"
                className="h-9 px-6 rounded-xl font-bold"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    full_name: "",
                    username: "",
                    phone: "",
                    password: "",
                    role: "cashier",
                  });
                }}
              >
                إلغاء التعديل
              </Button>
            )}
            <Button
              className="h-9 px-6 rounded-xl font-bold gap-2"
              onClick={() => setIsConfirmUpsertOpen(true)}
              disabled={!form.full_name || !form.username || (!editing && !form.password)}
            >
              <Save size={16} />
              {editing ? "حفظ التعديلات" : "إضافة مستخدم جديد"}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-right p-3 font-bold">الاسم الكامل</th>
                <th className="text-right p-3 font-bold">اسم الدخول</th>
                <th className="text-right p-3 font-bold">رقم الهاتف</th>
                <th className="text-right p-3 font-bold">الدور الوظيفي</th>
                <th className="text-center p-3 font-bold w-40">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-semibold">
              {localUsers.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-bold text-foreground">{u.full_name || "-"}</td>
                  <td className="p-3 font-mono">{u.username || "-"}</td>
                  <td className="p-3 font-mono">{u.phone || "-"}</td>
                  <td className="p-3">
                    <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-black text-[10px]">
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="p-3 flex items-center justify-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold"
                      onClick={() => openPermissionsForUser(u)}
                    >
                      <ShieldCheck size={14} />
                      الصلاحيات
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => startEdit(u)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        setUserToDelete(u.id);
                        setIsConfirmDeleteOpen(true);
                      }}
                      disabled={u.username === "admin"}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lock accounting periods & fiscal year status */}
      <div className="bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Lock size={18} className="text-amber-500" />
          <span>قفل الفترات والسنة المالية</span>
        </h3>
        <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
          حماية الدفاتر المحاسبية من التعديل التاريخي بأثر رجعي للسنوات السابقة، وإدارة إقفال السنة
          المالية الحالية 2026.
        </p>
        <div className="space-y-4 pt-2">
          {/* Historical Years Restriction Lock */}
          <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-foreground">
                  قفل الفترة المحاسبية التاريخية (قيود السنوات السابقة)
                </h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    erpState.isAccountingPeriodLocked
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {erpState.isAccountingPeriodLocked ? "🔒 مقفلة" : "🔓 مفتوحة"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {erpState.isAccountingPeriodLocked
                  ? "🔒 مقفلة: يمنع تعديل أو حذف أي قيود تعود لسنوات سابقة (You cannot edit restrictions in a closed year)."
                  : "🔓 مفتوحة وقابلة للتعديل: يُسمح بتعديل وحذف قيود السنوات السابقة والحالية."}
              </p>
            </div>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => setIsConfirmPeriodLockOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 ${
                erpState.isAccountingPeriodLocked
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/40 hover:bg-amber-500/25"
                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/25"
              }`}
            >
              {isRefreshing && <RefreshCw size={13} className="animate-spin" />}
              {erpState.isAccountingPeriodLocked ? "🔒 مقفلة حالياً" : "🔓 مفتوحة وقابلة للترحيل"}
            </button>
          </div>

          {/* Fiscal Year 2026 Lock */}
          <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-foreground">
                  حالة السنة المالية الحالية (2026)
                </h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    erpState.fiscalYearStatus === "closed"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {erpState.fiscalYearStatus === "closed" ? "🔴 مغلقة" : "🟢 مفتوحة"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {erpState.fiscalYearStatus === "closed"
                  ? "🔴 مغلقة ومرحلة: السنة المالية 2026 مغلقة، لا يمكن إضافة أو تعديل القيود."
                  : "🟢 سنة مالية نشطة ومفتوحة (2026): يمكن تسجيل القيود وإجراء كافة التعديلات بحرية."}
              </p>
            </div>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => setIsConfirmFiscalYearOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 ${
                erpState.fiscalYearStatus === "closed"
                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/40 hover:bg-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/25"
              }`}
            >
              {isRefreshing && <RefreshCw size={13} className="animate-spin" />}
              {erpState.fiscalYearStatus === "closed"
                ? "🔴 مغلقة ومرحلة"
                : "🟢 سنة مالية نشطة ومفتوحة"}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}

      {/* Confirmation Dialog: Historical Period Lock */}
      <AlertDialog open={isConfirmPeriodLockOpen} onOpenChange={setIsConfirmPeriodLockOpen}>
        <AlertDialogContent className="text-right max-w-lg rounded-2xl">
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              {erpState.isAccountingPeriodLocked ? (
                <Unlock className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
              ) : (
                <Lock className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
              )}
              {erpState.isAccountingPeriodLocked
                ? "تأكيد فتح قفل الفترة المحاسبية التاريخية"
                : "تأكيد قفل الفترة المحاسبية التاريخية"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed space-y-2">
              <span className="block font-bold text-foreground text-sm">
                {erpState.isAccountingPeriodLocked
                  ? "هل أنت متأكد من رغبتك في فتح قفل قيود وفترات السنوات السابقة والسماح بالتعديل؟"
                  : "هل أنت متأكد من رغبتك في قفل قيود وفترات السنوات السابقة ومنع التعديل؟"}
              </span>
              <div className="p-3 rounded-xl bg-muted/60 border space-y-1 mt-2 text-foreground/90 text-xs">
                {erpState.isAccountingPeriodLocked ? (
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    🔓 عند الفتح: سيُسمح لمديري النظام بتعديل وحذف قيود الفترات والسنوات السابقة
                    بحرية تامة.
                  </p>
                ) : (
                  <p className="text-amber-700 dark:text-amber-300 font-semibold">
                    🔒 عند القفل: سيتم منع أي تعديل أو حذف لقيود السنوات السابقة لحماية الدفاتر
                    المحاسبية من التعديل التاريخي بأثر رجعي.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  سيتم تطبيق التغيير فوراً وتحديث الصفحة لتأكيد الحالة الجديدة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmPeriodLock}
              disabled={isRefreshing}
              className={`rounded-xl font-bold px-5 text-white ${
                erpState.isAccountingPeriodLocked
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isRefreshing
                ? "جاري التحديث..."
                : erpState.isAccountingPeriodLocked
                  ? "نعم، افتح الفترة للتعديل"
                  : "نعم، اقفل الفترة الآن"}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء الأمر
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Fiscal Year 2026 Status */}
      <AlertDialog open={isConfirmFiscalYearOpen} onOpenChange={setIsConfirmFiscalYearOpen}>
        <AlertDialogContent className="text-right max-w-lg rounded-2xl">
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calendar className="text-primary shrink-0" size={20} />
              {erpState.fiscalYearStatus === "open"
                ? "تأكيد إغلاق السنة المالية 2026"
                : "تأكيد فتح وتنشيط السنة المالية 2026"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed space-y-2">
              <span className="block font-bold text-foreground text-sm">
                {erpState.fiscalYearStatus === "open"
                  ? "هل أنت متأكد من رغبتك في إغلاق السنة المالية الحالية (2026)؟"
                  : "هل أنت متأكد من رغبتك في إعادة فتح السنة المالية الحالية (2026)؟"}
              </span>
              <div className="p-3 rounded-xl bg-muted/60 border space-y-1 mt-2 text-foreground/90 text-xs">
                {erpState.fiscalYearStatus === "open" ? (
                  <p className="text-rose-700 dark:text-rose-300 font-semibold">
                    🔴 عند الإغلاق: ستصبح السنة المالية 2026 مغلقة، ولن يمكن تسجيل قيود يومية جديدة
                    أو تعديل القيود الحالية في هذه السنة حتى يتم إعادة فتحها.
                  </p>
                ) : (
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    🟢 عند الفتح: ستصبح السنة المالية 2026 نشطة ومفتوحة، مما يتيح تسجيل القيود
                    المحاسبية وإجراء كافة التعديلات بحرية.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  سيتم تطبيق التغيير فوراً وتحديث الصفحة لتأكيد الحالة الجديدة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmFiscalYear}
              disabled={isRefreshing}
              className={`rounded-xl font-bold px-5 text-white ${
                erpState.fiscalYearStatus === "open"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isRefreshing
                ? "جاري التحديث..."
                : erpState.fiscalYearStatus === "open"
                  ? "نعم، أغلق السنة المالية 2026"
                  : "نعم، افتح السنة المالية 2026"}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء الأمر
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}

      <AlertDialog open={isConfirmUpsertOpen} onOpenChange={setIsConfirmUpsertOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="text-primary" size={20} />
              {editing ? "تأكيد تعديل بيانات المستخدم" : "تأكيد إضافة مستخدم جديد"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editing
                ? "هل أنت متأكد من حفظ التعديلات على هذا الحساب؟"
                : "هل أنت متأكد من إضافة هذا المستخدم الجديد؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={upsert} className="bg-primary hover:bg-primary/90">
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="text-destructive" size={20} />
              تأكيد حذف المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الحساب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              className="bg-destructive hover:bg-destructive/90"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmSavePermsOpen} onOpenChange={setIsConfirmSavePermsOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="text-emerald-500" size={20} />
              تأكيد حفظ الصلاحيات
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حفظ التعديلات الجديدة على صلاحيات المستخدم؟ سيتم تطبيق هذه الصلاحيات
              فوراً وقد تؤثر على وصول المستخدم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSavePermissions}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              تأكيد الحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detailed Permissions Dialog */}
      <Dialog open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto text-right p-4 sm:p-6">
          <DialogHeader className="text-right pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl font-black">
                <ShieldCheck className="text-primary h-6 w-6" />
                صلاحيات المستخدم: {permissionsUser?.full_name} ({permissionsUser?.username})
              </DialogTitle>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold text-xs">
                الدور الحالي:{" "}
                {roleLabels[permissionsUser?.role || "cashier"] || permissionsUser?.role}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تفعيل أو تخصيص الصلاحيات الفرعية بدقة لكل قسم من أقسام المنظومة (المطبخ، الكاشير،
              الطلبات، الخزائن، الحسابات، صلاحيات السوبر أدمن).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Quick Role Presets */}
            <div className="bg-muted/30 p-3 rounded-2xl border border-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground">
                  قوالب وتعيين سريع للصلاحيات حسب الدور:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => selectAllPerms(true)}
                  >
                    تفعيل الكل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => selectAllPerms(false)}
                  >
                    تعطيل الكل
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                  onClick={() => applyRolePreset("super_admin")}
                >
                  ⚡ نمط: المدير العام (Super Admin)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-indigo-500/15 text-indigo-900 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
                  onClick={() => applyRolePreset("manager")}
                >
                  📊 نمط: المشرف / المحاسب المالي
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  onClick={() => applyRolePreset("cashier")}
                >
                  💳 نمط: الكاشير ونقطة البيع
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-blue-500/15 text-blue-900 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                  onClick={() => applyRolePreset("captain")}
                >
                  🍽️ نمط: كابتن الصالة
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-orange-500/15 text-orange-900 dark:text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"
                  onClick={() => applyRolePreset("kitchen")}
                >
                  👨‍🍳 نمط: شيف المطبخ والفرن
                </Button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:flex-1">
                <Input
                  placeholder="ابحث في الصلاحيات (مثلاً: مطبخ، خصم، إلغاء، سوبر أدمن)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-9 text-xs pr-3 rounded-xl border-border"
                />
              </div>
              <div className="w-full sm:w-64">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  <option value="ALL">عرض جميع الأقسام (15 قسم)</option>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Permissions Categories List */}
            <div className="space-y-4">
              {PERMISSION_CATEGORIES.filter(
                (cat) => categoryFilter === "ALL" || categoryFilter === cat.id,
              ).map((cat) => {
                const filteredPerms = cat.permissions.filter((p) => {
                  if (!permSearch.trim()) return true;
                  const query = permSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(query) ||
                    p.desc.toLowerCase().includes(query) ||
                    String(p.key).toLowerCase().includes(query)
                  );
                });

                if (filteredPerms.length === 0) return null;

                const enabledCount = cat.permissions.filter(
                  (p) => editedPermissions && !!editedPermissions[p.key],
                ).length;
                const isAllCategoryChecked = enabledCount === cat.permissions.length;

                return (
                  <div
                    key={cat.id}
                    className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs"
                  >
                    {/* Category Header */}
                    <div className="bg-muted/40 p-3.5 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-foreground">{cat.name}</h4>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                              enabledCount > 0
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {enabledCount} / {cat.permissions.length} مفعلة
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-xs font-bold rounded-lg"
                          onClick={() => toggleCategoryPerms(cat, !isAllCategoryChecked)}
                        >
                          {isAllCategoryChecked ? "إلغاء تفعيل القسم" : "تفعيل كامل القسم"}
                        </Button>
                      </div>
                    </div>

                    {/* Category Sub-permissions Grid */}
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-background/50">
                      {filteredPerms.map((perm) => {
                        const isChecked = editedPermissions ? !!editedPermissions[perm.key] : false;
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                              isChecked
                                ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
                                : "bg-card border-border/70 hover:bg-muted/20"
                            } ${perm.isSuperAdminOnly ? "border-amber-500/40 bg-amber-500/5" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer shrink-0"
                            />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {perm.name}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                    isChecked
                                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isChecked ? "مفعل ✓" : "معطل"}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                                {perm.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-2">
            <span className="text-xs text-muted-foreground">
              يتم تطبيق الصلاحيات بشكل فوري ودائم على حساب المستخدم.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 px-5 rounded-xl font-bold"
                onClick={() => setPermissionsUser(null)}
              >
                إلغاء
              </Button>
              <Button
                className="h-9 px-6 rounded-xl font-bold gap-2 bg-primary text-primary-foreground"
                onClick={() => setIsConfirmSavePermsOpen(true)}
              >
                <Save size={16} />
                حفظ الصلاحيات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
