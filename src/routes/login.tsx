import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { erpStore, type SystemUser } from "@/shared/services/erpStore";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — المختار لإدارة المشروعات" }] }),
  component: LoginPage,
});

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

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalizedUsername = normalizeDigits(username.trim().toLowerCase());
      const normalizedPassword = normalizeDigits(password);
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

      const defaultAdminPasswordAccepted =
        normalizedUsername === "admin" && normalizedPassword === "123456";
      const passwordMatches = !!user &&
        (user.password === password ||
          normalizeDigits(user.password || "") === normalizedPassword ||
          (user.username === "admin" && defaultAdminPasswordAccepted));

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
      erpStore.setCurrentUser(activeUsername);

      const search = new URLSearchParams(window.location.search);
      navigate({ to: safeInternalRedirect(search.get("redirect")) as any });
    } catch (cause) {
      console.error("Local sign-in failed", cause);
      setError("تعذر تسجيل الدخول محليًا. أعد تشغيل البرنامج وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 left-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-center mb-2"><RestocashLogo size={32} /></div>
        <p className="text-sm font-bold text-muted-foreground text-center">
          المختار لإدارة المشروعات — تسجيل الدخول المحلي
        </p>
        <p className="text-xs text-muted-foreground text-center">
          يعمل البرنامج دون اتصال بالإنترنت، وتُحفظ التغييرات على هذا الجهاز.
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
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox id="remember" checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)} />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">تذكرني</Label>
          </div>
          {error && <p role="alert" className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center font-bold">{error}</p>}
          <Button type="submit" className="w-full h-10 font-bold text-sm" disabled={loading}>
            {loading ? "جاري الدخول…" : "دخول"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center">الحساب الافتراضي: admin / 123456</p>
      </div>
    </div>
  );
}
