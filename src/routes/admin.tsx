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
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CURRENT_VERSION } from "@/shared/config/version";
import { GitHubUpdateBanner } from "@/components/admin/GitHubUpdateBanner";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { authService } from "@/features/auth/services/authService";
import { erpStore } from "@/shared/services/erpStore";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة" }] }),
  component: () => <AdminLayout />,
});

const nav = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true, permissionKeys: ["orders", "pos", "captain", "kitchen", "delivery", "inventory", "accounting", "treasury", "hr", "reports", "maintenance_view", "mall_manage_shops", "purchasing"] },
  { to: "/admin/maintenance", label: "قسم الصيانة", icon: Wrench, permissionKeys: ["maintenance_view", "maintenance_manage_requests", "maintenance_manage_preventive", "maintenance_manage_custody", "maintenance_post_finance", "maintenance_manage_buildings", "maintenance_export_reports"] },
  { to: "/admin/mall", label: "إدارة المول والوحدات", icon: Building2, permissionKeys: ["mall_manage_shops", "mall_garden_finance"] },
  { to: "/admin/financial", label: "قسم الإدارة المالية", icon: Landmark, permissionKeys: ["accounting", "accounting_view", "treasury", "journal_approval", "expense_approval", "revenue_approval", "cost_centers"] },
  { to: "/admin/inventory", label: "المخازن والتوريدات", icon: Package, permissionKeys: ["inventory", "inventory_view", "purchasing", "purchasing_view", "production", "production_view"] },
  { to: "/admin/receipts", label: "تصميم وإدارة الإيصالات والسندات", icon: Receipt, permissionKeys: ["treasury", "accounting", "revenue_approval", "expense_approval"] },
  { to: "/admin/hr", label: "إدارة الموارد البشرية", icon: UserCheck, permissionKeys: ["hr", "hr_view_attendance", "hr_manage_payroll_loans"] },
  { to: "/admin/labor-law", label: "قانون العمل واللوائح", icon: BookOpen, permissionKeys: ["hr", "hr_view_attendance", "labor_law_view"] },
  { to: "/admin/reports", label: "التقارير", icon: BarChart3, permissionKeys: ["reports", "reports_view_sales", "reports_view_financials"] },
  { to: "/admin/users", label: "المستخدمين", icon: Users, permissionKeys: ["users_roles", "system_manage_users"] },
  { to: "/admin/system-update", label: "خيارات المطور", icon: Settings, permissionKeys: ["system_backup_update", "developer_options"] },
];

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function defaultPermissionsForRole(role: string): Record<string, boolean> {
  if (role === "admin" || role === "super_admin") {
    return Object.fromEntries([
      "orders", "pos", "captain", "kitchen", "delivery", "inventory", "hr",
      "purchasing", "production", "treasury", "accounting", "journal_approval",
      "expense_approval", "revenue_approval", "reports", "cost_centers", "branch_mgmt",
      "audit_logs", "users_roles", "super_admin_full_access", "system_manage_users",
      "system_backup_update", "maintenance_view", "maintenance_manage_requests",
      "maintenance_manage_preventive", "maintenance_manage_custody", "maintenance_post_finance",
      "maintenance_manage_buildings", "maintenance_export_reports", "mall_manage_shops",
      "mall_garden_finance", "reports_view_sales", "reports_view_financials", "labor_law_view",
    ].map((key) => [key, true]));
  }
  if (role === "manager") {
    return {
      orders: true, pos: true, captain: true, kitchen: true, delivery: true,
      inventory: true, hr: true, purchasing: true, production: true, accounting: true,
      expense_approval: true, revenue_approval: true, reports: true, cost_centers: true,
      maintenance_view: true, maintenance_manage_requests: true, mall_manage_shops: true,
      reports_view_sales: true, reports_view_financials: true,
    };
  }
  if (role === "captain") return { orders: true, captain: true, orders_view: true, captain_access: true, captain_create_order: true };
  if (role === "kitchen") return { kitchen: true, kitchen_view: true, kitchen_change_status: true };
  return { orders: true, pos: true, captain: true, kitchen: true, delivery: true, orders_view: true, pos_access: true };
}

function permissionsForUser(user: { role?: string; permissions?: Record<string, any>; permissionsManaged?: boolean } | null): Record<string, boolean> {
  const current = user?.permissions || {};
  if (current.super_admin_full_access === true) return defaultPermissionsForRole("super_admin");
  if (user?.permissionsManaged) return current;
  return Object.keys(current).length > 0 ? current : defaultPermissionsForRole(user?.role || "cashier");
}

function hasAnyPermission(user: { role?: string; permissions?: Record<string, any> } | null, keys: string[] = []): boolean {
  if (keys.length === 0) return true;
  const permissions = permissionsForUser(user);
  return keys.some((key) => permissions[key] === true);
}

function localUsernameFromStorage(value: string): string {
  return String(value || "").split("@")[0].toLowerCase();
}


export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [user, setUser] = useState<{ email?: string; username?: string; role?: string; permissions?: Record<string, any>; permissionsManaged?: boolean } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const readLocalUser = (storedUser: string) => {
      const username = localUsernameFromStorage(storedUser);
      const state = erpStore.getState() as any;
      const role = sessionStorage.getItem("restocash_user_role")
        || localStorage.getItem("restocash_user_role")
        || state.users?.find((item: any) => String(item.username || "").toLowerCase() === username)?.role
        || "cashier";
      const permissions = state.userPermissions?.[username] || state.userPermissions?.[role] || {};
      return { email: storedUser, username, role, permissions, permissionsManaged: false };
    };

    const loadHostedProfile = async (session: any) => {
      if (!session?.user?.id) {
        if (isMounted) {
          setUser(null);
          navigate({ to: "/login" });
        }
        return;
      }
      try {
        const profile: any = await authService.getProfile(session.user.id);
        if (!profile?.id || !profile?.username) {
          await supabase.auth.signOut().catch(() => undefined);
          if (isMounted) {
            setUser(null);
            navigate({ to: "/login" });
          }
          return;
        }
        const appUser = {
          email: session.user.email || profile.username,
          username: String(profile.username).toLowerCase(),
          role: String(profile.role || "cashier"),
          permissions: (profile.permissions || {}) as Record<string, any>,
          permissionsManaged: true,
        };
        if (!isMounted) return;
        erpStore.updateUserPermission(appUser.username, appUser.permissions);
        erpStore.upsertUser({
          id: profile.id,
          full_name: profile.full_name || appUser.username,
          username: appUser.username,
          phone: profile.phone || "",
          role: appUser.role,
          permissions: appUser.permissions,
          created_at: profile.created_at || new Date().toISOString(),
        } as any);
        setUser(appUser);
      } catch (error) {
        console.error("Hosted profile authorization failed.", error);
        if (isMounted) {
          setUser(null);
          navigate({ to: "/login" });
        }
      }
    };

    async function checkAuth() {
      const localUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (isHostedDeployment()) {
          if (session?.user?.id) {
            await loadHostedProfile(session);
          } else {
            setUser(null);
            navigate({ to: "/login" });
          }
        } else if (localUser) {
          setUser(readLocalUser(localUser));
        } else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } catch (error) {
        console.error("Al-Mokhtar auth check failed:", error);
        if (!isMounted) return;
        if (!isHostedDeployment() && localUser) {
          setUser(readLocalUser(localUser));
        } else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    }

    void checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (isHostedDeployment()) {
        // Defer profile queries outside the auth callback to avoid re-entering the auth lock.
        void Promise.resolve().then(() => loadHostedProfile(session));
        return;
      }
      const localUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      if (localUser) {
        setUser(readLocalUser(localUser));
      } else if (!session) {
        setUser(null);
        navigate({ to: "/login" });
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    return erpStore.subscribe(() => {
      setUser((current) => {
        if (!current?.username) return current;
        const state = erpStore.getState() as any;
        const localRecord = (state.users || []).find(
          (item: any) => String(item.username || "").toLowerCase() === String(current.username).toLowerCase(),
        );
        const permissions =
          state.userPermissions?.[current.username] ||
          localRecord?.permissions ||
          current.permissions ||
          {};
        return { ...current, permissions };
      });
    });
  }, []);

  const handleSignOut = async () => {
    localStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_user_role");
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    navigate({ to: "/login" });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <RestocashLogo size={32} />
          <p className="mt-4 text-sm font-bold text-foreground">جاري التحقق من جلسة الدخول…</p>
          <p className="mt-2 text-xs text-muted-foreground">يرجى الانتظار لحظات.</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const searchParams = new URLSearchParams(location.search);
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
  const activeNavItem = nav.find(isNavItemActive);
  const financialPermissionKeys = ["accounting", "accounting_view", "treasury", "journal_approval", "expense_approval", "revenue_approval", "cost_centers"];
  const requiredForPath = pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/index"
    ? nav[0].permissionKeys
    : pathname.startsWith("/admin/accounts") || pathname.startsWith("/admin/ledger") || pathname.startsWith("/admin/ai-accountant")
      ? financialPermissionKeys
      : nav.find((item) => item.to !== "/admin" && pathname.startsWith(item.to))?.permissionKeys
        || ["__no_access_to_unmapped_page__"];
  const canAccessCurrentRoute = hasAnyPermission(user, requiredForPath);

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
        {nav.filter((item) => hasAnyPermission(user, item.permissionKeys)).map((item) => {
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
        <p className="px-3 text-xs text-muted-foreground truncate">{user?.email}</p>
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
        {hasAnyPermission(user, ["system_backup_update", "developer_options"]) && (
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
        )}
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
        <div className="p-4 sm:p-6 flex-1">
          {canAccessCurrentRoute ? (children || <Outlet />) : (
            <div role="alert" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <ShieldCheck size={34} className="mx-auto mb-3 text-primary" />
              <h2 className="text-xl font-black text-foreground">ليس لديك صلاحية لفتح هذه الصفحة</h2>
              <p className="mt-2 text-sm text-muted-foreground">تُحدد صلاحيات الوصول من صفحة المستخدمين. اطلب من مسؤول النظام تفعيل صلاحية القسم لحسابك.</p>
              <Button className="mt-5" onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة التحكم</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
