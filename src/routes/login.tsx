import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { erpStore, type SystemUser } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — المختار لإدارة المشروعات" }] }),
  component: LoginPage,
});

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9");
}

function safeInternalRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

async function signInHostedUser(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const candidates = normalized.includes("@")
    ? [normalized]
    : [
        `${normalized}@restocash.local`,
        `${normalized}@almokhtar.local`,
        `${normalized}@mokhtar.local`,
        `${normalized}@restocash.com`,
      ];
  let accountMissingFromUsersPage = false;

  for (const email of Array.from(new Set(candidates))) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.session?.user?.id) continue;

      let profile: any = null;
      try {
        profile = await authService.getProfile(data.session.user.id);
      } catch (profileError) {
        console.error("Could not load the signed-in user's shared profile.", profileError);
      }

      if (profile?.id && profile?.username) {
        const isUsernameLogin = !normalized.includes("@");
        const storedUsername = String(profile.username).trim().toLowerCase();
        if (!isUsernameLogin || storedUsername === normalized) {
          return { session: data.session, email, profile };
        }
        // A legacy duplicate email alias must not bypass the username shown in the users page.
      }

      accountMissingFromUsersPage = true;
      await supabase.auth.signOut().catch(() => undefined);
    } catch {
      // Try the next supported legacy email suffix.
    }
  }

  return accountMissingFromUsersPage ? { reason: "not-listed" as const } : null;
}

async function signInCloudAccount(username: string, password: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const normalized = username.trim().toLowerCase();
  const base = normalized.includes("@") ? normalized.split("@")[0] : normalized;
  const candidates = Array.from(new Set([
    normalized.includes("@") ? normalized : `${base}@restocash.local`,
    `${base}@almokhtar.local`,
    `${base}@mokhtar.local`,
    `${base}@restocash.com`,
  ].filter(Boolean)));
  for (const email of candidates) {
    try {
      const { data } = await supabase.auth.signInWithPassword({ email, password });
      if (data?.session) return data.session;
    } catch {
      // Local sign-in is valid offline; cloud sync remains optional.
    }
  }
  return null;
}

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLocalAccounts, setHasLocalAccounts] = useState(() => erpStore.getUsers().length > 0);
  const [bootstrapFullName, setBootstrapFullName] = useState("");
  const [bootstrapUsername, setBootstrapUsername] = useState("");
  const [bootstrapPassword, setBootstrapPassword] = useState("");
  const [bootstrapConfirm, setBootstrapConfirm] = useState("");

  useEffect(() => {
    return erpStore.subscribe(() => setHasLocalAccounts(erpStore.getUsers().length > 0));
  }, []);

  const createFirstLocalAdmin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isHostedDeployment()) return;

    // IndexedDB may have restored existing user-page accounts after the initial render.
    if (erpStore.getUsers().length > 0) {
      setHasLocalAccounts(true);
      setError("تم العثور على حسابات موجودة في صفحة المستخدمين. سجّل الدخول بهذه الحسابات.");
      return;
    }

    const firstName = bootstrapFullName.trim();
    const firstUsername = normalizeDigits(bootstrapUsername.trim().toLowerCase());
    const firstPassword = normalizeDigits(bootstrapPassword);
    const confirmPassword = normalizeDigits(bootstrapConfirm);
    if (!firstName || !firstUsername || firstPassword.length < 8) {
      setError("أدخل الاسم واسم المستخدم وكلمة مرور لا تقل عن 8 أحرف أو أرقام.");
      return;
    }
    if (firstPassword !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    const permissions = { super_admin_full_access: true, users_roles: true, system_manage_users: true, system_backup_update: true };
    const initialUser: SystemUser = {
      id: `u-${Date.now()}`,
      full_name: firstName,
      username: firstUsername,
      phone: "",
      role: "admin",
      password: firstPassword,
      permissions,
      created_at: new Date().toISOString(),
    };
    erpStore.upsertUser(initialUser);
    erpStore.updateUserPermission(firstUsername, permissions);
    erpStore.setCurrentUser(firstUsername);
    localStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_auth_user");
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("restocash_auth_user", `${firstUsername}@almokhtar.local`);
    localStorage.setItem("restocash_user_role", "admin");
    setHasLocalAccounts(true);
    navigate({ to: "/admin/users" });
  };


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalizedUsername = normalizeDigits(username.trim().toLowerCase());
      const normalizedPassword = normalizeDigits(password);
      const search = new URLSearchParams(window.location.search);
      const destination = safeInternalRedirect(search.get("redirect"));

      // Public deployments must use a real Supabase session with a server-assigned admin role.
      // The local default account must never grant access to the hosted ERP.
      if (isHostedDeployment()) {
        localStorage.setItem("remember_me", rememberMe ? "true" : "false");
        const authenticated = await signInHostedUser(normalizedUsername, normalizedPassword);
        if (!authenticated) {
          setError("اسم المستخدم أو كلمة المرور غير صحيحة في حساب المستخدم السحابي.");
          return;
        }
        if ("reason" in authenticated && authenticated.reason === "not-listed") {
          setError("بيانات الدخول صحيحة لكن الحساب غير موجود في قائمة المستخدمين المشتركة أو لا يملك ملف صلاحيات. اطلب من مدير النظام تفعيل الحساب من صفحة المستخدمين.");
          return;
        }
        const { session, profile, email } = authenticated;
        const activeEmail = session.user.email || email;
        const activeUsername = String(profile.username || activeEmail.split("@")[0]).toLowerCase();
        const permissions = (profile.permissions || {}) as Record<string, boolean>;
        const role = String(profile.role || "cashier");

        localStorage.removeItem("restocash_auth_user");
        sessionStorage.removeItem("restocash_auth_user");
        localStorage.removeItem("restocash_user_role");
        sessionStorage.removeItem("restocash_user_role");
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("restocash_auth_user", activeEmail);
        storage.setItem("restocash_user_role", role);
        erpStore.updateUserPermission(activeUsername, permissions);
        erpStore.upsertUser({
          id: profile.id,
          full_name: profile.full_name || activeUsername,
          username: activeUsername,
          phone: profile.phone || "",
          role,
          permissions,
          created_at: profile.created_at || new Date().toISOString(),
        } as SystemUser);
        erpStore.setCurrentUser(activeUsername);
        navigate({ to: destination as any });
        return;
      }

      // Offline/local mode: accounts are read from the local ERP store only.
      const users = erpStore.getUsers() as SystemUser[];
      const user = users.find((candidate) => {
        if (!candidate) return false;
        const candidateUsername = (candidate.username || "").trim().toLowerCase();
        const candidateFullName = (candidate.full_name || "").trim().toLowerCase();
        const candidatePhone = normalizeDigits((candidate.phone || "").trim());
        return candidateUsername === normalizedUsername ||
          candidateFullName === normalizedUsername ||
          (candidatePhone !== "" && candidatePhone === normalizedUsername);
      });
      const passwordMatches = !!user &&
        (user.password === password ||
          normalizeDigits(user.password || "") === normalizedPassword);

      if (!user || !passwordMatches) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        return;
      }

      const activeUsername = user.username || normalizedUsername;
      const activeEmail = activeUsername.includes("@")
        ? activeUsername
        : `${activeUsername}@almokhtar.local`;

      localStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_user_role");
      localStorage.setItem("remember_me", rememberMe ? "true" : "false");
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("restocash_auth_user", activeEmail);
      storage.setItem("restocash_user_role", user.role || "cashier");
      const localPermissions = user.permissions || erpStore.getState().userPermissions[activeUsername] || erpStore.getState().userPermissions[user.role] || {};
      erpStore.updateUserPermission(activeUsername, localPermissions);
      erpStore.setCurrentUser(activeUsername);
      void signInCloudAccount(activeUsername, password).catch(() => undefined);
      navigate({ to: destination as any });
    } catch (cause) {
      console.error("Sign-in failed", cause);
      setError("تعذر تسجيل الدخول. تحقق من الاتصال والإعدادات ثم حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (!isHostedDeployment() && !hasLocalAccounts) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative" dir="rtl">
        <div className="absolute top-4 left-4"><LanguageSwitcher /></div>
        <form onSubmit={createFirstLocalAdmin} className="w-full max-w-md space-y-5 bg-card border border-border p-7 rounded-2xl shadow-elegant">
          <div className="text-center space-y-2">
            <RestocashLogo size={52} />
            <h1 className="text-2xl font-black text-foreground">تهيئة حساب المدير الأول</h1>
            <p className="text-sm text-muted-foreground">تم حذف حسابات الدخول الافتراضية القديمة. أنشئ حساب المدير الأول، ثم أدرج باقي الحسابات وصلاحياتها من صفحة المستخدمين.</p>
          </div>
          <div className="space-y-1.5"><Label>الاسم الكامل</Label><Input required value={bootstrapFullName} onChange={(e) => setBootstrapFullName(e.target.value)} autoComplete="name" /></div>
          <div className="space-y-1.5"><Label>اسم المستخدم الجديد</Label><Input required value={bootstrapUsername} onChange={(e) => setBootstrapUsername(e.target.value)} autoComplete="username" dir="ltr" /></div>
          <div className="space-y-1.5"><Label>كلمة المرور الجديدة (8 أحرف على الأقل)</Label><Input required type="password" minLength={8} value={bootstrapPassword} onChange={(e) => setBootstrapPassword(e.target.value)} autoComplete="new-password" dir="ltr" /></div>
          <div className="space-y-1.5"><Label>تأكيد كلمة المرور</Label><Input required type="password" minLength={8} value={bootstrapConfirm} onChange={(e) => setBootstrapConfirm(e.target.value)} autoComplete="new-password" dir="ltr" /></div>
          {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>إنشاء حساب المدير والمتابعة إلى إدارة المستخدمين</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 left-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-center mb-2"><RestocashLogo size={32} /></div>
        <p className="text-sm font-bold text-muted-foreground text-center">
          المختار لإدارة المشروعات — تسجيل الدخول
        </p>
        <p className="text-xs text-muted-foreground text-center">
          {isHostedDeployment()
            ? "نسخة الإنترنت: يلزم حساب مدير موثّق في مشروع Supabase."
            : "النسخة المحلية تعمل دون اتصال بالإنترنت وتحتفظ ببيانات هذا الجهاز."}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>اسم المستخدم</Label>
            <Input value={username} onChange={(event) => setUsername(event.target.value)}
              required placeholder="admin" className="mt-1" autoComplete="username" autoFocus />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              required placeholder="••••••" dir="ltr" autoComplete="current-password"
              className="text-right mt-1" />
          </div>
          {!isHostedDeployment() && (
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox id="remember" checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)} />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">تذكرني</Label>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center font-bold">{error}</p>}
          <Button type="submit" className="w-full h-10 font-bold text-sm" disabled={loading}>
            {loading ? "جاري الدخول…" : "دخول"}
          </Button>
        </form>
        {!isHostedDeployment() && (
          <p className="text-[11px] text-muted-foreground text-center">الحساب المحلي الافتراضي: admin / 123456</p>
        )}
      </div>
    </div>
  );
}
