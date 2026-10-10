import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { erpStore } from "@/shared/services/erpStore";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — المختار لإدارة المشروعات" }] }),
  component: LoginPage,
});

// Helper to normalize eastern Arabic/Persian digits to western ASCII digits
function normalizeDigits(str: string): string {
  return str
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9");
}

function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return;
  for (const key of ["restocash_auth_user", "restocash_user_role"]) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }
}

function clearAuthenticatedUserId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("restocash_authenticated_user_id");
  sessionStorage.removeItem("restocash_authenticated_user_id");
}

function safeRedirectTarget(value: string | null): string {
  if (!value || value.startsWith("//") || !(value === "/admin" || value.startsWith("/admin/"))) return "/admin";
  return value;
}

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearLegacyAuthStorage();
    const storedId =
      localStorage.getItem("restocash_authenticated_user_id") ||
      sessionStorage.getItem("restocash_authenticated_user_id");
    const activeUser = storedId
      ? erpStore.getUsers().find((user) => user.id === storedId)
      : undefined;

    if (activeUser) {
      const searchParams = new URLSearchParams(window.location.search);
      navigate({ to: safeRedirectTarget(searchParams.get("redirect")) });
    } else if (storedId) {
      clearAuthenticatedUserId();
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    clearLegacyAuthStorage();
    clearAuthenticatedUserId();

    const normalizedInputUser = normalizeDigits(username.trim().toLowerCase());
    const normalizedPassword = normalizeDigits(password);
    const matchedUser = erpStore.getUsers().find((user) => {
      const storedUsername = normalizeDigits(String(user?.username || "").trim().toLowerCase());
      return Boolean(storedUsername) && storedUsername === normalizedInputUser;
    });

    const passwordMatches =
      !!matchedUser &&
      typeof matchedUser.password === "string" &&
      matchedUser.password.length > 0 &&
      normalizeDigits(matchedUser.password) === normalizedPassword;

    if (!matchedUser || !passwordMatches) {
      setLoading(false);
      setError("اسم المستخدم أو كلمة المرور غير صحيحة، أو أن الحساب غير موجود في صفحة المستخدمين.");
      return;
    }

    localStorage.setItem("remember_me", rememberMe ? "true" : "false");
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("restocash_authenticated_user_id", matchedUser.id);
    erpStore.setCurrentUser(matchedUser.username);

    setLoading(false);
    const searchParams = new URLSearchParams(window.location.search);
    navigate({ to: safeRedirectTarget(searchParams.get("redirect")) });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 left-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-center mb-2">
          <RestocashLogo size={32} />
        </div>
        <p className="text-sm font-bold text-muted-foreground text-center">
          المختار لإدارة المشروعات — تسجيل الدخول
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>اسم المستخدم</Label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="اسم المستخدم الموجود في صفحة المستخدمين"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••"
              dir="ltr"
              className="text-right mt-1"
            />
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              تذكرني
            </Label>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center font-bold">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-10 font-bold text-sm" disabled={loading}>
            {loading ? "جاري الدخول…" : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
