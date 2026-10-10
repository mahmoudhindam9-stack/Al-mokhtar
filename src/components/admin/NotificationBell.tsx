// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { erpStore } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Coins, Calendar, FileText, ChevronLeft, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export function NotificationBell() {
  const navigate = useNavigate();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const notifications = useMemo(() => erpState.notifications || [], [erpState.notifications]);

  const activeCount = notifications.length;

  const handleNotificationClick = (notif: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove notification completely so it disappears from the box upon clicking
    erpStore.removeNotification(notif.id);
    setOpen(false);

    if (notif.target_url) {
      if (notif.target_url.includes("?")) {
        const [path, searchStr] = notif.target_url.split("?");
        const searchParams = new URLSearchParams(searchStr);
        const tab = searchParams.get("tab");
        navigate({ to: path, search: tab ? { tab } : {} });
      } else {
        navigate({ to: notif.target_url });
      }
    }
  };

  const handleRemoveSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    erpStore.removeNotification(id);
  };

  const handleClearAll = () => {
    if (confirm("هل أنت متأكد من مسح جميع التنبيهات الموجودة؟")) {
      erpStore.removeAllNotifications();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`relative h-9 w-9 rounded-xl transition-all ${
            activeCount > 0
              ? "bg-rose-500/10 border-rose-500/50 text-rose-600 ring-2 ring-rose-500/30 animate-pulse shadow-sm"
              : "border-border bg-background hover:bg-muted"
          }`}
          title="شريط التنبيهات والإشعارات الفورية"
        >
          <Bell
            size={18}
            className={activeCount > 0 ? "text-rose-600 font-bold" : "text-foreground"}
          />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-md border-2 border-background animate-bounce">
              {activeCount > 9 ? "9+" : activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border border-border bg-card overflow-hidden"
      >
        {/* Header */}
        <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <span className="font-black text-sm text-foreground">مركز التنبيهات والإشعارات</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                {activeCount} تنبيه نشط
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-[11px] font-bold gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
              title="تفريغ كافة التنبيهات"
            >
              <Trash2 size={13} />
              مسح الكل
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bell size={32} className="mx-auto text-muted-foreground/30" />
              <p className="text-xs font-bold text-muted-foreground">
                لا توجد تنبيهات حالياً في صندوق الإشعارات
              </p>
            </div>
          ) : (
            notifications.map((notif: any) => (
              <div
                key={notif.id}
                onClick={(e) => handleNotificationClick(notif, e)}
                className="p-3 text-right hover:bg-muted/60 cursor-pointer transition flex items-start gap-3 bg-amber-500/5 dark:bg-amber-500/10 border-r-4 border-amber-500 group"
              >
                <div
                  className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                    notif.type === "hr_advance"
                      ? "bg-amber-500/20 text-amber-600"
                      : notif.type === "hr_vacation"
                        ? "bg-blue-500/20 text-blue-600"
                        : "bg-emerald-500/20 text-emerald-600"
                  }`}
                >
                  {notif.type === "hr_advance" ? (
                    <Coins size={16} />
                  ) : notif.type === "hr_vacation" ? (
                    <Calendar size={16} />
                  ) : (
                    <FileText size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs text-foreground truncate">
                      {notif.title}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => handleRemoveSingle(notif.id, e)}
                      className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                      title="حذف هذا التنبيه"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-semibold leading-tight">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground/80">
                    <span>
                      {notif.created_at
                        ? new Date(notif.created_at).toLocaleDateString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                    <span className="text-primary font-bold flex items-center gap-0.5 group-hover:underline">
                      متابعة وإخفاء
                      <ChevronLeft size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
