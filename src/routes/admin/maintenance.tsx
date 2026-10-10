// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { erpStore } from "@/shared/services/erpStore";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, CalendarClock, ClipboardList, PackageCheck, Plus, Search, Wrench,
  Pencil, Trash2, CheckCircle2, Wallet, MapPinned,
  AlertTriangle, CircleDollarSign, ClipboardCheck, Boxes, X, QrCode, Network,
  ArrowUp, ArrowDown, PackagePlus
} from "lucide-react";

export const Route = createFileRoute("/admin/maintenance")({
  head: () => ({ meta: [{ title: "قسم الصيانة — المختار لإدارة المشروعات" }] }),
  component: MaintenancePage,
});

const INITIAL_BUILDINGS = [
  { id: "maintenance-building-1", facilityNumber: 1, name: "مبنى رقم 1", subFacilities: [] },
  { id: "maintenance-building-2", facilityNumber: 2, name: "مبنى رقم 2", subFacilities: [] },
  { id: "maintenance-building-3", facilityNumber: 3, name: "مبنى رقم 3", subFacilities: [] },
];

const createBranchNode = (name = "") => ({
  id: `maintenance-branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  children: [] as any[],
});

function normalizeBranchTree(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node: any) => ({
    id: String(node?.id || createBranchNode().id),
    name: String(node?.name || ""),
    children: normalizeBranchTree(node?.children || node?.subFacilities || []),
  }));
}

function flattenBranchTree(nodes: any[], prefix = ""): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  for (const node of nodes || []) {
    const fullName = prefix ? `${prefix} > ${node.name}` : node.name;
    result.push({ id: node.id, name: fullName });
    result.push(...flattenBranchTree(node.children || [], fullName));
  }
  return result;
}

function updateBranchTree(nodes: any[], path: string[], updater: (node: any) => any): any[] {
  if (!path.length) return nodes;
  const [targetId, ...rest] = path;
  const index = nodes.findIndex((node: any) => node.id === targetId);
  if (index < 0) return nodes;
  const next = [...nodes];
  if (rest.length === 0) {
    const updated = updater(next[index]);
    if (updated === null || updated === undefined) next.splice(index, 1);
    else next[index] = updated;
  } else {
    next[index] = {
      ...next[index],
      children: updateBranchTree(next[index].children || [], rest, updater),
    };
  }
  return next;
}

function moveBranchTree(nodes: any[], path: string[], direction: "up" | "down"): any[] {
  if (!path.length) return nodes;
  const [targetId, ...rest] = path;
  const next = [...nodes];
  const index = next.findIndex((node: any) => node.id === targetId);
  if (index < 0) return nodes;
  if (rest.length) {
    next[index] = {
      ...next[index],
      children: moveBranchTree(next[index].children || [], rest, direction),
    };
    return next;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= next.length) return next;
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

const FREQUENCIES = [
  { value: "DAILY", label: "يومي" },
  { value: "WEEKLY", label: "أسبوعي" },
  { value: "MONTHLY", label: "شهري" },
  { value: "QUARTERLY", label: "ربع سنوي" },
  { value: "YEARLY", label: "سنوي" },
];
const ORDER_STATUSES = [
  { value: "PENDING", label: "جديد" },
  { value: "IN_PROGRESS", label: "قيد التنفيذ" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "CLOSED", label: "مغلق" },
  { value: "CANCELLED", label: "ملغي" },
];
const PRIORITIES = [
  { value: "LOW", label: "منخفضة" },
  { value: "MEDIUM", label: "عادية" },
  { value: "HIGH", label: "عالية" },
  { value: "CRITICAL", label: "طارئة" },
];
const today = () => new Date().toISOString().slice(0, 10);
const createOrderForm = () => ({
  title: "", description: "", facilityId: "", subFacilityId: "", deadline: today(), priority: "MEDIUM",
  status: "PENDING", assignedTo: "", maintenanceType: "كهرباء", requiredParts: "",
  laborCost: "0", partsCost: "0",
});
const createTaskForm = () => ({
  description: "", facilityId: "", subFacilityId: "", frequency: "MONTHLY", nextDueDate: today(),
  assignedTo: "", notes: "", requiredParts: "",
});
const createCustodyForm = () => ({
  itemName: "", assetCode: "", inventoryId: "", employeeId: "", facilityId: "", subFacilityId: "",
  assignedAt: today(), notes: "",
});
const money = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number(amount) || 0);
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString("ar-EG") : "—";
const frequencyLabel = (value: string) => FREQUENCIES.find((item) => item.value === value)?.label || value;
const statusLabel = (value: string) =>
  ORDER_STATUSES.find((item) => item.value === value)?.label ||
  (value === "OVERDUE" ? "متأخرة" : value === "ACTIVE" ? "قيد الاستخدام" : value === "RETURNED" ? "تم الإرجاع" : value);

function useErpSnapshot() {
  const [state, setState] = useState<any>(() => erpStore.getState());
  useEffect(() => {
    setState({ ...erpStore.getState() });
    return erpStore.subscribe(() => setState({ ...erpStore.getState() }));
  }, []);
  return state;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-bold text-foreground">{label}</span>{children}</label>;
}
const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const selectClass = inputClass;
const smallButton = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

function Metric({ title, value, icon: Icon, tone = "blue" }: any) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600", amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600", emerald: "bg-emerald-500/10 text-emerald-600",
  };
  return <Card><CardContent className="flex items-center justify-between gap-3 p-4">
    <div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
    <div className={`rounded-xl p-3 ${tones[tone] || tones.blue}`}><Icon size={21}/></div>
  </CardContent></Card>;
}

function MaintenancePage() {
  const erpState = useErpSnapshot();
  const [activeTab, setActiveTab] = useState("overview");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("ALL");
  const [taskSearch, setTaskSearch] = useState("");
  const [custodySearch, setCustodySearch] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState<any>(createOrderForm);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<any>(createTaskForm);
  const [showCustodyForm, setShowCustodyForm] = useState(false);
  const [editingCustodyId, setEditingCustodyId] = useState<string | null>(null);
  const [custodyForm, setCustodyForm] = useState<any>(createCustodyForm);
  const [facilityDrafts, setFacilityDrafts] = useState<Record<string, string>>({});
  const [financeOrderId, setFinanceOrderId] = useState<string | null>(null);
  const [financeTreasuryId, setFinanceTreasuryId] = useState("");
  const [editingFacility, setEditingFacility] = useState<any>(null);
  const [qrModalData, setQrModalData] = useState<any>(null);
  const [maintenanceWarehouse, setMaintenanceWarehouse] = useState<any>(null);
  const [maintenanceInventoryItems, setMaintenanceInventoryItems] = useState<any[]>([]);
  const [maintenanceWarehouseStock, setMaintenanceWarehouseStock] = useState<any[]>([]);
  const [warehouseLoadError, setWarehouseLoadError] = useState("");
  const [showStockItemForm, setShowStockItemForm] = useState(false);
  const [stockItemForm, setStockItemForm] = useState({
    name_ar: "", unit: "قطعة", quantity: "0", min_level: "0", cost: "0", category: "قطع غيار صيانة",
  });
  const [isSavingStockItem, setIsSavingStockItem] = useState(false);
  const [issueOrderId, setIssueOrderId] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState({ inventoryId: "", quantity: "1" });
  const [isIssuingPart, setIsIssuingPart] = useState(false);

  useEffect(() => {
    const state = erpStore.getState() as any;
    if (!state.maintenance_tree_map_v2) {
      const currentFacilities = Array.isArray(state.maintenanceFacilities) && state.maintenanceFacilities.length
        ? state.maintenanceFacilities.map((facility: any, index: number) => ({
            ...facility,
            facilityNumber: Number(facility.facilityNumber) || index + 1,
            subFacilities: normalizeBranchTree(facility.subFacilities || []),
          }))
        : INITIAL_BUILDINGS.map((facility) => ({ ...facility, subFacilities: [] }));
      erpStore.state = {
        ...state,
        maintenance_tree_map_v2: true,
        maintenanceFacilities: currentFacilities,
        maintenanceWorkOrders: Array.isArray(state.maintenanceWorkOrders) ? state.maintenanceWorkOrders : [],
        maintenancePreventiveTasks: Array.isArray(state.maintenancePreventiveTasks) ? state.maintenancePreventiveTasks : [],
        maintenanceCustodies: Array.isArray(state.maintenanceCustodies) ? state.maintenanceCustodies : [],
      };
      erpStore.saveState();
      erpStore.logAction("ADMIN", "تهيئة خريطة الصيانة المتفرعة", "تم تحديث بنية خريطة الصيانة لدعم الفروع المتداخلة مع الاحتفاظ بالسجلات الحالية", "SYSTEM");
    }

    let mounted = true;
    const loadMaintenanceWarehouse = async () => {
      try {
        setWarehouseLoadError("");
        const warehouse = await inventoryService.ensureMaintenanceWarehouse();
        const [items, stock] = await Promise.all([
          inventoryService.getInventory(),
          inventoryService.getWarehouseInventory(warehouse.id),
        ]);
        if (!mounted) return;
        setMaintenanceWarehouse(warehouse);
        setMaintenanceInventoryItems(items || []);
        setMaintenanceWarehouseStock(stock || []);
      } catch (error: any) {
        if (!mounted) return;
        setWarehouseLoadError(error?.message || "تعذر تحميل مخزن الصيانة");
      }
    };
    void loadMaintenanceWarehouse();
    return () => { mounted = false; };
  }, []);

  const orders = erpState.maintenanceWorkOrders || [];
  const tasks = erpState.maintenancePreventiveTasks || [];
  const custodies = erpState.maintenanceCustodies || [];
  const facilities = erpState.maintenanceFacilities || INITIAL_BUILDINGS;
  const users = erpState.users || [];
  const employees = erpState.employees || [];
  const inventoryItems = Object.values(erpState.extendedInventoryItems || {});
  const treasuries = (erpState.treasuries || []).filter((item: any) => item.is_open !== false && item.status !== "closed" && item.currency !== "MULTI");
  const currentUsername = String(erpState.currentUser || "").trim();
  const activeSystemUser = (erpState.users || []).find((user: any) => user.username === currentUsername);
  const currentUserEmail = activeSystemUser?.username || "";
  const permissions = activeSystemUser
    ? erpState.userPermissions?.[activeSystemUser.username] || {}
    : {};
  const isAdmin = permissions.super_admin_full_access === true;
  const canManageStock = isAdmin || !!permissions.maintenance_manage_stock || !!permissions.inventory_adjust_transfer;
  const canView = isAdmin || !!(
    permissions.maintenance_view || permissions.maintenance_manage_requests ||
    permissions.maintenance_manage_preventive || permissions.maintenance_manage_custody ||
    permissions.maintenance_manage_stock || permissions.maintenance_post_finance || permissions.maintenance_manage_buildings
  );
  const canManageRequests = isAdmin || !!permissions.maintenance_manage_requests;
  const canManagePreventive = isAdmin || !!permissions.maintenance_manage_preventive;
  const canManageCustody = isAdmin || !!permissions.maintenance_manage_custody;
  const canManageBuildings = isAdmin || !!permissions.maintenance_manage_buildings;
  const canPostFinance = isAdmin || !!permissions.maintenance_post_finance ||
    !!permissions.accounting_post_journal || !!permissions.expense_approval;
  const canExport = isAdmin || !!permissions.maintenance_export_reports || !!permissions.reports;

  useEffect(() => {
    setFacilityDrafts(Object.fromEntries(facilities.map((facility: any) => [facility.id, facility.name])));
  }, [facilities]);

  const people = useMemo(() => {
    const combined: any[] = [];
    const seen = new Set<string>();
    employees.forEach((employee: any) => {
      if (!employee?.id || employee.status === "inactive" || employee.status === "suspended") return;
      combined.push({ id: employee.id, name: employee.name || employee.full_name || employee.email, role: employee.job_title || employee.department || "موظف" });
      seen.add(employee.id);
    });
    users.forEach((user: any) => {
      if (!user?.id || seen.has(user.id)) return;
      combined.push({ id: user.id, name: user.full_name || user.username, role: user.role || "مستخدم" });
    });
    return combined;
  }, [employees, users]);

  const buildingName = (id?: string) => facilities.find((item: any) => item.id === id)?.name || "غير محدد";
  const personName = (id?: string) => people.find((item: any) => item.id === id)?.name || id || "غير معيّن";
  const branchOptionsFor = (facilityId?: string) => {
    const facility = facilities.find((item: any) => item.id === facilityId);
    return flattenBranchTree(facility?.subFacilities || []);
  };
  const locationName = (facilityId?: string, subFacilityId?: string) => {
    const rootName = buildingName(facilityId);
    if (!subFacilityId) return rootName;
    const branch = branchOptionsFor(facilityId).find((item) => item.id === subFacilityId);
    return branch ? `${rootName} > ${branch.name}` : rootName;
  };
  const recordAction = (patch: Record<string, any>, action: string, details: string, type = "UPDATE") => {
    erpStore.state = { ...erpStore.getState(), ...patch };
    erpStore.saveState();
    erpStore.logAction("ADMIN", action, details, type);
  };

  const refreshMaintenanceWarehouse = async () => {
    const warehouse = await inventoryService.ensureMaintenanceWarehouse();
    const [items, stock] = await Promise.all([
      inventoryService.getInventory(),
      inventoryService.getWarehouseInventory(warehouse.id),
    ]);
    setMaintenanceWarehouse(warehouse);
    setMaintenanceInventoryItems(items || []);
    setMaintenanceWarehouseStock(stock || []);
    setWarehouseLoadError("");
    return warehouse;
  };

  const openQrForLocation = (facility: any, branch?: any) => {
    if (typeof window === "undefined") return;
    let fullLocation = facility.name;
    if (branch) {
      const branchPath = flattenBranchTree(facility.subFacilities || []).find((item) => item.id === branch.id);
      fullLocation = branchPath ? `${facility.name} > ${branchPath.name}` : `${facility.name} > ${branch.name}`;
    }
    const url = new URL("/maintenance-request", window.location.origin);
    url.searchParams.set("public_request", "true");
    url.searchParams.set("facilityId", facility.id);
    if (branch?.id) url.searchParams.set("subFacilityId", branch.id);
    url.searchParams.set("location", fullLocation);
    setQrModalData({ name: fullLocation, url: url.toString() });
  };

  const todayDate = today();
  const overdueTasks = tasks.filter((task: any) => task.status !== "COMPLETED" && task.nextDueDate < todayDate);
  const openOrders = orders.filter((order: any) => ["PENDING", "IN_PROGRESS"].includes(order.status));
  const activeCustodies = custodies.filter((item: any) => item.status === "ACTIVE");
  const totalMaintenanceCost = orders.reduce((sum: number, order: any) => sum + (Number(order.laborCost) || 0) + (Number(order.partsCost) || 0), 0);

  const closeOrderForm = () => {
    setOrderForm(createOrderForm());
    setEditingOrderId(null);
    setShowOrderForm(false);
  };
  const openOrderEditor = (order?: any) => {
    if (order) {
      setEditingOrderId(order.id);
      setOrderForm({
        title: order.title || "", description: order.description || "", facilityId: order.facilityId || "", subFacilityId: order.subFacilityId || "",
        deadline: (order.deadline || today()).slice(0, 10), priority: order.priority || "MEDIUM",
        status: order.status || "PENDING", assignedTo: order.assignedTo?.[0] || "",
        maintenanceType: (order.maintenanceType || []).join(", "), requiredParts: order.requiredParts || "",
        laborCost: String(order.laborCost || 0), partsCost: String(order.partsCost || 0),
      });
    } else {
      setEditingOrderId(null);
      setOrderForm({ ...createOrderForm(), facilityId: facilities[0]?.id || "" });
    }
    setShowOrderForm(true);
    setActiveTab("requests");
  };
  const setOrderValue = (key: string, value: any) => setOrderForm((current: any) => ({ ...current, [key]: value }));
  const saveOrder = (event: FormEvent) => {
    event.preventDefault();
    if (!orderForm.title.trim() || !orderForm.description.trim()) {
      alert("يرجى كتابة عنوان الطلب ووصف العطل.");
      return;
    }
    if (!canManageRequests) return;
    const existing = orders.find((item: any) => item.id === editingOrderId);
    const nextNumber = orders.reduce((highest: number, item: any) => Math.max(highest, Number(item.orderNumber) || 0), 1000) + (existing ? 0 : 1);
    const order = {
      ...(existing || {}),
      id: existing?.id || `maintenance-order-${Date.now()}`,
      orderNumber: existing?.orderNumber || nextNumber,
      title: orderForm.title.trim(),
      description: orderForm.description.trim(),
      facilityId: orderForm.facilityId || facilities[0]?.id || "",
      subFacilityId: orderForm.subFacilityId || "",
      deadline: orderForm.deadline || today(),
      priority: orderForm.priority,
      status: orderForm.status,
      assignedTo: orderForm.assignedTo ? [orderForm.assignedTo] : [],
      maintenanceType: orderForm.maintenanceType.split(",").map((item: string) => item.trim()).filter(Boolean),
      requiredParts: orderForm.requiredParts.trim(),
      needsParts: !!orderForm.requiredParts.trim(),
      partsSupplied: existing?.partsSupplied || false,
      laborCost: Math.max(0, Number(orderForm.laborCost) || 0),
      partsCost: Math.max(0, Number(orderForm.partsCost) || 0),
      createdBy: existing?.createdBy || currentUserEmail || "admin",
      createdAt: existing?.createdAt || new Date().toISOString(),
      closedAt: ["CLOSED", "COMPLETED"].includes(orderForm.status) ? existing?.closedAt || new Date().toISOString() : undefined,
      notes: existing?.notes || [],
    };
    const updated = existing
      ? orders.map((item: any) => item.id === existing.id ? order : item)
      : [...orders, order];
    recordAction(
      { maintenanceWorkOrders: updated },
      existing ? "تعديل طلب صيانة" : "إنشاء طلب صيانة",
      `طلب الصيانة #${order.orderNumber}: ${order.title}`,
      existing ? "UPDATE" : "CREATE",
    );
    closeOrderForm();
  };
  const deleteOrder = (order: any) => {
    if (!canManageRequests || order.financialVoucherId) return;
    if (!window.confirm(`هل تريد حذف طلب الصيانة #${order.orderNumber}؟`)) return;
    recordAction(
      { maintenanceWorkOrders: orders.filter((item: any) => item.id !== order.id) },
      "حذف طلب صيانة",
      `حذف طلب الصيانة #${order.orderNumber}: ${order.title}`,
      "DELETE",
    );
  };
  const changeOrderStatus = (order: any, status: string) => {
    if (!canManageRequests) return;
    const updatedOrder = {
      ...order,
      status,
      closedAt: ["CLOSED", "COMPLETED"].includes(status) ? order.closedAt || new Date().toISOString() : undefined,
    };
    recordAction(
      { maintenanceWorkOrders: orders.map((item: any) => item.id === order.id ? updatedOrder : item) },
      "تحديث حالة طلب الصيانة",
      `تم تغيير حالة الطلب #${order.orderNumber} إلى ${statusLabel(status)}`,
      "UPDATE",
    );
  };

  const postOrderExpense = (order: any) => {
    if (!canPostFinance || !financeTreasuryId || order.financialVoucherId) return;
    const amount = (Number(order.laborCost) || 0) + (Number(order.partsCost) || 0);
    if (amount <= 0) {
      alert("أدخل تكلفة العمالة و/أو قطع الغيار أولاً.");
      return;
    }
    if (!window.confirm(`سيتم تسجيل سند صرف بقيمة ${money(amount)} ج.م وربطه بالخزينة والدفتر المالي. هل تتابع؟`)) return;
    const voucher = erpStore.createVoucher(
      "payment",
      "مصروفات الصيانة",
      amount,
      financeTreasuryId,
      `تكلفة طلب صيانة #${order.orderNumber} — ${order.title}`,
      `الصيانة - ${buildingName(order.facilityId)}`,
    );
    const freshOrders = (erpStore.getState() as any).maintenanceWorkOrders || [];
    recordAction(
      { maintenanceWorkOrders: freshOrders.map((item: any) => item.id === order.id ? { ...item, financialVoucherId: voucher.id, financialPostedAt: new Date().toISOString() } : item) },
      "ترحيل تكلفة الصيانة للمالية",
      `تم ترحيل تكلفة طلب الصيانة #${order.orderNumber} بقيمة ${money(amount)} ج.م إلى السند ${voucher.id}`,
      "TRANSACTION",
    );
    setFinanceOrderId(null);
    setFinanceTreasuryId("");
  };

  const closeTaskForm = () => {
    setTaskForm(createTaskForm());
    setEditingTaskId(null);
    setShowTaskForm(false);
  };
  const openTaskEditor = (task?: any) => {
    if (task) {
      setEditingTaskId(task.id);
      setTaskForm({
        description: task.description || "", facilityId: task.facilityId || "", subFacilityId: task.subFacilityId || "",
        frequency: task.frequency || "MONTHLY", nextDueDate: (task.nextDueDate || today()).slice(0, 10),
        assignedTo: task.assignedTo || "", notes: task.notes || "",
        requiredParts: (task.requiredParts || []).map((part: any) => part.name || part.itemId || "").join(", "),
      });
    } else {
      setEditingTaskId(null);
      setTaskForm({ ...createTaskForm(), facilityId: facilities[0]?.id || "" });
    }
    setShowTaskForm(true);
  };
  const setTaskValue = (key: string, value: any) => setTaskForm((current: any) => ({ ...current, [key]: value }));
  const saveTask = (event: FormEvent) => {
    event.preventDefault();
    if (!canManagePreventive || !taskForm.description.trim() || !taskForm.facilityId || !taskForm.nextDueDate) {
      alert("يرجى استكمال وصف المهمة والمبنى وموعد الاستحقاق.");
      return;
    }
    const existing = tasks.find((item: any) => item.id === editingTaskId);
    const nextNumber = tasks.reduce((highest: number, item: any) => Math.max(highest, Number(item.taskNumber) || 0), 0) + (existing ? 0 : 1);
    const task = {
      ...(existing || {}),
      id: existing?.id || `maintenance-task-${Date.now()}`,
      taskNumber: existing?.taskNumber || nextNumber,
      description: taskForm.description.trim(),
      facilityId: taskForm.facilityId,
      subFacilityId: taskForm.subFacilityId || "",
      frequency: taskForm.frequency,
      nextDueDate: taskForm.nextDueDate,
      assignedTo: taskForm.assignedTo || "",
      notes: taskForm.notes.trim(),
      requiredParts: taskForm.requiredParts.split(",").map((name: string) => name.trim()).filter(Boolean).map((name: string) => ({ name })),
      status: "PENDING",
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    recordAction(
      { maintenancePreventiveTasks: existing ? tasks.map((item: any) => item.id === existing.id ? task : item) : [...tasks, task] },
      existing ? "تعديل مهمة صيانة دورية" : "إنشاء مهمة صيانة دورية",
      `مهمة الصيانة الدورية #${task.taskNumber}: ${task.description}`,
      existing ? "UPDATE" : "CREATE",
    );
    closeTaskForm();
  };
  const deleteTask = (task: any) => {
    if (!canManagePreventive || !window.confirm("هل تريد حذف مهمة الصيانة الدورية؟")) return;
    recordAction(
      { maintenancePreventiveTasks: tasks.filter((item: any) => item.id !== task.id) },
      "حذف مهمة صيانة دورية",
      `حذف المهمة #${task.taskNumber}: ${task.description}`,
      "DELETE",
    );
  };
  const completeTask = (task: any) => {
    if (!canManagePreventive) return;
    const nextDue = new Date();
    switch (task.frequency) {
      case "DAILY": nextDue.setDate(nextDue.getDate() + 1); break;
      case "WEEKLY": nextDue.setDate(nextDue.getDate() + 7); break;
      case "MONTHLY": nextDue.setMonth(nextDue.getMonth() + 1); break;
      case "QUARTERLY": nextDue.setMonth(nextDue.getMonth() + 3); break;
      case "YEARLY": nextDue.setFullYear(nextDue.getFullYear() + 1); break;
      default: nextDue.setMonth(nextDue.getMonth() + 1);
    }
    const updatedTask = {
      ...task,
      lastPerformed: new Date().toISOString(),
      nextDueDate: nextDue.toISOString().slice(0, 10),
      status: "PENDING",
    };
    recordAction(
      { maintenancePreventiveTasks: tasks.map((item: any) => item.id === task.id ? updatedTask : item) },
      "إنجاز وإعادة جدولة صيانة دورية",
      `تم إنجاز ${task.description} والموعد القادم ${updatedTask.nextDueDate}`,
      "UPDATE",
    );
  };

  const closeCustodyForm = () => {
    setCustodyForm(createCustodyForm());
    setEditingCustodyId(null);
    setShowCustodyForm(false);
  };
  const openCustodyEditor = (custody?: any) => {
    if (custody) {
      setEditingCustodyId(custody.id);
      setCustodyForm({
        itemName: custody.itemName || "", assetCode: custody.assetCode || "",
        inventoryId: custody.inventoryId || "", employeeId: custody.employeeId || "",
        facilityId: custody.facilityId || "", subFacilityId: custody.subFacilityId || "", assignedAt: custody.assignedAt || today(),
        notes: custody.notes || "",
      });
    } else {
      setEditingCustodyId(null);
      setCustodyForm({ ...createCustodyForm(), facilityId: facilities[0]?.id || "", subFacilityId: "" });
    }
    setShowCustodyForm(true);
  };
  const setCustodyValue = (key: string, value: any) => setCustodyForm((current: any) => ({ ...current, [key]: value }));
  const saveCustody = (event: FormEvent) => {
    event.preventDefault();
    if (!canManageCustody || !custodyForm.itemName.trim() || !custodyForm.employeeId) {
      alert("يرجى إدخال اسم العهدة واختيار الموظف المسؤول.");
      return;
    }
    const existing = custodies.find((item: any) => item.id === editingCustodyId);
    if (existing?.status === "RETURNED") {
      alert("لا يمكن تعديل عهدة تم إرجاعها.");
      return;
    }
    const person = people.find((item: any) => item.id === custodyForm.employeeId);
    const custody = {
      ...(existing || {}),
      id: existing?.id || `maintenance-custody-${Date.now()}`,
      custodyNumber: existing?.custodyNumber || custodies.reduce((highest: number, item: any) => Math.max(highest, Number(item.custodyNumber) || 0), 0) + 1,
      itemName: custodyForm.itemName.trim(),
      assetCode: custodyForm.assetCode.trim(),
      inventoryId: custodyForm.inventoryId || "",
      employeeId: custodyForm.employeeId,
      employeeName: person?.name || "غير محدد",
      facilityId: custodyForm.facilityId || "",
      subFacilityId: custodyForm.subFacilityId || "",
      assignedAt: custodyForm.assignedAt || today(),
      notes: custodyForm.notes.trim(),
      status: existing?.status || "ACTIVE",
      returnedAt: existing?.returnedAt,
    };
    recordAction(
      { maintenanceCustodies: existing ? custodies.map((item: any) => item.id === existing.id ? custody : item) : [...custodies, custody] },
      existing ? "تعديل بيانات عهدة" : "تسليم عهدة لموظف",
      `العهدة #${custody.custodyNumber}: ${custody.itemName} — ${custody.employeeName}`,
      existing ? "UPDATE" : "CREATE",
    );
    closeCustodyForm();
  };
  const returnCustody = (custody: any) => {
    if (!canManageCustody || !window.confirm(`تأكيد استرجاع العهدة «${custody.itemName}» من ${custody.employeeName || personName(custody.employeeId)}؟`)) return;
    recordAction(
      { maintenanceCustodies: custodies.map((item: any) => item.id === custody.id ? { ...item, status: "RETURNED", returnedAt: new Date().toISOString() } : item) },
      "استرجاع عهدة",
      `تم استرجاع العهدة #${custody.custodyNumber}: ${custody.itemName}`,
      "UPDATE",
    );
  };
  const deleteCustody = (custody: any) => {
    if (!canManageCustody || custody.status === "ACTIVE" || !window.confirm("هل تريد حذف سجل العهدة؟")) return;
    recordAction(
      { maintenanceCustodies: custodies.filter((item: any) => item.id !== custody.id) },
      "حذف سجل عهدة",
      `حذف سجل العهدة #${custody.custodyNumber}: ${custody.itemName}`,
      "DELETE",
    );
  };

  const saveBuildingName = (facility: any) => {
    if (!canManageBuildings) return;
    const name = String(facilityDrafts[facility.id] ?? facility.name).trim();
    if (!name) { alert("اسم المبنى مطلوب."); return; }
    recordAction(
      { maintenanceFacilities: facilities.map((item: any) => item.id === facility.id ? { ...item, name } : item) },
      "تعديل خريطة مباني الصيانة",
      `تم تغيير اسم المبنى ${facility.name} إلى ${name}`,
      "UPDATE",
    );
  };
  const addBuilding = () => {
    if (!canManageBuildings) return;
    const name = window.prompt("اكتب اسم المبنى الجديد:", `مبنى رقم ${facilities.length + 1}`);
    if (!name?.trim()) return;
    const highest = facilities.reduce((max: number, item: any) => Math.max(max, Number(item.facilityNumber) || 0), 0);
    const building = { id: `maintenance-building-${Date.now()}`, facilityNumber: highest + 1, name: name.trim(), subFacilities: [] };
    recordAction(
      { maintenanceFacilities: [...facilities, building] },
      "إضافة مبنى لخريطة الصيانة",
      `تمت إضافة ${building.name} إلى خريطة المنشأة`,
      "CREATE",
    );
  };
  const deleteBuilding = (facility: any) => {
    if (!canManageBuildings) return;
    const inUse = [...orders, ...tasks, ...custodies].some((item: any) => item.facilityId === facility.id);
    if (inUse) { alert("لا يمكن حذف المبنى لأنه مرتبط بطلبات أو مهام أو عهد مسجلة."); return; }
    if (!window.confirm(`حذف ${facility.name} من خريطة المنشأة؟`)) return;
    recordAction(
      { maintenanceFacilities: facilities.filter((item: any) => item.id !== facility.id) },
      "حذف مبنى من خريطة الصيانة",
      `تم حذف ${facility.name} من خريطة المنشأة`,
      "DELETE",
    );
  };

  const openFacilityTreeEditor = (facility: any) => {
    if (!canManageBuildings) return;
    setEditingFacility({
      ...facility,
      subFacilities: normalizeBranchTree(facility.subFacilities || []),
    });
  };
  const addBranch = (path: string[] = []) => {
    if (!canManageBuildings || !editingFacility) return;
    const newNode = createBranchNode("");
    setEditingFacility((current: any) => {
      if (!current) return current;
      if (path.length === 0) {
        return { ...current, subFacilities: [...(current.subFacilities || []), newNode] };
      }
      return {
        ...current,
        subFacilities: updateBranchTree(current.subFacilities || [], path, (node) => ({
          ...node,
          children: [...(node.children || []), newNode],
        })),
      };
    });
  };
  const renameBranch = (path: string[], name: string) => {
    setEditingFacility((current: any) => current ? ({
      ...current,
      subFacilities: updateBranchTree(current.subFacilities || [], path, (node) => ({ ...node, name })),
    }) : current);
  };
  const removeBranch = (path: string[], name: string) => {
    if (!canManageBuildings || !editingFacility) return;
    const findNode = (nodes: any[], ids: string[]): any => {
      const node = (nodes || []).find((item: any) => item.id === ids[0]);
      if (!node) return undefined;
      return ids.length === 1 ? node : findNode(node.children || [], ids.slice(1));
    };
    const collectNodeIds = (node: any): string[] => [
      node.id,
      ...(node.children || []).flatMap((child: any) => collectNodeIds(child)),
    ];
    const target = findNode(editingFacility.subFacilities || [], path);
    const targetIds = new Set(target ? collectNodeIds(target) : path);
    const isReferenced = [...orders, ...tasks, ...custodies].some((record: any) =>
      record.facilityId === editingFacility.id && targetIds.has(record.subFacilityId),
    );
    if (isReferenced) {
      alert("لا يمكن حذف هذا الفرع لأنه مرتبط بطلب صيانة أو مهمة دورية أو عهدة.");
      return;
    }
    if (!window.confirm(`حذف التفرع «${name}» وكل التفرعات التابعة له؟`)) return;
    setEditingFacility((current: any) => current ? ({
      ...current,
      subFacilities: updateBranchTree(current.subFacilities || [], path, () => null),
    }) : current);
  };
  const moveBranch = (path: string[], direction: "up" | "down") => {
    setEditingFacility((current: any) => current ? ({
      ...current,
      subFacilities: moveBranchTree(current.subFacilities || [], path, direction),
    }) : current);
  };
  const branchTreeIsNamed = (nodes: any[]): boolean =>
    (nodes || []).every((node: any) => !!String(node.name || "").trim() && branchTreeIsNamed(node.children || []));
  const saveFacilityTree = () => {
    if (!canManageBuildings || !editingFacility) return;
    const name = String(editingFacility.name || "").trim();
    if (!name) { alert("اسم المبنى مطلوب."); return; }
    if (!branchTreeIsNamed(editingFacility.subFacilities || [])) {
      alert("اكتب اسم كل تفرع جديد قبل حفظ الخريطة.");
      return;
    }
    const saved = {
      ...editingFacility,
      name,
      subFacilities: normalizeBranchTree(editingFacility.subFacilities || []),
    };
    recordAction(
      { maintenanceFacilities: facilities.map((facility: any) => facility.id === saved.id ? saved : facility) },
      "تعديل خريطة المنشأة والتفرعات",
      `تم حفظ المبنى «${saved.name}» مع ${flattenBranchTree(saved.subFacilities).length} تفرعاً متداخلاً`,
      "UPDATE",
    );
    setFacilityDrafts((current) => ({ ...current, [saved.id]: saved.name }));
    setEditingFacility(null);
  };
  const renderSubFacilitiesEditor = (nodes: any[], path: string[] = []): ReactNode => (
    <div className={path.length ? "mr-5 space-y-2 border-r-2 border-border/70 pr-3" : "space-y-3"}>
      {(nodes || []).map((node: any, index: number) => {
        const nodePath = [...path, node.id];
        return (
          <div key={node.id} className="space-y-2 rounded-xl border border-border/70 bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Network size={15} className="shrink-0 text-primary" />
              <input
                className={`${inputClass} min-w-[160px] flex-1`}
                value={node.name}
                onChange={(event) => renameBranch(nodePath, event.target.value)}
                placeholder="اسم الفرع أو الغرفة"
                aria-label="اسم التفرع"
              />
              <button type="button" className={smallButton} onClick={() => addBranch(nodePath)} title="إضافة فرع داخل هذا الفرع"><Plus size={14}/> فرع</button>
              <button type="button" className={smallButton} disabled={index === 0} onClick={() => moveBranch(nodePath, "up")} title="تحريك لأعلى"><ArrowUp size={14}/></button>
              <button type="button" className={smallButton} disabled={index === nodes.length - 1} onClick={() => moveBranch(nodePath, "down")} title="تحريك لأسفل"><ArrowDown size={14}/></button>
              <button type="button" className={smallButton} onClick={() => openQrForLocation(editingFacility, node)} title="توليد QR لهذا الفرع"><QrCode size={14}/> QR</button>
              <button type="button" className={`${smallButton} text-destructive`} onClick={() => removeBranch(nodePath, node.name)} title="حذف التفرع"><Trash2 size={14}/></button>
            </div>
            {node.children?.length ? renderSubFacilitiesEditor(node.children, nodePath) : (
              <p className="mr-6 text-[11px] text-muted-foreground">لا توجد فروع فرعية بعد. استخدم زر «فرع» لإضافة مستوى جديد.</p>
            )}
          </div>
        );
      })}
      {!nodes?.length && path.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">لا توجد تفرعات. أضف الفرع الأول ثم تابع إضافة فروع داخله بلا حد للمستويات.</p>}
    </div>
  );
  const saveStockItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageStock || !maintenanceWarehouse) return;
    const name = stockItemForm.name_ar.trim();
    const quantity = Number(stockItemForm.quantity);
    const minLevel = Number(stockItemForm.min_level);
    const cost = Number(stockItemForm.cost);
    if (!name || !stockItemForm.unit.trim() || !Number.isFinite(quantity) || quantity < 0 ||
        !Number.isFinite(minLevel) || minLevel < 0 || !Number.isFinite(cost) || cost < 0) {
      alert("تحقق من اسم الصنف والوحدة والكمية والتكلفة.");
      return;
    }
    setIsSavingStockItem(true);
    try {
      const item = await inventoryService.upsertInventoryItem({
        name_ar: name,
        unit: stockItemForm.unit.trim(),
        quantity,
        min_level: minLevel,
        cost,
        category: stockItemForm.category.trim() || "قطع غيار صيانة",
      }, undefined, maintenanceWarehouse.id);
      erpStore.logAction("ADMIN", "إضافة صنف إلى مخزن الصيانة", `تم تسجيل الصنف «${item.name_ar}» بكمية ${quantity} ${item.unit} في مخزن الصيانة`, "CREATE");
      setStockItemForm({ name_ar: "", unit: "قطعة", quantity: "0", min_level: "0", cost: "0", category: "قطع غيار صيانة" });
      setShowStockItemForm(false);
      await refreshMaintenanceWarehouse();
    } catch (error: any) {
      alert(error?.message || "تعذر حفظ الصنف في مخزن الصيانة.");
    } finally {
      setIsSavingStockItem(false);
    }
  };
  const stockQuantity = (inventoryId: string) =>
    Number(maintenanceWarehouseStock.find((row: any) => row.inventory_id === inventoryId)?.quantity || 0);
  const issuePartToOrder = async () => {
    if (!canManageStock || !maintenanceWarehouse || !issueOrderId) return;
    const order = (erpStore.getState() as any).maintenanceWorkOrders?.find((item: any) => item.id === issueOrderId);
    const item = maintenanceInventoryItems.find((entry: any) => entry.id === issueForm.inventoryId);
    const quantity = Number(issueForm.quantity);
    const available = item ? stockQuantity(item.id) : 0;
    if (!order || order.financialVoucherId) {
      alert("لا يمكن صرف قطع غيار لطلب غير موجود أو تم ترحيله ماليًا.");
      return;
    }
    if (!item || !Number.isFinite(quantity) || quantity <= 0 || quantity > available) {
      alert("اختر صنفًا والكمية الصحيحة ضمن الرصيد المتاح في مخزن الصيانة.");
      return;
    }

    setIsIssuingPart(true);
    try {
      await inventoryService.addTransaction({
        inventory_id: item.id,
        warehouse_id: maintenanceWarehouse.id,
        type: "out",
        quantity,
        note: `صرف من مخزن الصيانة لطلب #${order.orderNumber}: ${order.title}`,
      });
      const issueCost = Math.max(0, Number(item.cost) || 0) * quantity;
      const latestState = erpStore.getState() as any;
      const latestOrders = latestState.maintenanceWorkOrders || [];
      const latestOrder = latestOrders.find((entry: any) => entry.id === issueOrderId);
      if (!latestOrder) throw new Error("لم يعد طلب الصيانة موجودًا.");
      const issuedPart = {
        id: `maintenance-issue-${Date.now()}`,
        inventoryId: item.id,
        itemName: item.name_ar,
        quantity,
        unit: item.unit,
        unitCost: Number(item.cost) || 0,
        totalCost: issueCost,
        warehouseId: maintenanceWarehouse.id,
        issuedAt: new Date().toISOString(),
      };
      recordAction(
        { maintenanceWorkOrders: latestOrders.map((entry: any) => entry.id === issueOrderId ? {
          ...latestOrder,
          issuedParts: [...(latestOrder.issuedParts || []), issuedPart],
          partsCost: (Number(latestOrder.partsCost) || 0) + issueCost,
        } : entry) },
        "صرف قطع غيار من مخزن الصيانة",
        `تم صرف ${quantity} ${item.unit} من «${item.name_ar}» إلى طلب الصيانة #${order.orderNumber} بتكلفة ${money(issueCost)} ج.م`,
        "TRANSACTION",
      );
      setIssueOrderId(null);
      setIssueForm({ inventoryId: "", quantity: "1" });
      await refreshMaintenanceWarehouse();
    } catch (error: any) {
      alert(error?.message || "تعذر صرف قطع الغيار.");
      await refreshMaintenanceWarehouse().catch(() => undefined);
    } finally {
      setIsIssuingPart(false);
    }
  };

  const filteredOrders = orders.filter((order: any) => {
    const phrase = requestSearch.trim().toLowerCase();
    const haystack = [order.title, order.description, order.orderNumber, locationName(order.facilityId, order.subFacilityId), personName(order.assignedTo?.[0])].join(" ").toLowerCase();
    return (!phrase || haystack.includes(phrase)) && (requestStatus === "ALL" || order.status === requestStatus);
  });
  const filteredTasks = tasks.filter((task: any) =>
    [task.description, locationName(task.facilityId, task.subFacilityId), personName(task.assignedTo)].join(" ").toLowerCase().includes(taskSearch.trim().toLowerCase()),
  );
  const filteredCustodies = custodies.filter((item: any) =>
    [item.itemName, item.assetCode, item.employeeName, personName(item.employeeId), locationName(item.facilityId, item.subFacilityId)].join(" ").toLowerCase().includes(custodySearch.trim().toLowerCase()),
  );

  if (!canView) {
    return <Card className="mx-auto max-w-2xl"><CardHeader><CardTitle>لا توجد صلاحية للدخول</CardTitle><CardDescription>اطلب من مدير النظام تفعيل صلاحية «عرض قسم الصيانة» من صفحة المستخدمين والصلاحيات.</CardDescription></CardHeader></Card>;
  }

  const downloadCsv = () => {
    if (!canExport) return;
    const lines = [
      ["رقم الطلب", "العنوان", "المبنى", "الحالة", "الأولوية", "تاريخ الإنشاء", "تكلفة العمالة", "تكلفة قطع الغيار", "السند المالي"],
      ...orders.map((order: any) => [
        order.orderNumber, order.title, buildingName(order.facilityId), statusLabel(order.status), statusLabel(order.priority),
        order.createdAt, order.laborCost || 0, order.partsCost || 0, order.financialVoucherId || "",
      ]),
    ];
    const csv = "\uFEFF" + lines.map((row) => row.map((cell: any) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "maintenance-report.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: "overview", label: "الرئيسية", icon: Building2 },
    { id: "requests", label: "طلبات الصيانة", icon: ClipboardList },
    { id: "preventive", label: "الصيانة الدورية", icon: CalendarClock },
    { id: "custody", label: "العهد", icon: PackageCheck },
  ];

  return (
    <div className="space-y-6 pb-10 text-right" dir="rtl">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary"><Wrench size={16}/> المختار لإدارة المشروعات</div>
          <h1 className="mt-2 text-2xl font-black">قسم الصيانة</h1>
          <p className="mt-1 text-sm text-muted-foreground">متصل بالموظفين والصلاحيات والمخزون والدفاتر المالية الحالية.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && <Button variant="outline" onClick={downloadCsv}><ClipboardCheck className="ml-2" size={16}/> تصدير تقرير CSV</Button>}
          <Button variant="outline" onClick={() => setActiveTab("overview")}><MapPinned className="ml-2" size={16}/> خريطة المنشأة</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-muted/20 p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
            <Icon size={17}/>{label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric title="طلبات قيد المعالجة" value={openOrders.length} icon={ClipboardList} tone="amber"/>
            <Metric title="مهام دورية متأخرة" value={overdueTasks.length} icon={AlertTriangle} tone="rose"/>
            <Metric title="العهد النشطة" value={activeCustodies.length} icon={PackageCheck} tone="blue"/>
            <Metric title="تكاليف الطلبات المسجلة" value={`${money(totalMaintenanceCost)} ج.م`} icon={CircleDollarSign} tone="emerald"/>
          </div>
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div><CardTitle className="flex items-center gap-2"><MapPinned size={20} className="text-primary"/> خريطة المنشأة</CardTitle><CardDescription>خريطة جديدة بثلاثة مبانٍ فارغة كبداية؛ يمكنك تعديل الأسماء أو إضافة مبانٍ لاحقًا.</CardDescription></div>
              {canManageBuildings && <Button onClick={addBuilding}><Plus className="ml-2" size={16}/> إضافة مبنى</Button>}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {facilities.map((facility: any, index: number) => {
                const facilityOrders = orders.filter((order: any) => order.facilityId === facility.id);
                const facilityTasks = tasks.filter((task: any) => task.facilityId === facility.id);
                const facilityCustodies = custodies.filter((item: any) => item.facilityId === facility.id && item.status === "ACTIVE");
                return <div key={facility.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Building2 size={24}/></span>
                    <div className="flex items-center gap-2">
                      <button type="button" className={smallButton} onClick={() => openQrForLocation(facility)} title="توليد QR لطلب صيانة لهذا المبنى"><QrCode size={14}/> QR</button>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground">{facility.facilityNumber || index + 1}</span>
                    </div>
                  </div>
                  {canManageBuildings ? <div className="space-y-2">
                    <input className={inputClass} value={facilityDrafts[facility.id] ?? facility.name} onChange={(event) => setFacilityDrafts((current) => ({ ...current, [facility.id]: event.target.value }))} aria-label="اسم المبنى"/>
                    <div className="flex gap-2"><button className={`${smallButton} flex-1`} onClick={() => saveBuildingName(facility)}>حفظ الاسم</button><button className={`${smallButton} text-destructive`} onClick={() => deleteBuilding(facility)} title="حذف المبنى"><Trash2 size={14}/></button></div>
                  </div> : <h3 className="text-lg font-black">{facility.name}</h3>}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2"><p className="text-[11px] text-muted-foreground">طلبات</p><p className="font-black">{facilityOrders.length}</p></div>
                    <div className="rounded-lg bg-muted/40 p-2"><p className="text-[11px] text-muted-foreground">دورية</p><p className="font-black">{facilityTasks.length}</p></div>
                    <div className="rounded-lg bg-muted/40 p-2"><p className="text-[11px] text-muted-foreground">عهد</p><p className="font-black">{facilityCustodies.length}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className={smallButton} onClick={() => { setActiveTab("requests"); setOrderForm({ ...createOrderForm(), facilityId: facility.id, subFacilityId: "" }); setEditingOrderId(null); setShowOrderForm(true); }}>طلب صيانة</button>
                    <button className={smallButton} onClick={() => { setActiveTab("preventive"); setTaskForm({ ...createTaskForm(), facilityId: facility.id, subFacilityId: "" }); setEditingTaskId(null); setShowTaskForm(true); }}>مهمة دورية</button>
                    {canManageBuildings && <button className={smallButton} onClick={() => openFacilityTreeEditor(facility)}><Network size={14}/> إدارة التفرعات</button>}
                  </div>
                  {flattenBranchTree(facility.subFacilities || []).length > 0 ? (
                    <div className="mt-4 space-y-1.5 border-r-2 border-border pr-3">
                      {flattenBranchTree(facility.subFacilities || []).map((branch) => (
                        <div key={branch.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-2 text-xs">
                          <span className="font-semibold">{branch.name}</span>
                          <button className={smallButton} onClick={() => openQrForLocation(facility, branch)} title="توليد QR لهذا الفرع"><QrCode size={13}/> QR</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">لا توجد تفرعات؛ يمكنك إضافتها من «إدارة التفرعات».</p>
                  )}
                </div>;
              })}
              {facilities.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">لا توجد مبانٍ في الخريطة. أضف مبنى للبدء.</div>}
            </CardContent>
          </Card>
          {editingFacility && canManageBuildings && (
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>تعديل خريطة التفرعات — {editingFacility.name || "مبنى جديد"}</CardTitle>
                  <CardDescription>أضف الفروع والأقسام والغرف داخل بعضها بلا حد ثابت للمستويات، وأنشئ QR مستقلًا لكل فرع.</CardDescription>
                </div>
                <button className={smallButton} onClick={() => setEditingFacility(null)}><X size={14}/> إغلاق</button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="اسم المبنى الرئيسي">
                  <input className={inputClass} value={editingFacility.name} onChange={(event) => setEditingFacility((current: any) => current ? ({ ...current, name: event.target.value }) : current)} required />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">شجرة الفروع</h3>
                  <Button type="button" variant="outline" onClick={() => addBranch([])}><Plus className="ml-2" size={15}/> إضافة فرع رئيسي</Button>
                </div>
                {renderSubFacilitiesEditor(editingFacility.subFacilities || [])}
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button onClick={saveFacilityTree}><CheckCircle2 className="ml-2" size={16}/> حفظ الخريطة</Button>
                  <Button variant="outline" onClick={() => setEditingFacility(null)}>إلغاء</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Boxes className="text-primary" size={19}/> مخزن الصيانة</CardTitle>
                <CardDescription>مخزن مستقل داخل صفحة المخازن، وأرصدة الأصناف المصروفة هنا تُحدّث حركة المخزون وتكلفة طلب الصيانة.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageStock && <Button onClick={() => setShowStockItemForm((current) => !current)}><PackagePlus className="ml-2" size={16}/> إضافة صنف / رصيد</Button>}
                <Button asChild variant="outline"><Link to="/admin/inventory">فتح صفحة المخازن</Link></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {warehouseLoadError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{warehouseLoadError}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>اسم المخزن: <strong className="text-foreground">{maintenanceWarehouse?.name || "جاري التجهيز…"}</strong></span>
                <span>عدد الأصناف: <strong className="text-foreground">{maintenanceInventoryItems.filter((item: any) => maintenanceWarehouseStock.some((row: any) => row.inventory_id === item.id && Number(row.quantity) > 0)).length}</strong></span>
                <span>إجمالي وحدات الرصيد: <strong className="text-foreground">{money(maintenanceWarehouseStock.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.quantity) || 0), 0))}</strong></span>
              </div>
              {showStockItemForm && canManageStock && <form onSubmit={saveStockItem} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="اسم الصنف"><input className={inputClass} value={stockItemForm.name_ar} onChange={(event) => setStockItemForm((current) => ({ ...current, name_ar: event.target.value }))} required /></Field>
                <Field label="الوحدة"><input className={inputClass} value={stockItemForm.unit} onChange={(event) => setStockItemForm((current) => ({ ...current, unit: event.target.value }))} required /></Field>
                <Field label="الكمية الافتتاحية"><input className={inputClass} type="number" min="0" step="0.01" value={stockItemForm.quantity} onChange={(event) => setStockItemForm((current) => ({ ...current, quantity: event.target.value }))} required /></Field>
                <Field label="حد التنبيه"><input className={inputClass} type="number" min="0" step="0.01" value={stockItemForm.min_level} onChange={(event) => setStockItemForm((current) => ({ ...current, min_level: event.target.value }))} required /></Field>
                <Field label="تكلفة الوحدة (ج.م)"><input className={inputClass} type="number" min="0" step="0.01" value={stockItemForm.cost} onChange={(event) => setStockItemForm((current) => ({ ...current, cost: event.target.value }))} required /></Field>
                <Field label="التصنيف"><input className={inputClass} value={stockItemForm.category} onChange={(event) => setStockItemForm((current) => ({ ...current, category: event.target.value }))} /></Field>
                <div className="flex items-end gap-2">
                  <Button type="submit" disabled={isSavingStockItem || !maintenanceWarehouse}>{isSavingStockItem ? "جاري الحفظ…" : "حفظ الصنف في المخزن"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowStockItemForm(false)}>إلغاء</Button>
                </div>
              </form>}
              {maintenanceWarehouseStock.filter((row: any) => maintenanceInventoryItems.some((item: any) => item.id === row.inventory_id)).length ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-right text-xs text-muted-foreground"><tr><th className="p-3">الصنف</th><th className="p-3">الوحدة</th><th className="p-3">الرصيد</th><th className="p-3">حد التنبيه</th><th className="p-3">تكلفة الوحدة</th></tr></thead>
                    <tbody>
                      {maintenanceWarehouseStock.filter((row: any) => maintenanceInventoryItems.some((item: any) => item.id === row.inventory_id)).map((row: any) => {
                        const item = maintenanceInventoryItems.find((entry: any) => entry.id === row.inventory_id);
                        return <tr key={row.id || row.inventory_id} className="border-t border-border/60">
                          <td className="p-3 font-bold">{item?.name_ar || "صنف غير معروف"}</td>
                          <td className="p-3">{item?.unit || "—"}</td>
                          <td className="p-3 font-black">{money(row.quantity)}</td>
                          <td className="p-3">{money(row.min_level || item?.min_level || 0)}</td>
                          <td className="p-3">{money(item?.cost || 0)} ج.م</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-7 text-center">
                  <Boxes className="mx-auto mb-2 text-muted-foreground" size={26}/>
                  <p className="font-bold">مخزن الصيانة فارغ</p>
                  <p className="mt-1 text-xs text-muted-foreground">لا توجد أرصدة أو بيانات تجريبية. أضف الأصناف الفعلية من هنا أو من صفحة المخازن.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>آخر طلبات الصيانة</CardTitle><CardDescription>آخر خمسة طلبات مسجلة في النظام.</CardDescription></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {[...orders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((order: any) =>
                  <div key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-bold">#{order.orderNumber} — {order.title}</p><p className="mt-1 text-xs text-muted-foreground">{locationName(order.facilityId, order.subFacilityId)} · {dateLabel(order.createdAt)}</p></div>
                    <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-bold">{statusLabel(order.status)}</span>
                  </div>)}
                {orders.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد طلبات صيانة بعد. ستبدأ القائمة فارغة.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "requests" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-black">طلبات الصيانة</h2><p className="text-sm text-muted-foreground">تعيين الطلبات ومتابعة التنفيذ وتكاليف العمالة وقطع الغيار.</p></div>
            <div className="flex flex-wrap gap-2">{canManageRequests && <Button onClick={() => openOrderEditor()}><Plus className="ml-2" size={16}/> طلب جديد</Button>}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute right-3 top-3 text-muted-foreground" size={16}/><input className={`${inputClass} pr-9`} value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="بحث برقم الطلب أو العنوان أو المبنى أو المسؤول"/></div>
            <select className={selectClass} value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}><option value="ALL">كل الحالات</option>{ORDER_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
          </div>
          {showOrderForm && canManageRequests && <Card>
            <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{editingOrderId ? "تعديل طلب الصيانة" : "إنشاء طلب صيانة"}</CardTitle><CardDescription>تُحفظ البيانات في مخزن المختار المحلي وتظهر في لوحة الصيانة والتقارير.</CardDescription></div><button className={smallButton} onClick={closeOrderForm}><X size={16}/></button></CardHeader>
            <CardContent><form onSubmit={saveOrder} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="عنوان الطلب"><input className={inputClass} value={orderForm.title} onChange={(e) => setOrderValue("title", e.target.value)} required/></Field>
              <Field label="المبنى"><select className={selectClass} value={orderForm.facilityId} onChange={(e) => { setOrderValue("facilityId", e.target.value); setOrderValue("subFacilityId", ""); }}><option value="">اختر المبنى</option>{facilities.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="الفرع / الموقع التفصيلي"><select className={selectClass} value={orderForm.subFacilityId || ""} onChange={(e) => setOrderValue("subFacilityId", e.target.value)}><option value="">المبنى بالكامل</option>{branchOptionsFor(orderForm.facilityId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
              <Field label="نوع الصيانة (افصل الأنواع بفاصلة)"><input className={inputClass} value={orderForm.maintenanceType} onChange={(e) => setOrderValue("maintenanceType", e.target.value)} placeholder="كهرباء، تكييف، سباكة"/></Field>
              <Field label="وصف العطل"><textarea className={inputClass} rows={3} value={orderForm.description} onChange={(e) => setOrderValue("description", e.target.value)} required/></Field>
              <Field label="الفني/المسؤول"><select className={selectClass} value={orderForm.assignedTo} onChange={(e) => setOrderValue("assignedTo", e.target.value)}><option value="">غير معيّن</option>{people.map((person: any) => <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}</select></Field>
              <Field label="الموعد النهائي"><input className={inputClass} type="date" value={orderForm.deadline} onChange={(e) => setOrderValue("deadline", e.target.value)}/></Field>
              <Field label="الأولوية"><select className={selectClass} value={orderForm.priority} onChange={(e) => setOrderValue("priority", e.target.value)}>{PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="الحالة"><select className={selectClass} value={orderForm.status} onChange={(e) => setOrderValue("status", e.target.value)}>{ORDER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="قطع الغيار المطلوبة"><input className={inputClass} value={orderForm.requiredParts} onChange={(e) => setOrderValue("requiredParts", e.target.value)} placeholder="قطع الغيار أو المعدات المطلوبة"/></Field>
              <Field label="تكلفة العمالة (ج.م)"><input className={inputClass} type="number" min="0" step="0.01" disabled={!!orders.find((item: any) => item.id === editingOrderId)?.financialVoucherId} value={orderForm.laborCost} onChange={(e) => setOrderValue("laborCost", e.target.value)}/></Field>
              <Field label="تكلفة قطع الغيار (ج.م)"><input className={inputClass} type="number" min="0" step="0.01" disabled={!!orders.find((item: any) => item.id === editingOrderId)?.financialVoucherId} value={orderForm.partsCost} onChange={(e) => setOrderValue("partsCost", e.target.value)}/></Field>
              <div className="flex items-end gap-2"><Button type="submit"><CheckCircle2 className="ml-2" size={16}/>{editingOrderId ? "حفظ التعديلات" : "حفظ الطلب"}</Button><Button type="button" variant="outline" onClick={closeOrderForm}>إلغاء</Button></div>
            </form></CardContent>
          </Card>}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-muted/40 text-right text-xs text-muted-foreground"><tr><th className="p-3">الطلب</th><th className="p-3">المبنى/المسؤول</th><th className="p-3">الأولوية والحالة</th><th className="p-3">التكلفة</th><th className="p-3">الإجراءات</th></tr></thead>
                <tbody>
                  {filteredOrders.map((order: any) => <tr key={order.id} className="border-t border-border/70 align-top">
                    <td className="max-w-xs p-3"><p className="font-black">#{order.orderNumber} — {order.title}</p><p className="mt-1 text-xs text-muted-foreground">{order.description}</p><p className="mt-2 text-[11px] text-muted-foreground">الاستحقاق: {dateLabel(order.deadline)} · الإنشاء: {dateLabel(order.createdAt)}</p></td>
                    <td className="p-3"><p>{locationName(order.facilityId, order.subFacilityId)}</p><p className="mt-1 text-xs text-muted-foreground">{personName(order.assignedTo?.[0])}</p>{order.issuedParts?.length > 0 && <p className="mt-1 text-[11px] text-emerald-700">{order.issuedParts.length} عملية صرف قطع غيار</p>}</td>
                    <td className="p-3"><span className="mb-2 inline-flex rounded-md bg-muted px-2 py-1 text-xs font-bold">{statusLabel(order.priority)}</span>
                      {canManageRequests ? <select className={`${selectClass} min-w-[125px]`} value={order.status} onChange={(e) => changeOrderStatus(order, e.target.value)}>{ORDER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : <p className="text-xs font-bold">{statusLabel(order.status)}</p>}
                    </td>
                    <td className="p-3 whitespace-nowrap"><p className="font-black">{money((Number(order.laborCost) || 0) + (Number(order.partsCost) || 0))} ج.م</p>{order.financialVoucherId ? <p className="mt-1 text-[11px] text-emerald-600">مرحّل للمالية · {order.financialVoucherId}</p> : <p className="mt-1 text-[11px] text-muted-foreground">غير مرحّل ماليًا</p>}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-1.5">
                      {canManageRequests && <button className={smallButton} onClick={() => openOrderEditor(order)}><Pencil size={13}/> تعديل</button>}
                      {canManageStock && !order.financialVoucherId && <button className={smallButton} onClick={() => { setIssueOrderId(order.id); setIssueForm({ inventoryId: "", quantity: "1" }); }}><PackagePlus size={13}/> صرف قطع غيار</button>}
                      {canPostFinance && ["COMPLETED", "CLOSED"].includes(order.status) && !order.financialVoucherId && <button className={`${smallButton} border-emerald-500/40 text-emerald-700`} onClick={() => { setFinanceOrderId(order.id); setFinanceTreasuryId(treasuries[0]?.id || ""); }}><Wallet size={13}/> ترحيل للمالية</button>}
                      {canManageRequests && !order.financialVoucherId && <button className={`${smallButton} text-destructive`} onClick={() => deleteOrder(order)}><Trash2 size={13}/></button>}
                    </div></td>
                  </tr>)}
                  {filteredOrders.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد طلبات مطابقة. ابدأ بإضافة طلب صيانة جديد.</td></tr>}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
          {issueOrderId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <Card className="w-full max-w-lg shadow-2xl">
              <CardHeader>
                <CardTitle>صرف قطع غيار من مخزن الصيانة</CardTitle>
                <CardDescription>سيتم تخفيض رصيد الصنف وتسجيل الصرف ضمن طلب الصيانة نفسه.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="الصنف المتاح في مخزن الصيانة">
                  <select className={selectClass} value={issueForm.inventoryId} onChange={(event) => setIssueForm((current) => ({ ...current, inventoryId: event.target.value }))} required>
                    <option value="">اختر الصنف</option>
                    {maintenanceInventoryItems.filter((item: any) => stockQuantity(item.id) > 0).map((item: any) => (
                      <option key={item.id} value={item.id}>{item.name_ar} — المتاح {money(stockQuantity(item.id))} {item.unit}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الكمية المراد صرفها">
                  <input className={inputClass} type="number" min="0.01" step="0.01" value={issueForm.quantity} onChange={(event) => setIssueForm((current) => ({ ...current, quantity: event.target.value }))} required />
                </Field>
                {issueForm.inventoryId && <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">التكلفة التقديرية: {money((Number(maintenanceInventoryItems.find((item: any) => item.id === issueForm.inventoryId)?.cost) || 0) * (Number(issueForm.quantity) || 0))} ج.م. ستضاف إلى تكلفة قطع الغيار بالطلب.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={issuePartToOrder} disabled={isIssuingPart || !issueForm.inventoryId || !maintenanceWarehouse}>{isIssuingPart ? "جاري الصرف…" : "تأكيد صرف القطع"}</Button>
                  <Button variant="outline" onClick={() => setIssueOrderId(null)} disabled={isIssuingPart}>إلغاء</Button>
                </div>
              </CardContent>
            </Card>
          </div>}

          {financeOrderId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <Card className="w-full max-w-lg shadow-2xl"><CardHeader><CardTitle>ترحيل تكلفة طلب الصيانة للمالية</CardTitle><CardDescription>سيتم إنشاء سند صرف وقيد محاسبي من خلال نظام المختار الحالي.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="الخزينة"><select className={selectClass} value={financeTreasuryId} onChange={(e) => setFinanceTreasuryId(e.target.value)}><option value="">اختر الخزينة</option>{treasuries.map((treasury: any) => <option key={treasury.id} value={treasury.id}>{treasury.name_ar} — {treasury.currency}</option>)}</select></Field>
                <p className="text-xs text-muted-foreground">يتم ترحيل مجموع العمالة وقطع الغيار مرة واحدة فقط لكل طلب.</p>
                <div className="flex flex-wrap gap-2"><Button onClick={() => postOrderExpense(orders.find((order: any) => order.id === financeOrderId))} disabled={!financeTreasuryId}>تأكيد الترحيل المالي</Button><Button variant="outline" onClick={() => { setFinanceOrderId(null); setFinanceTreasuryId(""); }}>إلغاء</Button></div>
              </CardContent>
            </Card>
          </div>}
        </div>
      )}

      {activeTab === "preventive" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-black">الصيانة الدورية</h2><p className="text-sm text-muted-foreground">جدولة المهام حسب المبنى وربط المسؤولين من بيانات الموظفين والمستخدمين.</p></div>
            {canManagePreventive && <Button onClick={() => openTaskEditor()}><Plus className="ml-2" size={16}/> مهمة دورية جديدة</Button>}
          </div>
          <div className="relative"><Search className="absolute right-3 top-3 text-muted-foreground" size={16}/><input className={`${inputClass} pr-9`} value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder="بحث في المهام الدورية"/></div>
          {showTaskForm && canManagePreventive && <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{editingTaskId ? "تعديل المهمة الدورية" : "إضافة مهمة دورية"}</CardTitle><CardDescription>تبدأ قائمة المهام فارغة ويمكنك إنشاء الجدول التشغيلي الخاص بك.</CardDescription></div><button className={smallButton} onClick={closeTaskForm}><X size={16}/></button></CardHeader>
            <CardContent><form onSubmit={saveTask} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="وصف المهمة"><input className={inputClass} value={taskForm.description} onChange={(e) => setTaskValue("description", e.target.value)} required/></Field>
              <Field label="المبنى"><select className={selectClass} value={taskForm.facilityId} onChange={(e) => { setTaskValue("facilityId", e.target.value); setTaskValue("subFacilityId", ""); }} required><option value="">اختر المبنى</option>{facilities.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="الفرع / الموقع التفصيلي"><select className={selectClass} value={taskForm.subFacilityId || ""} onChange={(e) => setTaskValue("subFacilityId", e.target.value)}><option value="">المبنى بالكامل</option>{branchOptionsFor(taskForm.facilityId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
              <Field label="التكرار"><select className={selectClass} value={taskForm.frequency} onChange={(e) => setTaskValue("frequency", e.target.value)}>{FREQUENCIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
              <Field label="موعد الاستحقاق التالي"><input className={inputClass} type="date" value={taskForm.nextDueDate} onChange={(e) => setTaskValue("nextDueDate", e.target.value)} required/></Field>
              <Field label="المسؤول"><select className={selectClass} value={taskForm.assignedTo} onChange={(e) => setTaskValue("assignedTo", e.target.value)}><option value="">غير معيّن</option>{people.map((person: any) => <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}</select></Field>
              <Field label="قطع الغيار / ملاحظات المواد"><input className={inputClass} value={taskForm.requiredParts} onChange={(e) => setTaskValue("requiredParts", e.target.value)} placeholder="افصل الأصناف بفاصلة"/></Field>
              <Field label="ملاحظات"><textarea className={inputClass} rows={2} value={taskForm.notes} onChange={(e) => setTaskValue("notes", e.target.value)}/></Field>
              <div className="flex items-end gap-2"><Button type="submit"><CheckCircle2 className="ml-2" size={16}/>حفظ المهمة</Button><Button type="button" variant="outline" onClick={closeTaskForm}>إلغاء</Button></div>
            </form></CardContent>
          </Card>}
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredTasks.map((task: any) => {
              const late = task.status !== "COMPLETED" && task.nextDueDate < todayDate;
              return <Card key={task.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black">#{task.taskNumber} — {task.description}</p><p className="mt-1 text-xs text-muted-foreground">{locationName(task.facilityId, task.subFacilityId)} · {frequencyLabel(task.frequency)}</p></div><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${late ? "bg-rose-500/10 text-rose-700" : task.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>{late ? "متأخرة" : task.status === "COMPLETED" ? "مكتملة" : "مجدولة"}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">موعد التنفيذ</span><p className="mt-1 font-bold">{dateLabel(task.nextDueDate)}</p></div><div className="rounded-lg bg-muted/40 p-2"><span className="text-muted-foreground">المسؤول</span><p className="mt-1 font-bold">{personName(task.assignedTo)}</p></div></div>
                  {task.notes && <p className="mt-3 text-xs text-muted-foreground">{task.notes}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">{canManagePreventive && <><button className={smallButton} onClick={() => openTaskEditor(task)}><Pencil size={13}/> تعديل</button><button className={`${smallButton} text-emerald-700`} onClick={() => completeTask(task)}><CheckCircle2 size={13}/> تم التنفيذ / جدولة التالية</button><button className={`${smallButton} text-destructive`} onClick={() => deleteTask(task)}><Trash2 size={13}/></button></>}</div>
                </CardContent>
              </Card>;
            })}
          </div>
          {filteredTasks.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد مهام دورية. يمكنك إنشاء أول خطة صيانة من الزر أعلاه.</CardContent></Card>}
        </div>
      )}

      {activeTab === "custody" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black">العهد</h2><p className="text-sm text-muted-foreground">تسليم واسترداد المعدات مع ربط الموظفين من الموارد البشرية والمستخدمين وأصناف المخزون الحالية.</p></div>{canManageCustody && <Button onClick={() => openCustodyEditor()}><Plus className="ml-2" size={16}/> تسجيل عهدة</Button>}</div>
          <div className="relative"><Search className="absolute right-3 top-3 text-muted-foreground" size={16}/><input className={`${inputClass} pr-9`} value={custodySearch} onChange={(e) => setCustodySearch(e.target.value)} placeholder="ابحث باسم العهدة أو الكود أو الموظف أو المبنى"/></div>
          {showCustodyForm && canManageCustody && <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{editingCustodyId ? "تعديل العهدة" : "تسليم عهدة جديدة"}</CardTitle><CardDescription>اختياريًا اربط العهدة بصنف موجود في المخزون.</CardDescription></div><button className={smallButton} onClick={closeCustodyForm}><X size={16}/></button></CardHeader>
            <CardContent><form onSubmit={saveCustody} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="اختيار صنف من المخزون الحالي"><select className={selectClass} value={custodyForm.inventoryId} onChange={(e) => {
                const item: any = inventoryItems.find((row: any) => row.id === e.target.value);
                setCustodyForm((current: any) => ({ ...current, inventoryId: e.target.value, ...(item ? { itemName: item.name_en || item.name_ar || item.item_code, assetCode: item.item_code || item.barcode || current.assetCode } : {}) }));
              }}><option value="">عهدة جديدة / إدخال يدوي</option>{inventoryItems.map((item: any) => <option key={item.id} value={item.id}>{item.name_en || item.name_ar || item.item_code} — {item.item_code}</option>)}</select></Field>
              <Field label="اسم العهدة / الجهاز"><input className={inputClass} value={custodyForm.itemName} onChange={(e) => setCustodyValue("itemName", e.target.value)} required/></Field>
              <Field label="رقم الأصل / الكود"><input className={inputClass} value={custodyForm.assetCode} onChange={(e) => setCustodyValue("assetCode", e.target.value)} /></Field>
              <Field label="الموظف المستلم"><select className={selectClass} value={custodyForm.employeeId} onChange={(e) => setCustodyValue("employeeId", e.target.value)} required><option value="">اختر الموظف أو المستخدم</option>{people.map((person: any) => <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}</select></Field>
              <Field label="المبنى"><select className={selectClass} value={custodyForm.facilityId} onChange={(e) => { setCustodyValue("facilityId", e.target.value); setCustodyValue("subFacilityId", ""); }}><option value="">غير محدد</option>{facilities.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="الفرع / الموقع التفصيلي"><select className={selectClass} value={custodyForm.subFacilityId || ""} onChange={(e) => setCustodyValue("subFacilityId", e.target.value)}><option value="">المبنى بالكامل</option>{branchOptionsFor(custodyForm.facilityId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="تاريخ التسليم"><input className={inputClass} type="date" value={custodyForm.assignedAt} onChange={(e) => setCustodyValue("assignedAt", e.target.value)} required/></Field>
              <Field label="ملاحظات"><textarea className={inputClass} rows={2} value={custodyForm.notes} onChange={(e) => setCustodyValue("notes", e.target.value)}/></Field>
              <div className="flex items-end gap-2"><Button type="submit"><CheckCircle2 className="ml-2" size={16}/>حفظ العهدة</Button><Button type="button" variant="outline" onClick={closeCustodyForm}>إلغاء</Button></div>
            </form></CardContent>
          </Card>}
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-muted/40 text-right text-xs text-muted-foreground"><tr><th className="p-3">العهدة</th><th className="p-3">المستلم</th><th className="p-3">المبنى / التسليم</th><th className="p-3">الحالة</th><th className="p-3">الإجراءات</th></tr></thead>
            <tbody>{filteredCustodies.map((item: any) => <tr key={item.id} className="border-t border-border/70">
              <td className="p-3"><p className="font-black">#{item.custodyNumber} — {item.itemName}</p><p className="mt-1 text-xs text-muted-foreground">{item.assetCode || (item.inventoryId ? "مرتبط بالمخزون" : "بدون كود")}</p></td>
              <td className="p-3">{item.employeeName || personName(item.employeeId)}</td><td className="p-3">{locationName(item.facilityId, item.subFacilityId)}<p className="mt-1 text-xs text-muted-foreground">{dateLabel(item.assignedAt)}</p></td>
              <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "ACTIVE" ? "bg-blue-500/10 text-blue-700" : "bg-emerald-500/10 text-emerald-700"}`}>{statusLabel(item.status)}</span>{item.returnedAt && <p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(item.returnedAt)}</p>}</td>
              <td className="p-3"><div className="flex flex-wrap gap-1.5">{canManageCustody && item.status === "ACTIVE" && <><button className={smallButton} onClick={() => openCustodyEditor(item)}><Pencil size={13}/> تعديل</button><button className={`${smallButton} text-emerald-700`} onClick={() => returnCustody(item)}>استرداد</button></>}{canManageCustody && item.status === "RETURNED" && <button className={`${smallButton} text-destructive`} onClick={() => deleteCustody(item)}><Trash2 size={13}/> حذف</button>}</div></td>
            </tr>)}{filteredCustodies.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد سجلات عهد بعد.</td></tr>}</tbody>
          </table></div></CardContent></Card>
        </div>
      )}

      {qrModalData && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode size={19}/> QR لطلب الصيانة الذاتي</CardTitle><CardDescription>{qrModalData.name}</CardDescription></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-xl border bg-white p-4"><QRCodeSVG value={qrModalData.url} size={240} includeMargin level="M" /></div>
            <p className="w-full break-all rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground" dir="ltr">{qrModalData.url}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.print()} variant="outline"><ClipboardCheck className="ml-2" size={15}/> طباعة QR</Button>
              <Button onClick={() => { void navigator.clipboard?.writeText(qrModalData.url); }} variant="outline">نسخ الرابط</Button>
              <Button onClick={() => setQrModalData(null)}>إغلاق</Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">عند مسح الرمز يفتح نموذج بلاغ يحدد المبنى والفرع تلقائيًا.</p>
          </CardContent>
        </Card>
      </div>}
    </div>
  );
}
