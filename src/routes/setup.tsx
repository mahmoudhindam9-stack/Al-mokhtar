import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "إعداد النظام" }] }),
  component: SetupDisabledPage,
});

function SetupDisabledPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">تم إيقاف إعداد المدير البديل. سجّل الدخول من خلال مستخدم موجود في صفحة المستخدمين.</p>
    </main>
  );
}
