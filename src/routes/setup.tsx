import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "إعداد المدير — المختار لإدارة المشروعات" }] }),
  component: SetupPage,
});

function SetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-black">إعداد حساب المدير</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          إنشاء حساب المدير عبر رابط عام تم تعطيله لأسباب أمنية. أنشئ حساب المدير من لوحة
          تحكم Supabase، وامنحه دور admin في بيانات الخادم فقط، ثم سجّل الدخول من الصفحة الرئيسية.
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          العودة لتسجيل الدخول
        </Link>
      </section>
    </main>
  );
}
