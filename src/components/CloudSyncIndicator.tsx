import { useEffect, useState } from "react";
import {
  getCloudSyncStatus,
  resolveCloudConflict,
  type CloudSyncStatus,
} from "@/shared/services/cloudSync";

const STATUS_EVENT = "restocash-cloud-sync-status";

function statusClasses(status: CloudSyncStatus["kind"]): string {
  switch (status) {
    case "synced":
      return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "syncing":
      return "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200";
    case "conflict":
    case "error":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
    default:
      return "border-border bg-background/95 text-muted-foreground";
  }
}

export function CloudSyncIndicator() {
  const [status, setStatus] = useState<CloudSyncStatus>(getCloudSyncStatus);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const onStatus = (event: Event) => {
      setStatus((event as CustomEvent<CloudSyncStatus>).detail);
    };
    window.addEventListener(STATUS_EVENT, onStatus);
    return () => window.removeEventListener(STATUS_EVENT, onStatus);
  }, []);

  if (status.kind === "idle") return null;

  const choose = async (choice: "keep-local" | "use-cloud") => {
    setResolving(true);
    try {
      await resolveCloudConflict(choice);
    } finally {
      setResolving(false);
    }
  };

  return (
    <aside
      className={`fixed bottom-4 right-4 z-[100] max-w-[min(92vw,25rem)] rounded-xl border px-3 py-2 text-xs shadow-lg ${statusClasses(status.kind)}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="font-semibold">{status.message}</p>
      {status.kind === "conflict" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void choose("keep-local")}
            className="rounded-md border border-current/30 px-2 py-1 font-bold disabled:opacity-50"
          >
            اعتماد بيانات هذا الجهاز
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void choose("use-cloud")}
            className="rounded-md border border-current/30 px-2 py-1 font-bold disabled:opacity-50"
          >
            اعتماد النسخة السحابية
          </button>
        </div>
      )}
    </aside>
  );
}
