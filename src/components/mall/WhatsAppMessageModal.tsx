import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Globe, Save, ExternalLink, Check, Phone, Building2 } from "lucide-react";
import { MallShop, erpStore } from "@/shared/services/erpStore";
import { toast } from "sonner";

interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: MallShop | null;
  onShopUpdated?: (updatedShop: MallShop) => void;
}

export type WhatsAppLanguage = "ar" | "en";
export type WhatsAppTemplateKey =
  | "welcome"
  | "reminder"
  | "overdue"
  | "renewal"
  | "maintenance"
  | "receipt"
  | "custom";

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  isOpen,
  onClose,
  shop,
  onShopUpdated,
}) => {
  const [lang, setLang] = useState<WhatsAppLanguage>("ar");
  const [template, setTemplate] = useState<WhatsAppTemplateKey>("reminder");
  const [countryCode, setCountryCode] = useState("+20");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customText, setCustomText] = useState("");
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  // Sync state whenever active shop changes
  useEffect(() => {
    if (shop) {
      const code = shop.country_code || "+20";
      setCountryCode(code);
      setPhoneNumber(shop.phone && shop.phone !== "-" ? shop.phone : "");
      setIsSavedLocally(false);
    }
  }, [shop]);

  const tenantName = shop?.tenant_name || (lang === "ar" ? "العميل العزيز" : "Valued Client");
  const shopNumber = shop?.shop_number || "";
  const unitTitle = shop?.name_ar || (lang === "ar" ? "الوحدة" : "Unit");
  const amountEgp = Number(shop?.monthly_rent || 0).toLocaleString("ar-EG");
  const amountEgpEn = Number(shop?.monthly_rent || 0).toLocaleString("en-US");
  const isOwnership = shop?.ownership_type === "ownership";

  // Pre-configured message templates in both Arabic and English
  const generatedMessage = useMemo(() => {
    if (template === "custom") {
      return customText;
    }

    if (lang === "ar") {
      switch (template) {
        case "welcome":
          return `مرحباً بك أستاذ/ة ${tenantName}،\n\nيسر إدارة «المختار لإدارة المشروعات» الترحيب بكم في الوحدة رقم (${shopNumber}) - ${unitTitle}.\nيسعدنا انضمامكم ونتمنى لكم دوام التوفيق والنجاح.\nلأي استفسارات أو متطلبات تشغيلية، فريق إدارة المشروعات في خدمتكم دائماً.\n\nمع أطيب التحيات،\nإدارة المختار لإدارة المشروعات.`;

        case "reminder":
          return `عناية الأستاذ/ة ${tenantName} المحترم،\n\nتحية طيبة وبعد،،\nنود تذكيركم بموعد استحقاق ${isOwnership ? "القسط الشهري" : "القيمة الإيجارية الشهرية"} للوحدة رقم (${shopNumber}) والمحددة بمبلغ (${amountEgp} ج.م).\nيرجى التكرم بالسداد في الموعد المحدد لتفادي أي غرامات تأخير وتسهيل الإجراءات.\n\nشاكرين ومقدرين حسن تعاونكم الدائم،\nإدارة المختار لإدارة المشروعات.`;

        case "overdue":
          return `تنبيه هام ومستعجل:\nعناية الأستاذ/ة ${tenantName}،\n\nنحيط سيادتكم علماً بتأخر سداد مستحقات الوحدة رقم (${shopNumber}) بمبلغ (${amountEgp} ج.م) عن الموعد القانوني المتفق عليه.\nيرجى التوجه إلى إدارة الحسابات وسداد المستحق خلال 48 ساعة لتجنب تطبيق غرامات التأخير أو اتخاذ الإجراءات القانونية المتبعة.\n\nإدارة الشؤون المالية والقانونية،\nالمختار لإدارة المشروعات.`;

        case "renewal":
          return `السيد/ة ${tenantName} المحترم/ة،\n\nنود إفادتكم بقرب انتهاء فترة التعاقد الحالية للوحدة رقم (${shopNumber}).\nيرجى التفضل بمراجعة إدارة المشروعات لبحث رغبتكم في تجديد العقد واستكمال الإجراءات وتحديث البيانات التعاقدية.\n\nشاكرين ثقتكم الكريمة،\nإدارة المختار لإدارة المشروعات.`;

        case "maintenance":
          return `عناية الأستاذ/ة ${tenantName}،\n\nإشعار من الإدارة الهندسية والتشغيلية بخصوص الوحدة رقم (${shopNumber}):\nنحيطكم علماً بجدول أعمال الصيانة الدورية والمرافق العامة المجدولة للمبنى والوحدات.\nيرجى التنسيق المسبق مع مشرف العمليات لتسهيل المهام الفنية المطلوبة.\n\nشاكرين تفهمكم وتعاونكم،\nإدارة المختار لإدارة المشروعات.`;

        case "receipt":
          return `إشعار استلام وسداد مالي:\nعناية الأستاذ/ة ${tenantName}،\n\nتم بحمد الله استلام وتسجيل الدفعة المالية المسددة للوحدة رقم (${shopNumber}) بنجاح وإصدار السند المالي الرسمي.\nشكراً لالتزامكم وحسن تعاونكم.\n\nالإدارة المالية،\nالمختار لإدارة المشروعات.`;

        default:
          return "";
      }
    } else {
      // English templates
      switch (template) {
        case "welcome":
          return `Dear ${tenantName},\n\nAl Mokhtar Project Management warmly welcomes you to Unit #${shopNumber} (${unitTitle}).\nWe are delighted to have you and wish you continued prosperity and success.\nFor any inquiries or facility support, our management team is always at your service.\n\nWarm regards,\nAl Mokhtar Project Management.`;

        case "reminder":
          return `Dear ${tenantName},\n\nThis is a friendly reminder regarding the upcoming due date for ${isOwnership ? "the monthly installment" : "the monthly rent"} of Unit #${shopNumber} for the amount of (${amountEgpEn} EGP).\nKindly arrange the payment on time to avoid any late penalties.\n\nThank you for your valued cooperation,\nAl Mokhtar Project Management.`;

        case "overdue":
          return `URGENT OVERDUE NOTICE:\nDear ${tenantName},\n\nPlease be advised that the payment for Unit #${shopNumber} in the amount of (${amountEgpEn} EGP) is currently overdue past the agreed deadline.\nKindly settle the pending balance within 48 hours to avoid penalty charges or legal escalation.\n\nFinance & Legal Department,\nAl Mokhtar Project Management.`;

        case "renewal":
          return `Dear ${tenantName},\n\nWe would like to remind you that the current contract term for Unit #${shopNumber} is nearing its expiration.\nPlease visit our management office to discuss renewal terms and finalize the contract extension.\n\nBest regards,\nAl Mokhtar Project Management.`;

        case "maintenance":
          return `Dear ${tenantName},\n\nOperational Notice regarding Unit #${shopNumber}:\nPlease be informed that scheduled maintenance and facility inspection works will be taking place.\nKindly coordinate with our site supervisor to ensure smooth operations.\n\nThank you for your cooperation,\nAl Mokhtar Project Management.`;

        case "receipt":
          return `Payment Confirmation:\nDear ${tenantName},\n\nWe have successfully received and registered your payment for Unit #${shopNumber}. The official financial receipt has been generated in the system.\nThank you for your prompt settlement.\n\nFinance Department,\nAl Mokhtar Project Management.`;

        default:
          return "";
      }
    }
  }, [template, lang, tenantName, shopNumber, unitTitle, amountEgp, amountEgpEn, isOwnership, customText]);

  // Compute final sanitized phone number for WhatsApp wa.me link
  const cleanFullNumber = useMemo(() => {
    // 1. Clean country code (e.g. "+20" -> "20")
    let code = countryCode.replace(/\D/g, "");
    if (!code) code = "20"; // default Egypt

    // 2. Clean phone number: remove any non-digits
    let phone = phoneNumber.replace(/\D/g, "");

    // 3. If phone starts with "00", strip it
    if (phone.startsWith("00")) {
      phone = phone.substring(2);
    }

    // 4. If phone starts with country code already, do not duplicate
    if (phone.startsWith(code)) {
      return phone;
    }

    // 5. If phone has leading 0 (like standard Egyptian mobiles 010..., 011..., 012..., 015...), remove leading 0
    if (phone.startsWith("0")) {
      phone = phone.substring(1);
    }

    return `${code}${phone}`;
  }, [countryCode, phoneNumber]);

  // Save country code and phone to shop record
  const handleSavePhoneToShop = () => {
    if (!shop) return;
    try {
      erpStore.updateMallShop(shop.id, {
        country_code: countryCode.trim(),
        phone: phoneNumber.trim(),
      });
      setIsSavedLocally(true);
      toast.success("تم حفظ كود الدولة ورقم الهاتف في بيانات الوحدة بنجاح");
      if (onShopUpdated) {
        onShopUpdated({
          ...shop,
          country_code: countryCode.trim(),
          phone: phoneNumber.trim(),
        });
      }
    } catch (err: any) {
      toast.error("فشل حفظ رقم الهاتف: " + (err.message || err));
    }
  };

  const handleSendViaWhatsApp = () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 7) {
      toast.error("يرجى إدخال رقم هاتف صحيح أولاً.");
      return;
    }

    // Auto-save changes if not saved yet
    handleSavePhoneToShop();

    const textToSend = template === "custom" ? customText : generatedMessage;
    if (!textToSend.trim()) {
      toast.error("لا يمكن إرسال رسالة فارغة.");
      return;
    }

    const whatsappUrl = `https://wa.me/${cleanFullNumber}?text=${encodeURIComponent(textToSend)}`;
    window.open(whatsappUrl, "_blank");
    toast.success("تم فتح تطبيق WhatsApp لإرسال الرسالة");
    onClose();
  };

  if (!shop) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto text-right p-6 rounded-2xl">
        <DialogHeader className="text-right border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-600 text-white font-bold gap-1 text-xs">
              <MessageCircle size={13} />
              رسائل WhatsApp
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              الوحدة: <strong className="text-foreground">{shop.shop_number}</strong>
            </span>
          </div>
          <DialogTitle className="text-lg font-black mt-2 text-foreground flex items-center gap-2">
            <span>مراسلة المستأجر / المالك:</span>
            <span className="text-primary">{shop.tenant_name || shop.name_ar}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تخصيص كود الدولة، اختيار لغة الرسالة (عربي / إنجليزي)، واختيار النموذج المناسب لإرساله مباشرة عبر واتساب.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. Country Code & Phone Number Box */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Phone size={14} className="text-primary" />
                <span>رقم هاتف الواتساب وكود الدولة:</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSavePhoneToShop}
                className="h-7 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 rounded-lg cursor-pointer"
              >
                <Save size={12} />
                {isSavedLocally ? "تم الحفظ ✓" : "حفظ في بطاقة الوحدة"}
              </Button>
            </div>

            <div className="flex items-center gap-2" dir="ltr">
              {/* Country Code Input */}
              <div className="w-28 shrink-0">
                <Input
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    setIsSavedLocally(false);
                  }}
                  placeholder="+20"
                  className="h-10 text-center font-mono font-black text-xs rounded-xl bg-background border-border"
                  title="كود الدولة (مثال: +20 لمصر، +966 للسعودية، إلخ)"
                />
              </div>

              {/* Mobile Number Input */}
              <div className="flex-1">
                <Input
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setIsSavedLocally(false);
                  }}
                  placeholder="01012345678"
                  className="h-10 text-left font-mono font-bold text-xs rounded-xl bg-background border-border"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground" dir="rtl">
              الرقم المعتمد للتحويل الفوري: <span className="font-mono font-bold text-primary" dir="ltr">+{cleanFullNumber}</span> (يتم التوجيه المباشر بدون أخطاء أرقام).
            </p>
          </div>

          {/* 2. Language Selection (العربية / English) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Globe size={14} className="text-primary" />
              <span>اختر لغة الرسالة (Language):</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer border ${
                  lang === "ar"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border-border"
                }`}
              >
                <span>🇪🇬 باللغة العربية (Arabic)</span>
                {lang === "ar" && <Check size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setLang("en")}
                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer border ${
                  lang === "en"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border-border"
                }`}
              >
                <span>🇬🇧 باللغة الإنجليزية (English)</span>
                {lang === "en" && <Check size={14} />}
              </button>
            </div>
          </div>

          {/* 3. Message Template Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              نوع الرسالة المطلوبة (Template):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTemplate("reminder")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "reminder"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                تذكير بالسداد الدوري
              </button>
              <button
                type="button"
                onClick={() => setTemplate("overdue")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "overdue"
                    ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                إنذار بتأخر السداد
              </button>
              <button
                type="button"
                onClick={() => setTemplate("welcome")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "welcome"
                    ? "bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                ترحيب بمستأجر/مالك جديد
              </button>
              <button
                type="button"
                onClick={() => setTemplate("receipt")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "receipt"
                    ? "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                إيصال استلام دفعة
              </button>
              <button
                type="button"
                onClick={() => setTemplate("renewal")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "renewal"
                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                إشعار تجديد العقد
              </button>
              <button
                type="button"
                onClick={() => setTemplate("custom")}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  template === "custom"
                    ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 font-black"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                رسالة مخصصة حرة
              </button>
            </div>
          </div>

          {/* 4. Live Message Preview / Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                معاينة ونص الرسالة الجاهزة للإرسال:
              </label>
              <span className="text-[11px] text-muted-foreground">
                (يمكنك تعديل النص يدوياً قبل النقر على إرسال)
              </span>
            </div>
            {template === "custom" ? (
              <Textarea
                rows={6}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="اكتب نص الرسالة المخصصة هنا..."
                className="text-xs leading-relaxed rounded-xl font-medium bg-background"
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            ) : (
              <Textarea
                rows={6}
                value={generatedMessage}
                onChange={(e) => {
                  setTemplate("custom");
                  setCustomText(e.target.value);
                }}
                className="text-xs leading-relaxed rounded-xl font-medium bg-background"
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-bold cursor-pointer"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSendViaWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 rounded-xl cursor-pointer shadow-sm"
          >
            <MessageCircle size={15} />
            <span>إرسال عبر WhatsApp</span>
            <ExternalLink size={13} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
