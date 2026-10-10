import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ClipboardList, PackageCheck, Wrench, ArrowLeft } from "lucide-react";
import { erpStore } from "@/shared/services/erpStore";

function useMaintenanceSnapshot() {
  const [state, setState] = useState<any>(() => erpStore.getState());
  useEffect(() => {
    return erpStore.subscribe(() => setState({ ...erpStore.getState() }));
  }, []);
  return state;
}

const money = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value || 0);

const MAINTENANCE_VIEW_KEYS = [
  "maintenance_view", "maintenance_manage_requests", "maintenance_manage_preventive",
  "maintenance_manage_custody", "maintenance_manage_stock", "maintenance_post_finance",
  "maintenance_manage_buildings", "maintenance_export_reports",
];

function canCurrentUserViewMaintenance(state: any) {
  const permissions = state.userPermissions?.[state.currentUser] || {};
  return permissions.super_admin_full_access === true ||
    MAINTENANCE_VIEW_KEYS.some((key) => permissions[key] === true);
}

export function MaintenanceHomeWidget() {
  const state = useMaintenanceSnapshot();
  const stats = useMemo(() => {
    const orders = state.maintenanceWorkOrders || [];
    const tasks = state.maintenancePreventiveTasks || [];
    const custodians = state.maintenanceCustodies || [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      openOrders: orders.filter((item: any) => ["PENDING", "IN_PROGRESS"].includes(item.status)).length,
      overdueTasks: tasks.filter((item: any) => item.status !== "COMPLETED" && item.nextDueDate < today).length,
      activeCustodies: custodians.filter((item: any) => item.status === "ACTIVE").length,
      totalCost: orders.reduce((sum: number, item: any) => sum + (Number(item.laborCost) || 0) + (Number(item.partsCost) || 0), 0),
    };
  }, [state.maintenanceWorkOrders, state.maintenancePreventiveTasks, state.maintenanceCustodies]);

  if (!canCurrentUserViewMaintenance(state)) return null;

  return (
    <Card className="mb-5 overflow-hidden border-border/70">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="text-primary" size={20} />
            قسم الصيانة
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            الطلبات والصيانة الدورية والعهد مرتبطة ببيانات المختار الحالية.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/admin/maintenance">
            فتح القسم <ArrowLeft className="mr-1" size={15} />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 pb-5 md:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <ClipboardList className="mb-2 text-amber-600" size={18} />
          <p className="text-xs text-muted-foreground">طلبات قيد المعالجة</p>
          <p className="mt-1 text-2xl font-black">{stats.openOrders}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <CalendarClock className="mb-2 text-rose-600" size={18} />
          <p className="text-xs text-muted-foreground">مهام دورية متأخرة</p>
          <p className="mt-1 text-2xl font-black">{stats.overdueTasks}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <PackageCheck className="mb-2 text-blue-600" size={18} />
          <p className="text-xs text-muted-foreground">عهد قيد الاستخدام</p>
          <p className="mt-1 text-2xl font-black">{stats.activeCustodies}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <Wrench className="mb-2 text-emerald-600" size={18} />
          <p className="text-xs text-muted-foreground">إجمالي تكاليف الطلبات</p>
          <p className="mt-1 text-xl font-black">{money(stats.totalCost)} <span className="text-xs font-semibold">ج.م</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MaintenanceReportPanel() {
  const state = useMaintenanceSnapshot();
  const orders = state.maintenanceWorkOrders || [];
  const tasks = state.maintenancePreventiveTasks || [];
  const custodians = state.maintenanceCustodies || [];
  const closed = orders.filter((item: any) => item.status === "CLOSED" || item.status === "COMPLETED");
  const byBuilding = (state.maintenanceFacilities || []).map((building: any) => {
    const buildingOrders = orders.filter((item: any) => item.facilityId === building.id);
    return {
      id: building.id,
      name: building.name,
      requests: buildingOrders.length,
      cost: buildingOrders.reduce((sum: number, item: any) => sum + (Number(item.laborCost) || 0) + (Number(item.partsCost) || 0), 0),
    };
  });
  const totalCost = orders.reduce((sum: number, item: any) => sum + (Number(item.laborCost) || 0) + (Number(item.partsCost) || 0), 0);

  if (!canCurrentUserViewMaintenance(state)) return null;

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="text-primary" size={18} />
          ملخص تقارير الصيانة
        </CardTitle>
        <p className="text-xs text-muted-foreground">الأرقام مباشرة من سجل الصيانة المحلي المستخدم في لوحة الإدارة.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">كل الطلبات</p><p className="text-xl font-black">{orders.length}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">المكتملة/المغلقة</p><p className="text-xl font-black">{closed.length}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">مهام دورية</p><p className="text-xl font-black">{tasks.length}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">العهد النشطة</p><p className="text-xl font-black">{custodians.filter((item: any) => item.status === "ACTIVE").length}</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-right text-xs text-muted-foreground">
              <tr><th className="p-3">المبنى</th><th className="p-3">الطلبات</th><th className="p-3">التكلفة المسجلة</th></tr>
            </thead>
            <tbody>
              {byBuilding.map((building: any) => (
                <tr key={building.id} className="border-t border-border/60">
                  <td className="p-3 font-semibold">{building.name}</td>
                  <td className="p-3">{building.requests}</td>
                  <td className="p-3">{money(building.cost)} ج.م</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/20 font-black">
                <td className="p-3">الإجمالي</td><td className="p-3">{orders.length}</td><td className="p-3">{money(totalCost)} ج.م</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/maintenance">عرض تفاصيل الصيانة</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
