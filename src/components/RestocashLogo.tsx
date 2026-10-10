import { Building2, FolderKanban } from "lucide-react";
import React from "react";

export function RestocashLogo({
  className = "",
  size = 24,
  variant = "default",
  showDeveloper = true,
}: {
  className?: string;
  size?: number;
  variant?: "default" | "white";
  showDeveloper?: boolean;
}) {
  const isWhite = variant === "white";
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 font-black tracking-tight">
        <div
          className={`relative flex items-center justify-center p-1.5 rounded-xl ${
            isWhite
              ? "bg-white/15 text-white"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}
        >
          <Building2 size={size} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col text-right">
          <span
            className={
              isWhite
                ? "text-white font-black"
                : "bg-gradient-to-l from-primary via-emerald-600 to-primary bg-clip-text text-transparent font-black"
            }
            style={{ fontSize: size * 0.9, lineHeight: 1.1 }}
          >
            المختار
          </span>
          <span
            className={`font-bold tracking-tight ${
              isWhite ? "text-white/80" : "text-emerald-600 dark:text-emerald-400"
            }`}
            style={{ fontSize: Math.max(10, size * 0.45) }}
          >
            لإدارة المشروعات
          </span>
        </div>
      </div>
      {showDeveloper && (
        <span
          className={`text-[0.45em] font-medium opacity-80 tracking-wide block mt-0.5 ${
            isWhite ? "text-white/70" : "text-slate-500"
          }`}
          style={{ fontSize: Math.max(9, size * 0.35) }}
        >
          نظام الإدارة والمحاسبة ERP
        </span>
      )}
    </div>
  );
}

export const AlMokhtarLogo = RestocashLogo;
