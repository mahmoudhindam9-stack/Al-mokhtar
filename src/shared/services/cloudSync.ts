import { supabase } from "@/integrations/supabase/client";
import { erpStore } from "@/shared/services/erpStore";

export type CloudSyncStatus =
  | { kind: "idle"; message: string }
  | { kind: "offline"; message: string }
  | { kind: "needs-auth"; message: string }
  | { kind: "syncing"; message: string }
  | { kind: "synced"; message: string; updatedAt?: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export type ConflictChoice = "keep-local" | "use-cloud";

type SnapshotRow = {
  user_id: string;
  state: Record<string, any>;
  revision: number | string;
  updated_at: string;
};

type SyncMeta = {
  revision: number;
  fingerprint: string;
};

const STATUS_EVENT = "restocash-cloud-sync-status";
const META_PREFIX = "restocash-cloud-sync-meta:";
const DEFAULT_USER_IDS = new Set(["u-admin", "u-manager", "u-cashier"]);
let currentStatus: CloudSyncStatus = {
  kind: "idle",
  message: "لم تبدأ المزامنة بعد",
};
let syncInProgress = false;
let applyingCloudState = false;

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentStatus;
}

function setStatus(status: CloudSyncStatus) {
  currentStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<CloudSyncStatus>(STATUS_EVENT, { detail: status }));
  }
}

function withoutSensitiveFields(value: any): any {
  if (Array.isArray(value)) return value.map(withoutSensitiveFields);
  if (!value || typeof value !== "object") return value;

  const safe: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/(password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization)/i.test(key)) {
      continue;
    }
    safe[key] = withoutSensitiveFields(child);
  }
  return safe;
}

function sanitizeState(source: Record<string, any>): Record<string, any> {
  const clone = withoutSensitiveFields(JSON.parse(JSON.stringify(source || {})));
  // The active user is device/session specific, not shared application data.
  delete clone.currentUser;
  return clone;
}

function fingerprint(source: Record<string, any>): string {
  return JSON.stringify(sanitizeState(source));
}

function metaKey(userId: string): string {
  return `${META_PREFIX}${userId}`;
}

function readMeta(userId: string): SyncMeta | null {
  try {
    const raw = window.localStorage.getItem(metaKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(Number(parsed.revision)) || typeof parsed.fingerprint !== "string") {
      return null;
    }
    return { revision: Number(parsed.revision), fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
}

function writeMeta(userId: string, revision: number, state = erpStore.getState()) {
  try {
    const meta: SyncMeta = { revision, fingerprint: fingerprint(state) };
    window.localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch (error) {
    console.warn("[CloudSync] Could not store local sync metadata", error);
  }
}

function hasBusinessData(state: Record<string, any>): boolean {
  const collectionKeys = [
    "journalEntries",
    "deletedJournalEntries",
    "orders",
    "sales_invoices",
    "purchaseOrders",
    "treasuryTransactions",
    "vouchers",
    "inventoryDocuments",
    "mallShops",
    "mallPayments",
    "mallGardenRevenues",
    "mallGardenExpenses",
    "mallTerminatedContractsArchive",
    "employees",
    "attendance",
    "loans",
    "payrolls",
    "parkTicketTransactions",
    "parkShifts",
    "restaurantShifts",
    "restaurantRefundRecords",
    "suppliers",
    "purchaseInvoices",
  ];
  if (collectionKeys.some((key) => Array.isArray(state[key]) && state[key].length > 0)) {
    return true;
  }
  return (state.users || []).some((user: any) => user?.id && !DEFAULT_USER_IDS.has(user.id));
}

async function canReachCloud(): Promise<boolean> {
  const baseUrl = String((supabase as any).supabaseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return false;
  try {
    // Use the native fetch rather than the fallback Supabase fetch wrapper so real network failures remain detectable.
    await fetch(`${baseUrl}/auth/v1/health`, { method: "GET", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user?.id) {
    setStatus({
      kind: "needs-auth",
      message: "العمل المحلي متاح؛ سجّل الدخول بحساب سحابي لتفعيل المزامنة",
    });
    return null;
  }
  return data.session.user;
}

async function getSnapshot(userId: string): Promise<SnapshotRow | null> {
  const { data, error } = await (supabase as any)
    .from("erp_state_snapshots")
    .select("user_id,state,revision,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SnapshotRow | null) ?? null;
}

async function saveSnapshot(
  userId: string,
  remote: SnapshotRow | null,
): Promise<SnapshotRow | null> {
  const nextRevision = remote ? Number(remote.revision) + 1 : 1;
  const payload = {
    user_id: userId,
    state: sanitizeState(erpStore.getState()),
    revision: nextRevision,
    updated_at: new Date().toISOString(),
  };

  const query = (supabase as any).from("erp_state_snapshots");
  const result = remote
    ? await query
        .update(payload)
        .eq("user_id", userId)
        .eq("revision", Number(remote.revision))
        .select("user_id,state,revision,updated_at")
        .maybeSingle()
    : await query
        .insert(payload)
        .select("user_id,state,revision,updated_at")
        .maybeSingle();

  if (result.error) {
    // A concurrent first install can win the unique user_id constraint; the next pass re-reads it.
    if (!remote && /duplicate|unique|23505/i.test(String(result.error.message || ""))) {
      return null;
    }
    throw result.error;
  }
  return (result.data as SnapshotRow | null) ?? null;
}

function applySnapshot(remoteState: Record<string, any>) {
  const localState = erpStore.getState() as Record<string, any>;
  const localUsers = Array.isArray(localState.users) ? localState.users : [];
  const incoming = JSON.parse(JSON.stringify(remoteState || {}));
  const userById = new Map(localUsers.map((user: any) => [user.id, user]));
  const userByName = new Map(
    localUsers.map((user: any) => [String(user.username || "").toLowerCase(), user]),
  );

  incoming.users = (incoming.users || []).map((user: any) => {
    const localUser =
      userById.get(user.id) || userByName.get(String(user.username || "").toLowerCase());
    // Passwords stay device-local. The cloud snapshot deliberately never contains them.
    return localUser?.password === undefined ? user : { ...user, password: localUser.password };
  });

  applyingCloudState = true;
  try {
    erpStore.state = {
      ...erpStore.getDefaultState(),
      ...incoming,
      users: incoming.users || localUsers,
      currentUser: localState.currentUser,
      _updatedAt: Date.now(),
    };
    erpStore.recalculateAccountBalances?.();
    erpStore.saveState();
  } finally {
    applyingCloudState = false;
  }
}

async function syncOnce() {
  if (syncInProgress || typeof window === "undefined") return;
  if (currentStatus.kind === "conflict") return;

  if (!navigator.onLine || !(await canReachCloud())) {
    setStatus({
      kind: "offline",
      message: "لا يوجد اتصال فعلي بالسحابة — بياناتك مستمرة في الحفظ محليًا",
    });
    return;
  }

  syncInProgress = true;
  setStatus({ kind: "syncing", message: "جاري مزامنة البيانات مع السحابة…" });
  try {
    const user = await getAuthenticatedUser();
    if (!user) return;

    const remote = await getSnapshot(user.id);
    const local = erpStore.getState() as Record<string, any>;
    const localFingerprint = fingerprint(local);
    const meta = readMeta(user.id);

    if (!remote) {
      const created = await saveSnapshot(user.id, null);
      if (!created) {
        setStatus({
          kind: "conflict",
          message: "ظهرت نسخة سحابية متزامنة في الوقت نفسه؛ اختر النسخة التي تريد الاحتفاظ بها",
        });
        return;
      }
      writeMeta(user.id, Number(created.revision));
      setStatus({
        kind: "synced",
        message: "تم حفظ نسخة السحابة بنجاح",
        updatedAt: created.updated_at,
      });
      return;
    }

    const remoteRevision = Number(remote.revision);
    if (!meta) {
      const localHasData = hasBusinessData(local);
      const cloudHasData = hasBusinessData(remote.state || {});
      if (localHasData && cloudHasData) {
        setStatus({
          kind: "conflict",
          message: "توجد بيانات محلية وسحابية معًا؛ اختر النسخة المطلوبة لتجنب فقد بيانات مالية",
        });
        return;
      }
      if (cloudHasData) {
        applySnapshot(remote.state || {});
        writeMeta(user.id, remoteRevision);
        setStatus({
          kind: "synced",
          message: "تم تنزيل بيانات السحابة إلى هذا الجهاز",
          updatedAt: remote.updated_at,
        });
        return;
      }
      const updated = await saveSnapshot(user.id, remote);
      if (!updated) {
        setStatus({
          kind: "conflict",
          message: "تغيّرت النسخة السحابية أثناء الحفظ؛ اختر النسخة المطلوبة",
        });
        return;
      }
      writeMeta(user.id, Number(updated.revision));
      setStatus({
        kind: "synced",
        message: "تمت المزامنة الأولى بنجاح",
        updatedAt: updated.updated_at,
      });
      return;
    }

    const localChanged = localFingerprint !== meta.fingerprint;
    if (remoteRevision === meta.revision) {
      if (!localChanged) {
        setStatus({
          kind: "synced",
          message: "البيانات المحلية والسحابية متزامنة",
          updatedAt: remote.updated_at,
        });
        return;
      }
      const updated = await saveSnapshot(user.id, remote);
      if (!updated) {
        setStatus({
          kind: "conflict",
          message: "تغيّرت النسخة السحابية أثناء الحفظ؛ لم نستبدل أي بيانات تلقائيًا",
        });
        return;
      }
      writeMeta(user.id, Number(updated.revision));
      setStatus({
        kind: "synced",
        message: "تم رفع التعديلات المحلية بنجاح",
        updatedAt: updated.updated_at,
      });
      return;
    }

    if (localChanged) {
      setStatus({
        kind: "conflict",
        message: "توجد تعديلات محلية وسحابية متزامنة؛ اختر النسخة المطلوبة لتجنب فقد البيانات",
      });
      return;
    }

    applySnapshot(remote.state || {});
    writeMeta(user.id, remoteRevision);
    setStatus({
      kind: "synced",
      message: "تم تحديث البيانات من السحابة",
      updatedAt: remote.updated_at,
    });
  } catch (error: any) {
    console.error("[CloudSync] Synchronization failed", error);
    setStatus({
      kind: "error",
      message: "تعذرت المزامنة؛ بياناتك المحلية محفوظة ولم تُحذف",
    });
  } finally {
    syncInProgress = false;
  }
}

export async function resolveCloudConflict(choice: ConflictChoice): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine || !(await canReachCloud())) {
    setStatus({
      kind: "offline",
      message: "لا يوجد اتصال بالسحابة؛ لم يتم تغيير النسخة المحلية",
    });
    return;
  }
  setStatus({ kind: "syncing", message: "جاري معالجة تعارض المزامنة…" });
  try {
    const user = await getAuthenticatedUser();
    if (!user) return;
    const remote = await getSnapshot(user.id);

    if (choice === "use-cloud") {
      if (!remote) throw new Error("لا توجد نسخة سحابية لاستخدامها");
      applySnapshot(remote.state || {});
      writeMeta(user.id, Number(remote.revision));
      setStatus({
        kind: "synced",
        message: "تم اعتماد النسخة السحابية على هذا الجهاز",
        updatedAt: remote.updated_at,
      });
      return;
    }

    const updated = await saveSnapshot(user.id, remote);
    if (!updated) {
      setStatus({
        kind: "conflict",
        message: "تغيرت النسخة السحابية مجددًا؛ راجعها ثم أعد اختيار النسخة",
      });
      return;
    }
    writeMeta(user.id, Number(updated.revision));
    setStatus({
      kind: "synced",
      message: "تم اعتماد النسخة المحلية ورفعها إلى السحابة",
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error("[CloudSync] Conflict resolution failed", error);
    setStatus({
      kind: "error",
      message: "تعذرت معالجة التعارض؛ ما زالت بيانات الجهاز محفوظة",
    });
  }
}

export function startCloudSync(): () => void {
  if (typeof window === "undefined") return () => {};

  let debounceTimer = 0;
  const scheduleSync = () => {
    if (applyingCloudState || currentStatus.kind === "conflict") return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void syncOnce(), 1800);
  };
  const onOnline = () => void syncOnce();
  const onFocus = () => void syncOnce();
  const unsubscribeStore = erpStore.subscribe(scheduleSync);
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) window.setTimeout(() => void syncOnce(), 0);
  });
  const interval = window.setInterval(() => void syncOnce(), 45_000);

  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  void syncOnce();

  return () => {
    window.clearTimeout(debounceTimer);
    window.clearInterval(interval);
    unsubscribeStore();
    data.subscription.unsubscribe();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
  };
}
