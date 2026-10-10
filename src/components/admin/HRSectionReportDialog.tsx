// @ts-nocheck
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Printer, Calendar, Users, Filter, FileText, CheckCircle2 } from "lucide-react";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import type { Employee } from "@/shared/services/erpStore";

export interface HRSectionReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: "employees" | "attendance" | "payroll" | "loans" | "advances" | "vacations";
  employees: Employee[];
  erpState: any;
}

const SECTION_TITLES: Record<string, string> = {
  employees: "تقرير دليل الكادر الوظيفي والملفات",
  attendance: "تقرير كشف الحضور والإنصراف اليومي والدوام",
  payroll: "تقرير مسيرات الرواتب والأجور الشهرية",
  loans: "تقرير القروض والسلف المالية الممنوحة",
  advances: "تقرير طلبات السلف المالية المقدمة",
  vacations: "تقرير طلبات الأجازات والغياب المعتمد",
};

export function HRSectionReportDialog({
  open,
  onOpenChange,
  section,
  employees = [],
  erpState,
}: HRSectionReportDialogProps) {
  const [filterType, setFilterType] = useState<"all" | "day" | "month" | "year" | "range">("all");
  const [singleDate, setSingleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");

  const title = SECTION_TITLES[section] || "تقرير الموارد البشرية";

  // Filtered dataset generator based on current controls
  const filteredReportData = useMemo(() => {
    if (!erpState) return { items: [], summary: {} };

    const selectedEmp = employees.find((e) => e.id === selectedEmpId);
    const empNameFilter = selectedEmp ? selectedEmp.name : "";

    if (section === "employees") {
      let list = [...(erpState.employees || [])];
      if (selectedEmpId !== "all") {
        list = list.filter((e) => e.id === selectedEmpId);
      }
      const totalSalary = list.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
      return {
        items: list,
        summary: {
          count: list.length,
          totalSalary,
        },
      };
    }

    if (section === "attendance") {
      let list = [...(erpState.attendance || [])];

      // Date filtering
      if (filterType === "day") {
        list = list.filter((a) => a.date === singleDate);
      } else if (filterType === "month") {
        list = list.filter((a) => a.date.startsWith(selectedMonth));
      } else if (filterType === "year") {
        list = list.filter((a) => a.date.startsWith(selectedYear));
      } else if (filterType === "range") {
        list = list.filter((a) => a.date >= fromDate && a.date <= toDate);
      }

      // Employee filtering
      if (selectedEmpId !== "all") {
        list = list.filter((a) => a.employee_id === selectedEmpId);
      }

      const present = list.filter((a) => a.status === "present").length;
      const absent = list.filter((a) => a.status === "absent").length;
      const late = list.filter((a) => a.status === "late").length;
      const leave = list.filter((a) => a.status === "leave").length;

      return {
        items: list,
        summary: { count: list.length, present, absent, late, leave },
      };
    }

    if (section === "payroll") {
      let list = [...(erpState.payrolls || [])];

      if (filterType === "month") {
        list = list.filter((p) => p.month === selectedMonth);
      } else if (filterType === "year") {
        list = list.filter((p) => p.month.startsWith(selectedYear));
      } else if (filterType === "range") {
        const fromM = fromDate.slice(0, 7);
        const toM = toDate.slice(0, 7);
        list = list.filter((p) => p.month >= fromM && p.month <= toM);
      }

      if (selectedEmpId !== "all") {
        list = list.filter((p) => p.employee_id === selectedEmpId);
      }

      const totalBasic = list.reduce((s, p) => s + (p.basic_salary || 0), 0);
      const totalBonuses = list.reduce((s, p) => s + (p.bonuses || 0), 0);
      const totalDeductions = list.reduce((s, p) => s + (p.deductions || 0), 0);
      const totalLoans = list.reduce((s, p) => s + (p.loan_deduction || 0), 0);
      const totalNet = list.reduce((s, p) => s + (p.net_salary || 0), 0);

      return {
        items: list,
        summary: {
          count: list.length,
          totalBasic,
          totalBonuses,
          totalDeductions,
          totalLoans,
          totalNet,
        },
      };
    }

    if (section === "loans") {
      let list = [...(erpState.loans || [])];

      if (filterType === "day") {
        list = list.filter((l) => l.date === singleDate);
      } else if (filterType === "month") {
        list = list.filter((l) => l.date && l.date.startsWith(selectedMonth));
      } else if (filterType === "year") {
        list = list.filter((l) => l.date && l.date.startsWith(selectedYear));
      } else if (filterType === "range") {
        list = list.filter((l) => l.date && l.date >= fromDate && l.date <= toDate);
      }

      if (selectedEmpId !== "all") {
        list = list.filter((l) => l.employee_id === selectedEmpId);
      }

      const totalAmount = list.reduce((s, l) => s + (l.amount || 0), 0);
      const totalPaid = list.reduce((s, l) => s + (l.paid_amount || 0), 0);
      const totalRemaining = totalAmount - totalPaid;

      return {
        items: list,
        summary: { count: list.length, totalAmount, totalPaid, totalRemaining },
      };
    }

    if (section === "advances") {
      let list = [...(erpState.hrAdvances || [])];

      if (filterType === "day") {
        list = list.filter((a) => a.created_at && a.created_at.split("T")[0] === singleDate);
      } else if (filterType === "month") {
        list = list.filter((a) => a.created_at && a.created_at.startsWith(selectedMonth));
      } else if (filterType === "year") {
        list = list.filter((a) => a.created_at && a.created_at.startsWith(selectedYear));
      } else if (filterType === "range") {
        list = list.filter((a) => {
          const d = a.created_at ? a.created_at.split("T")[0] : "";
          return d >= fromDate && d <= toDate;
        });
      }

      if (selectedEmpId !== "all") {
        list = list.filter(
          (a) => a.employee_id === selectedEmpId || (empNameFilter && a.employee_name === empNameFilter),
        );
      }

      const totalRequested = list.reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const approvedCount = list.filter((a) => a.status === "approved").length;
      const rejectedCount = list.filter((a) => a.status === "rejected").length;
      const pendingCount = list.filter((a) => a.status === "pending").length;

      return {
        items: list,
        summary: {
          count: list.length,
          totalRequested,
          approvedCount,
          rejectedCount,
          pendingCount,
        },
      };
    }

    if (section === "vacations") {
      let list = [...(erpState.hrVacations || [])];

      if (filterType === "day") {
        list = list.filter((v) => v.start_date <= singleDate && v.end_date >= singleDate);
      } else if (filterType === "month") {
        list = list.filter(
          (v) =>
            (v.start_date && v.start_date.startsWith(selectedMonth)) ||
            (v.end_date && v.end_date.startsWith(selectedMonth)),
        );
      } else if (filterType === "year") {
        list = list.filter((v) => v.start_date && v.start_date.startsWith(selectedYear));
      } else if (filterType === "range") {
        list = list.filter((v) => v.start_date <= toDate && v.end_date >= fromDate);
      }

      if (selectedEmpId !== "all") {
        list = list.filter(
          (v) => v.employee_id === selectedEmpId || (empNameFilter && v.employee_name === empNameFilter),
        );
      }

      const totalDays = list.reduce((s, v) => s + (Number(v.days_count) || 0), 0);
      const approvedCount = list.filter((v) => v.status === "approved").length;
      const rejectedCount = list.filter((v) => v.status === "rejected").length;
      const pendingCount = list.filter((v) => v.status === "pending").length;

      return {
        items: list,
        summary: {
          count: list.length,
          totalDays,
          approvedCount,
          rejectedCount,
          pendingCount,
        },
      };
    }

    return { items: [], summary: {} };
  }, [
    section,
    filterType,
    singleDate,
    selectedMonth,
    selectedYear,
    fromDate,
    toDate,
    selectedEmpId,
    erpState,
    employees,
  ]);

  const handlePrint = () => {
    const selectedEmp = employees.find((e) => e.id === selectedEmpId);
    const empLabel = selectedEmp ? selectedEmp.name : "كافة الموظفين والكادر";

    let dateCriteriaText = "كافة التواريخ والسجلات";
    if (filterType === "day") dateCriteriaText = `ليوم تاريخ (${singleDate})`;
    else if (filterType === "month") dateCriteriaText = `عن شهر (${selectedMonth})`;
    else if (filterType === "year") dateCriteriaText = `عن سنة (${selectedYear})`;
    else if (filterType === "range")
      dateCriteriaText = `عن الفترة من (${fromDate}) إلى (${toDate})`;

    const printDateStr = `${new Date().toLocaleDateString("ar-EG")} ${new Date().toLocaleTimeString("ar-EG")}`;

    // Build Table Rows & Headers per section
    let tableHeadersHtml = "";
    let tableRowsHtml = "";
    let summaryBoxHtml = "";

    const { items, summary } = filteredReportData;

    if (section === "employees") {
      tableHeadersHtml = `
        <th>#</th>
        <th>كود/حساب</th>
        <th>اسم الموظف</th>
        <th>القسم الإداري</th>
        <th>المسمى الوظيفي</th>
        <th>الهاتف</th>
        <th>تاريخ التعيين</th>
        <th>الراتب الأساسي</th>
      `;
      tableRowsHtml = items
        .map(
          (emp, idx) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="font-family:monospace; font-weight:bold;">${emp.account_code || emp.id || "-"}</td>
          <td style="font-weight:bold;">${emp.name}</td>
          <td>${emp.department || "-"}</td>
          <td>${emp.job_title || "-"}</td>
          <td style="font-family:monospace;">${emp.phone || "-"}</td>
          <td style="font-family:monospace;">${emp.hire_date || "-"}</td>
          <td style="font-weight:bold; color:#166534;">${(Number(emp.salary) || 0).toLocaleString()} ج.م</td>
        </tr>
      `,
        )
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>إجمالي عدد الموظفين: <strong>${summary.count} موظف</strong></span>
          <span>إجمالي كلفة الرواتب الأساسية: <strong>${(summary.totalSalary || 0).toLocaleString()} ج.م</strong></span>
        </div>
      `;
    } else if (section === "attendance") {
      tableHeadersHtml = `
        <th>#</th>
        <th>اسم الموظف</th>
        <th>القسم الإداري</th>
        <th>التاريخ</th>
        <th>حالة الحضور والدوام</th>
        <th>ملاحظات</th>
      `;
      tableRowsHtml = items
        .map((att, idx) => {
          const emp = employees.find((e) => e.id === att.employee_id);
          const stLabel =
            att.status === "present"
              ? "<span class='badge present'>حاضر</span>"
              : att.status === "late"
                ? "<span class='badge late'>متأخر</span>"
                : att.status === "absent"
                  ? "<span class='badge absent'>غائب</span>"
                  : "<span class='badge leave'>إجازة معتمدة</span>";
          return `
            <tr>
              <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
              <td style="font-weight:bold;">${emp ? emp.name : att.employee_id}</td>
              <td>${emp ? emp.department : "-"}</td>
              <td style="font-family:monospace; font-weight:bold;">${att.date}</td>
              <td>${stLabel}</td>
              <td>${att.notes || "-"}</td>
            </tr>
          `;
        })
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>إجمالي السجلات: <strong>${summary.count}</strong></span>
          <span>حاضر: <strong style="color:#15803d;">${summary.present}</strong></span>
          <span>متأخر: <strong style="color:#b45309;">${summary.late}</strong></span>
          <span>غائب: <strong style="color:#b91c1c;">${summary.absent}</strong></span>
          <span>إجازة: <strong style="color:#0284c7;">${summary.leave}</strong></span>
        </div>
      `;
    } else if (section === "payroll") {
      tableHeadersHtml = `
        <th>#</th>
        <th>اسم الموظف</th>
        <th>الشهر</th>
        <th>الراتب الأساسي</th>
        <th>المكافآت</th>
        <th>الخصومات</th>
        <th>خصم السلف</th>
        <th>صافي المفهوم</th>
        <th>حالة الصرف</th>
      `;
      tableRowsHtml = items
        .map((p, idx) => {
          const emp = employees.find((e) => e.id === p.employee_id);
          const stLabel =
            p.status === "paid"
              ? "<span class='badge present'>تم الصرف</span>"
              : "<span class='badge late'>مسودة لم تصرف</span>";
          return `
            <tr>
              <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
              <td style="font-weight:bold;">${emp ? emp.name : p.employee_id}</td>
              <td style="font-family:monospace; font-weight:bold;">${p.month}</td>
              <td>${(p.basic_salary || 0).toLocaleString()} ج.م</td>
              <td style="color:#15803d;">+${(p.bonuses || 0).toLocaleString()} ج.م</td>
              <td style="color:#b91c1c;">-${(p.deductions || 0).toLocaleString()} ج.م</td>
              <td style="color:#b45309;">-${(p.loan_deduction || 0).toLocaleString()} ج.م</td>
              <td style="font-weight:bold; color:#0369a1;">${(p.net_salary || 0).toLocaleString()} ج.م</td>
              <td>${stLabel}</td>
            </tr>
          `;
        })
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>عدد السجلات: <strong>${summary.count}</strong></span>
          <span>إجمالي الأساسي: <strong>${(summary.totalBasic || 0).toLocaleString()} ج.م</strong></span>
          <span>صافي الرواتب المستحقة: <strong style="color:#0369a1; font-size:15px;">${(summary.totalNet || 0).toLocaleString()} ج.م</strong></span>
        </div>
      `;
    } else if (section === "loans") {
      tableHeadersHtml = `
        <th>#</th>
        <th>اسم الموظف</th>
        <th>تاريخ المنيح</th>
        <th>مبلغ السلفة</th>
        <th>أشهر السداد</th>
        <th>المسدد</th>
        <th>المتبقي القائم</th>
        <th>حالة السداد</th>
      `;
      tableRowsHtml = items
        .map((l, idx) => {
          const emp = employees.find((e) => e.id === l.employee_id);
          const rem = (l.amount || 0) - (l.paid_amount || 0);
          const stLabel =
            l.status === "paid"
              ? "<span class='badge present'>مسددة بالكامل</span>"
              : "<span class='badge late'>جاري السداد</span>";
          return `
            <tr>
              <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
              <td style="font-weight:bold;">${emp ? emp.name : l.employee_id}</td>
              <td style="font-family:monospace; font-weight:bold;">${l.date || "-"}</td>
              <td style="font-weight:bold;">${(l.amount || 0).toLocaleString()} ج.م</td>
              <td style="text-align:center;">${l.repayment_months || 1} شهر</td>
              <td style="color:#15803d;">${(l.paid_amount || 0).toLocaleString()} ج.م</td>
              <td style="font-weight:bold; color:#b91c1c;">${rem.toLocaleString()} ج.م</td>
              <td>${stLabel}</td>
            </tr>
          `;
        })
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>إجمالي السلف: <strong>${(summary.totalAmount || 0).toLocaleString()} ج.م</strong></span>
          <span>إجمالي المسدد: <strong style="color:#15803d;">${(summary.totalPaid || 0).toLocaleString()} ج.م</strong></span>
          <span>المتبقي القائم للسداد: <strong style="color:#b91c1c; font-size:15px;">${(summary.totalRemaining || 0).toLocaleString()} ج.م</strong></span>
        </div>
      `;
    } else if (section === "advances") {
      tableHeadersHtml = `
        <th>#</th>
        <th>اسم الموظف المتقدم</th>
        <th>تاريخ الطلب</th>
        <th>المبلغ المطلوب</th>
        <th>نوع ونظام السداد</th>
        <th>القسط الشهري</th>
        <th>السبب</th>
        <th>حالة الطلب والبت</th>
      `;
      tableRowsHtml = items
        .map((adv, idx) => {
          const stLabel =
            adv.status === "approved"
              ? "<span class='badge present'>مقبول ✅</span>"
              : adv.status === "rejected"
                ? "<span class='badge absent'>مرفوض ❌</span>"
                : "<span class='badge late'>قيد البحث ⏳</span>";
          const sysLabel =
            adv.repayment_type === "single"
              ? "سداد شهر واحد"
              : `سداد على ${adv.months_count || 1} أشهر`;
          return `
            <tr>
              <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
              <td style="font-weight:bold;">${adv.employee_name}</td>
              <td style="font-family:monospace; font-weight:bold;">${adv.created_at ? adv.created_at.split("T")[0] : "-"}</td>
              <td style="font-weight:bold; color:#b45309;">${(Number(adv.amount) || 0).toLocaleString()} ج.م</td>
              <td>${sysLabel}</td>
              <td style="font-weight:bold;">${(Number(adv.installment_amount) || 0).toLocaleString()} ج.م</td>
              <td>${adv.reason || "-"}</td>
              <td>${stLabel} ${adv.decision_note ? `<br/><small style='color:#64748b;'>(${adv.decision_note})</small>` : ""}</td>
            </tr>
          `;
        })
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>إجمالي الطلبات: <strong>${summary.count}</strong></span>
          <span>المبالغ المطلوبة: <strong>${(summary.totalRequested || 0).toLocaleString()} ج.م</strong></span>
          <span>مقبول: <strong style="color:#15803d;">${summary.approvedCount}</strong></span>
          <span>مرفوض: <strong style="color:#b91c1c;">${summary.rejectedCount}</strong></span>
          <span>قيد النظر: <strong style="color:#b45309;">${summary.pendingCount}</strong></span>
        </div>
      `;
    } else if (section === "vacations") {
      tableHeadersHtml = `
        <th>#</th>
        <th>اسم الموظف</th>
        <th>نوع الإجازة</th>
        <th>من تاريخ</th>
        <th>إلى تاريخ</th>
        <th>عدد الأيام</th>
        <th>السبب</th>
        <th>حالة الطلب والبت</th>
      `;
      tableRowsHtml = items
        .map((vac, idx) => {
          const stLabel =
            vac.status === "approved"
              ? "<span class='badge present'>مقبولة ✅</span>"
              : vac.status === "rejected"
                ? "<span class='badge absent'>مرفوضة ❌</span>"
                : "<span class='badge late'>قيد البحث ⏳</span>";

          const vType =
            vac.vacation_type === "annual"
              ? "سنوية"
              : vac.vacation_type === "sick"
                ? "مرضية"
                : vac.vacation_type === "casual"
                  ? "عارضة"
                  : "بدون أجر";

          return `
            <tr>
              <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
              <td style="font-weight:bold;">${vac.employee_name}</td>
              <td>${vType}</td>
              <td style="font-family:monospace; font-weight:bold;">${vac.start_date}</td>
              <td style="font-family:monospace; font-weight:bold;">${vac.end_date}</td>
              <td style="text-align:center; font-weight:bold; color:#0284c7;">${vac.days_count} يوم</td>
              <td>${vac.reason || "-"}</td>
              <td>${stLabel} ${vac.decision_note ? `<br/><small style='color:#64748b;'>(${vac.decision_note})</small>` : ""}</td>
            </tr>
          `;
        })
        .join("");

      summaryBoxHtml = `
        <div class="summary-card">
          <span>إجمالي الطلبات: <strong>${summary.count}</strong></span>
          <span>مجموع أيام الأجازات: <strong style="color:#0284c7;">${summary.totalDays} يوم</strong></span>
          <span>مقبولة: <strong style="color:#15803d;">${summary.approvedCount}</strong></span>
          <span>مرفوضة: <strong style="color:#b91c1c;">${summary.rejectedCount}</strong></span>
        </div>
      `;
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #fff; color: #0f172a; margin: 0; padding: 15px; }
    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .header h3 { margin: 4px 0 0 0; font-size: 13px; color: #475569; }
    .header h2 { margin: 10px 0 0 0; font-size: 16px; color: #0284c7; }
    
    .filter-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #334155; }
    .filter-banner strong { color: #0f172a; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    th { background: #0f172a; color: #ffffff; padding: 8px; border: 1px solid #334155; text-align: right; font-size: 11px; }
    td { border: 1px solid #cbd5e1; padding: 7px; text-align: right; vertical-align: middle; }
    tr:nth-child(even) { background-color: #f8fafc; }

    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; }
    .badge.present { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge.late { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge.absent { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge.leave { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }

    .summary-card { margin-top: 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px; color: #334155; justify-content: space-around; }

    .signatures { margin-top: 45px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; color: #475569; }
    .sig-box { flex: 1; margin: 0 10px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 6px; font-weight: bold; }
    .footer { margin-top: 35px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>المختار لإدارة المشروعات ERP</h1>
    <h3>قسم الموارد البشرية وشؤون الموظفين</h3>
    <h2>${title}</h2>
  </div>

  <div class="filter-banner">
    <div><strong>معيار النطاق الزمني:</strong> ${dateCriteriaText}</div>
    <div><strong>الموظف المستهدف:</strong> ${empLabel}</div>
    <div><strong>تاريخ استخراج التقرير:</strong> ${printDateStr}</div>
  </div>

  <table>
    <thead>
      <tr>${tableHeadersHtml}</tr>
    </thead>
    <tbody>
      ${
        tableRowsHtml ||
        `<tr><td colspan="10" style="text-align:center; padding:20px; color:#64748b;">لا توجد سجلات مطابقة لمعايير البحث والتصفية المحددة</td></tr>`
      }
    </tbody>
  </table>

  ${summaryBoxHtml}

  <div class="signatures">
    <div class="sig-box"><div class="sig-line">إعداد شؤون الموظفين HR</div></div>
    <div class="sig-box"><div class="sig-line">المراجعة والتدقيق الإداري</div></div>
    <div class="sig-box"><div class="sig-line">اعتماد المدير التنفيذي / العام</div></div>
  </div>

  <div class="footer">
    تقرير رسمي صادر من قسم الموارد البشرية - المختار لإدارة المشروعات ERP
  </div>
</body>
</html>`;

    printRawHtml(fullHtml);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border border-border rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-right font-black text-lg flex items-center gap-2">
            <Printer className="text-primary w-5 h-5" />
            طباعة وتصدير {title}
          </DialogTitle>
          <DialogDescription className="text-right text-xs text-muted-foreground">
            حدد معايير البحث والفلترة لاستخراج تقرير مفصل بصيغة A4 معتمدة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Filter 1: Date Criteria */}
          <div className="space-y-2 text-right">
            <Label className="font-bold text-xs flex items-center gap-1">
              <Calendar size={14} className="text-primary" />
              نطاق البحث والفلترة الزمانية *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-muted rounded-xl">
              <Button
                type="button"
                variant={filterType === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("all")}
                className="text-xs font-bold rounded-lg h-8"
              >
                الكل
              </Button>
              <Button
                type="button"
                variant={filterType === "day" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("day")}
                className="text-xs font-bold rounded-lg h-8"
              >
                باليوم
              </Button>
              <Button
                type="button"
                variant={filterType === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("month")}
                className="text-xs font-bold rounded-lg h-8"
              >
                بالشهر
              </Button>
              <Button
                type="button"
                variant={filterType === "year" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("year")}
                className="text-xs font-bold rounded-lg h-8"
              >
                بالسنة
              </Button>
              <Button
                type="button"
                variant={filterType === "range" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterType("range")}
                className="text-xs font-bold rounded-lg h-8"
              >
                فترة محددة
              </Button>
            </div>
          </div>

          {/* Dynamic Date Inputs based on Filter Type */}
          {filterType === "day" && (
            <div className="space-y-1 text-right bg-muted/40 p-3 rounded-xl">
              <Label className="text-xs font-bold">تحديد اليوم والتاريخ المطلوب *</Label>
              <Input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          )}

          {filterType === "month" && (
            <div className="space-y-1 text-right bg-muted/40 p-3 rounded-xl">
              <Label className="text-xs font-bold">تحديد الشهر والتاريخ المطلوب *</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          )}

          {filterType === "year" && (
            <div className="space-y-1 text-right bg-muted/40 p-3 rounded-xl">
              <Label className="text-xs font-bold">تحديد السنة المالية *</Label>
              <Input
                type="number"
                min="2020"
                max="2035"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          )}

          {filterType === "range" && (
            <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-xl text-right">
              <div className="space-y-1">
                <Label className="text-xs font-bold">من تاريخ *</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-xl font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">إلى تاريخ *</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Filter 2: Employee Selection */}
          <div className="space-y-1.5 text-right">
            <Label className="font-bold text-xs flex items-center gap-1">
              <Users size={14} className="text-primary" />
              تصفية التقرير على مستوى موظف معين *
            </Label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
            >
              <option value="all">كافة الموظفين والكادر الوظيفي (شامل)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department || "عام"}) - {emp.job_title}
                </option>
              ))}
            </select>
          </div>

          {/* Results Counter Preview */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground">عدد السجلات المتوفرة للطباعة:</span>
            <Badge className="bg-primary text-primary-foreground font-mono text-xs px-2.5 py-0.5">
              {filteredReportData.items.length} سجل
            </Badge>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            إلغاء
          </Button>
          <Button onClick={handlePrint} className="rounded-xl font-bold gap-2">
            <Printer size={16} />
            طباعة التقرير (A4)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
