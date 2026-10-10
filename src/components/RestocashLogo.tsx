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
    <div className={`inline-flex items-center gap-2.5 ${className}`} dir="rtl">
      <img
        src="/al-mokhtar-mark.svg"
        alt=""
        aria-hidden="true"
        className="shrink-0 object-contain drop-shadow-sm"
        style={{ width: Math.max(34, size * 1.55), height: Math.max(34, size * 1.55) }}
      />
      <div className="min-w-0 flex flex-col text-right">
        <span
          className={isWhite ? "font-black text-white" : "font-black text-[#102b45] dark:text-[#f4d58b]"}
          style={{ fontSize: size * 0.9, lineHeight: 1.13, letterSpacing: "-0.035em" }}
        >
          المختار
        </span>
        <span
          className={isWhite ? "font-bold text-white/85" : "font-bold text-[#b48732] dark:text-[#e7bf64]"}
          style={{ fontSize: Math.max(10, size * 0.45), lineHeight: 1.35 }}
        >
          لإدارة المشروعات
        </span>
        {showDeveloper && (
          <span
            className={isWhite ? "mt-0.5 text-white/65" : "mt-0.5 text-slate-500 dark:text-slate-400"}
            style={{ fontSize: Math.max(9, size * 0.32), lineHeight: 1.35 }}
          >
            نظام الإدارة والمحاسبة ERP
          </span>
        )}
      </div>
    </div>
  );
}

export const AlMokhtarLogo = RestocashLogo;
