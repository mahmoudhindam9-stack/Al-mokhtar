// @ts-nocheck
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Grid3X3,
  ClipboardList,
  Package,
  BarChart3,
  Users,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Landmark,
  BookOpen,
  Wallet,
  UserCheck,
  Receipt,
  FileSpreadsheet,
  Menu,
  Building2,
  Settings,
  Wrench,
} from "lucide-react";
import { erpStore, type SystemUser, type UserPermission } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CURRENT_VERSION } from "@/shared/config/version";
import { GitHubUpdateBanner } from "@/components/admin/GitHubUpdateBanner";
import { NotificationBell } from "@/components/admin/NotificationBell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة" }] }),
  component: () => <AdminLayout />,
});

const ROUTE_PERMISSION_KEYS: Record<string, string[]> = {
  "/admin": [
    "super_admin_full_access", "accounting", "accounting_view", "reports", "reports_view_financials",
  ],
  "/admin/maintenance": [
    "maintenance_view", "maintenance_manage_requests", "maintenance_manage_preventive",
    "maintenance_manage_custody", "maintenance_post_finance", "maintenance_manage_buildings",
    "maintenance_export_reports",
  ],
  "/admin/mall": ["mall_manage_shops", "mall_garden_finance", "manage_park_shifts", "delete_park_shifts", "park_reports"],
  "/admin/financial": ["treasury", "treasury_view", "treasury_open_close", "accounting", "accounting_view", "expense_approval", "revenue_approval"],
  "/admin/inventory": ["inventory", "inventory_view", "inventory_adjust_transfer", "inventory_waste_dispose"],
  "/admin/receipts": ["treasury", "treasury_view", "accounting", "accounting_view", "expense_approval", "revenue_approval"],
  "/admin/hr": ["hr", "hr_view_attendance", "hr_manage_payroll_loans"],
  "/admin/reports": ["reports", "reports_view_sales", "reports_view_financials", "maintenance_export_reports"],
  "/admin/users": ["system_manage_users", "users_roles"],
  "/admin/system-update": ["system_backup_update", "developer_options"],
  "/admin/accounts": ["accounting", "accounting_view", "accounting_post_journal"],
  "/admin/ledger": ["accounting", "accounting_view", "accounting_post_journal", "journal_approval"],
};

const routePermissionKeys = (pathname: string): string[] | null => {
  const matched = Object.keys(ROUTE_PERMISSION_KEYS)
    .filter((path) => path !== "/admin" && (pathname === path || pathname.startsWith(path + "/")))
    .sort((a, b) => b.length - a.length)[0];
  if (matched) return ROUTE_PERMISSION_KEYS[matched];
  if (pathname === "/admin" || pathname === "/admin/") return ROUTE_PERMISSION_KEYS["/admin"];
  return null;
};

const DASHBOARD_TAB_PERMISSION_KEYS: Record<string, string[]> = {
  dashboard: ["accounting", "accounting_view", "reports", "reports_view_financials"],
  chart_of_accounts: ["accounting", "accounting_view", "accounting_post_journal"],
  audit_logs: ["audit_logs", "system_audit_logs", "users_roles"],
};

const canAccessDashboardTab = (user: SystemUser, tab: string) => {
  const required = DASHBOARD_TAB_PERMISSION_KEYS[tab];
  if (!required) return false;
  const permissions = erpStore.getState().userPermissions?.[user.username] || {};
  return permissions.super_admin_full_access === true || required.some((key) => permissions[key] === true);
};

const canAccessPath = (user: SystemUser, pathname: string) => {
  if (pathname === "/admin" || pathname === "/admin/") {
    return canAccessDashboardTab(user, "dashboard");
  }
  const required = routePermissionKeys(pathname);
  if (!required) return false;
  const permissions = erpStore.getState().userPermissions?.[user.username] || {};
  return permissions.super_admin_full_access === true || required.some((key) => permissions[key] === true);
};

const nav = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { to: "/admin/maintenance", label: "قسم الصيانة", icon: Wrench },
  { to: "/admin/mall", label: "إدارة المول والوحدات", icon: Building2 },
  { to: "/admin/financial", label: "قسم الإدارة المالية", icon: Landmark },
  { to: "/admin/inventory", label: "المخازن والتوريدات", icon: Package },
  { to: "/admin/receipts", label: "تصميم وإدارة الإيصالات والسندات", icon: Receipt },
  { to: "/admin/hr", label: "إدارة الموارد البشرية", icon: UserCheck },
  { to: "/admin/reports", label: "التقارير", icon: BarChart3 },
  { to: "/admin/users", label: "المستخدمين", icon: Users },
  {
    to: "/admin/system-update",
    label: "خيارات المطور",
    icon: Settings,
  },
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [user, setUser] = useState<SystemUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const clearOldAuth = () => {
      for (const key of ["restocash_auth_user", "restocash_user_role"]) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    };
    const validateUser = () => {
      clearOldAuth();
      const userId =
        localStorage.getItem("restocash_authenticated_user_id") ||
        sessionStorage.getItem("restocash_authenticated_user_id");
      const activeUser = userId ? erpStore.getUsers().find((item) => item.id === userId) : undefined;
      if (!activeUser) {
        localStorage.removeItem("restocash_authenticated_user_id");
        sessionStorage.removeItem("restocash_authenticated_user_id");
        setUser(null);
        setAuthChecking(false);
        navigate({ to: "/login" });
        return;
      }
      if (erpStore.getState().currentUser !== activeUser.username) {
        erpStore.setCurrentUser(activeUser.username);
      }
      setUser(activeUser);
      setAuthChecking(false);
    };

    validateUser();
    const unsubscribe = erpStore.subscribe(validateUser);
    return unsubscribe;
  }, [navigate]);

  const handleSignOut = () => {
    localStorage.removeItem("restocash_authenticated_user_id");
    sessionStorage.removeItem("restocash_authenticated_user_id");
    localStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_user_role");
    erpStore.setCurrentUser("");
    setUser(null);
    navigate({ to: "/login" });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <RestocashLogo size={32} />
          <p className="mt-4 text-sm font-bold text-foreground">جاري التحقق من المستخدم والصلاحيات…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const searchParams = new URLSearchParams(location.search);
  const canAccessCurrentRoute =
    pathname === "/admin" || pathname === "/admin/"
      ? canAccessDashboardTab(user, searchParams.get("tab") || "dashboard")
      : canAccessPath(user, pathname);
  const hasRouteSearch = searchParams.has("tab");
  const isNavItemActive = (item: (typeof nav)[number]) => {
    if (item.search) {
      return pathname === item.to && searchParams.get("tab") === item.search.tab;
    }
    if (item.exact) {
      // Do not mark the base dashboard active while a tab-specific view is open.
      return pathname === item.to && !hasRouteSearch;
    }
    return pathname.startsWith(item.to);
  };
  const activeNavItem = nav.find((item) => canAccessPath(user, item.to) && isNavItemActive(item));
  const visibleNav = nav.filter((item) => canAccessPath(user, item.to));

  const renderSidebarNav = (onItemClick?: () => void) => (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <RestocashLogo size={20} />
          <p className="text-[10px] text-muted-foreground mt-1">المختار لإدارة المشروعات</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {location.pathname.startsWith("/admin") ? "لوحة التحكم الرئيسية" : "الإدارة"}
        </div>
        {visibleNav.map((item) => {
          const active = isNavItemActive(item);
          return (
            <Link
              key={item.to + (item.search ? "?" + new URLSearchParams(item.search).toString() : "")}
              to={item.to}
              search={item.search}
              onClick={() => {
                if (onItemClick) onItemClick();
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-2 shrink-0">
        <p className="px-3 text-xs text-muted-foreground truncate">{user.full_name || user.username}</p>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => {
            if (onItemClick) onItemClick();
            handleSignOut();
          }}
        >
          <LogOut size={18} />
          تسجيل الخروج
        </Button>
        <Link
          to="/"
          onClick={() => {
            if (onItemClick) onItemClick();
          }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition"
        >
          <ArrowLeft size={18} />
          الرئيسية
        </Link>

        {/* System Version & Update Status */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <Link
            to="/admin/system-update"
            className="flex items-center gap-1.5 hover:text-foreground transition font-medium"
            title="انتقل إلى صفحة خيارات المطور والتحديثات"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>الإصدار: v{CURRENT_VERSION}</span>
          </Link>
          <span className="text-[10px] text-muted-foreground/70">GitHub Sync</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-l border-border bg-card flex-col h-screen sticky top-0">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Drawer Navigation (Sheet) */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="right" className="w-[280px] p-0 border-l border-border bg-card">
          {renderSidebarNav(() => setIsMobileMenuOpen(false))}
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* GitHub Auto-Update Notification Banner */}
        <GitHubUpdateBanner />

        {/* Admin Header with Page Title, Mobile Toggle, and Currency/Language Switcher */}
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {/* Mobile Sidebar Toggle Icon Button */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0 h-9 w-9 border-border"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="فتح القائمة الجانبية"
            >
              <Menu size={20} />
            </Button>
            <span className="font-black text-sm text-foreground">
              {activeNavItem?.label || "لوحة التحكم"}
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              | المختار لإدارة المشروعات
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              العملة: الجنيه المصري (EGP)
            </span>
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>
        <div className="p-4 sm:p-6 flex-1">{canAccessCurrentRoute ? (children || <Outlet />) : (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="text-lg font-black text-foreground">لا توجد صلاحية لهذه الصفحة</h2>
            <p className="mt-2 text-sm text-muted-foreground">هذا الحساب غير مخوّل لفتح القسم المطلوب. يحدد مدير النظام الصلاحيات من صفحة المستخدمين.</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/admin" })}>العودة للوحة المسموح بها</Button>
          </div>
        )}</div>
      </main>
    </div>
  );
}
