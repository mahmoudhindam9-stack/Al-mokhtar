import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "إعداد المختار" }] }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-5 bg-card border border-border p-7 rounded-2xl text-center">
        <div className="flex justify-center"><RestocashLogo size={34} /></div>
        <h1 className="text-2xl font-black">المختار جاهز للتشغيل المحلي</h1>
        <p className="text-sm text-muted-foreground leading-7">
          لم تعد هناك حاجة إلى إعداد مدير عبر قاعدة بيانات. الحساب المحلي الافتراضي هو
          <span className="font-bold text-foreground"> admin </span>
          وكلمة المرور
          <span className="font-bold text-foreground"> 123456 </span>.
        </p>
        <p className="text-xs text-muted-foreground">
          عند إعداد مشروع Supabase جديد، تُضاف بيانات الاتصال لاحقًا دون التأثير على التشغيل دون إنترنت.
        </p>
        <Button className="w-full" onClick={() => navigate({ to: "/login" })}>الانتقال إلى تسجيل الدخول</Button>
      </div>
    </div>
  );
}
