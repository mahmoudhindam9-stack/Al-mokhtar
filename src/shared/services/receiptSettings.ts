export interface ReceiptDesignSettings {
  // General Store Info
  storeName: string;
  storeNameEn: string;
  storeSubtitle: string;
  storeSubtitleEn: string;
  logoUrl: string;
  showLogo: boolean;
  taxNumber: string;
  commercialRegister: string;
  phone: string;
  address: string;
  branchName: string;

  // Thermal Receipt (80mm / 58mm)
  receiptPaperWidth: "80mm" | "58mm" | "A4" | "A5";
  accentColor: string;
  fontFamily: "Tajawal" | "Cairo" | "Courier" | "Inter";
  fontSize: "sm" | "base" | "lg";
  showBranchName: boolean;
  showTaxNumber: boolean;
  showCommercialRegister: boolean;
  showCashierName: boolean;
  showOrderType: boolean;
  showTableNumber: boolean;
  showCustomerDetails: boolean;
  showTaxBreakdown: boolean;
  showPaymentMethod: boolean;
  showItemNotes: boolean;
  showQRCode: boolean;
  qrCodeType: "zatca" | "url" | "order_id";
  showBarcode: boolean;
  showFooterNotes: boolean;
  footerNotesText: string;
  showThankYouMsg: boolean;
  thankYouMessage: string;
  showWifiPass: boolean;
  wifiPasswordText: string;

  // Financial Rates & Taxes (الضرائب، الخصم، والخدمات)
  defaultTaxRate: number;
  enableTax: boolean;
  defaultDiscountType: "percent" | "fixed";
  defaultDiscountValue: number;
  enableDiscount: boolean;
  dineInServiceRate: number;
  enableDineInService: boolean;
  deliveryFee: number;
  enableDeliveryFee: boolean;

  // Collection & Payment Vouchers (سندات القبض والصرف)
  voucherTitleCollection: string;
  voucherTitleCollectionEn: string;
  voucherTitlePayment: string;
  voucherTitlePaymentEn: string;
  voucherShowAmountInWords: boolean;
  voucherShowSignatures: boolean;
  voucherShowTreasuryName: boolean;
  voucherShowBranchHeader: boolean;
  voucherTermsText: string;

  // Tax Invoices (الفواتير الضريبية A4)
  invoiceTitle: string;
  invoiceTitleEn: string;
  invoiceShowCompanyStamp: boolean;
  invoiceCompanyStampUrl: string;
  invoiceShowCustomerTaxId: boolean;
  invoiceBankDetails: string;
  invoiceTermsAndConditions: string;

  // Inventory & Returns Notes (أذون المخزن والمرتجعات)
  returnNoteTitle: string;
  returnNoteTitleEn: string;
  showReturnPolicyText: boolean;
  returnPolicyText: string;
  showWarehouseSignature: boolean;

  // Mall Contracts & Terminations (عقود وفسخ محلات المول)
  mallContractTitle: string;
  mallContractTitleEn: string;
  mallContractHeaderNotes: string;
  mallContractTermsText: string;
  mallContractShowSignatures: boolean;
  mallTerminationTitle: string;
  mallTerminationTitleEn: string;
  mallTerminationTermsText: string;
  mallTerminationShowSignatures: boolean;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptDesignSettings = {
  // General Store Info
  storeName: "المختار لإدارة المشروعات",
  storeNameEn: "Al Mokhtar Project Management",
  storeSubtitle: "الإدارة العامة والمشروعات المتكاملة",
  storeSubtitleEn: "General Management & Integrated Projects",
  logoUrl: "",
  showLogo: true,
  taxNumber: "300123456700003",
  commercialRegister: "1010897654",
  phone: "+20 100 123 4567",
  address: "القاهرة - شارع التحرير - مبنى الإدارة",
  branchName: "الفرع الرئيسي",

  // Paper Width Settings (All Documents Default to A4)
  receiptPaperWidth: "A4",
  accentColor: "#10b981", // emerald
  fontFamily: "Tajawal",
  fontSize: "base",
  showBranchName: true,
  showTaxNumber: true,
  showCommercialRegister: true,
  showCashierName: true,
  showOrderType: true,
  showTableNumber: true,
  showCustomerDetails: true,
  showTaxBreakdown: true,
  showPaymentMethod: true,
  showItemNotes: true,
  showQRCode: true,
  qrCodeType: "zatca",
  showBarcode: true,
  showFooterNotes: true,
  footerNotesText: "الأسعار شاملة ضريبة القيمة المضافة 14%",
  showThankYouMsg: true,
  thankYouMessage: "شكراً لزيارتكم ونتمنى لكم يوماً سعيداً! ❤️",
  showWifiPass: true,
  wifiPasswordText: "شبكة الواي فاي: Restocash_Guest | كلمة السر: 20262026",

  // Financial Rates & Charges
  defaultTaxRate: 14,
  enableTax: true,
  defaultDiscountType: "percent",
  defaultDiscountValue: 0,
  enableDiscount: true,
  dineInServiceRate: 12,
  enableDineInService: true,
  deliveryFee: 20,
  enableDeliveryFee: true,

  // Vouchers Settings
  voucherTitleCollection: "سند قبض نقدية / تحصيل",
  voucherTitleCollectionEn: "CASH COLLECTION VOUCHER",
  voucherTitlePayment: "سند صرف نقدية / مصاريف",
  voucherTitlePaymentEn: "CASH PAYMENT VOUCHER",
  voucherShowAmountInWords: true,
  voucherShowSignatures: true,
  voucherShowTreasuryName: true,
  voucherShowBranchHeader: true,
  voucherTermsText: "يعتبر هذا السند ملغياً ولا يُعتد به ما لم يحمل التوقيع والختم المعتمدين.",

  // Tax Invoices Settings
  invoiceTitle: "فاتورة ضريبية مبسطة / رسمية",
  invoiceTitleEn: "SIMPLIFIED TAX INVOICE",
  invoiceShowCompanyStamp: true,
  invoiceCompanyStampUrl: "",
  invoiceShowCustomerTaxId: true,
  invoiceBankDetails: "البنك التجاري الدولي (CIB) - رقم الحساب: EG980002000000123456789",
  invoiceTermsAndConditions:
    "البضاعة المباعة لا ترد ولا تستبدل بعد مرور 14 يوماً وبشرط وجود أصل الفاتورة.",

  // Inventory & Return Vouchers Settings
  returnNoteTitle: "إذن مرتجع مبيعات / تسوية نقدية",
  returnNoteTitleEn: "SALES RETURN & REFUND NOTE",
  showReturnPolicyText: true,
  returnPolicyText: "تمت مراجعة الأصناف المرتجعة وإعادتها للمخزن وتحديث أرصدة الخزينة الفورية.",
  showWarehouseSignature: true,

  // Mall Contracts & Terminations Defaults
  mallContractTitle: "عقد إيجار محل تجاري - مركز التسوق",
  mallContractTitleEn: "COMMERCIAL SHOP LEASE AGREEMENT",
  mallContractHeaderNotes:
    "يُحرر هذا العقد بين إدارة المركز والمستأجر وفقاً للشروط والأحكام المدونة أدناه",
  mallContractTermsText:
    "يلتزم المستأجر بسداد الأجرة الشهرية في مواعيدها المحددة ودفع مبلغ التأمين كاملاً. لا يجوز التنازل عن الوحدة أو تأجيرها من الباطن إلا بموافقة خطية مسبقة من إدارة المول.",
  mallContractShowSignatures: true,
  mallTerminationTitle: "محضر تسليم محل وفسخ عقد إيجار",
  mallTerminationTitleEn: "SHOP LEASE TERMINATION & HANDOVER RECORD",
  mallTerminationTermsText:
    "أقر المستأجر باستلام المحل وتصفية كافة الحسابات واسترداد التأمين المتبقي وإبراء ذمة الطرفين.",
  mallTerminationShowSignatures: true,
};

const STORAGE_KEY = "app_receipt_design_settings";

export function getReceiptDesignSettings(): ReceiptDesignSettings {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return DEFAULT_RECEIPT_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Error loading receipt design settings:", e);
  }
  return DEFAULT_RECEIPT_SETTINGS;
}

export function saveReceiptDesignSettings(settings: ReceiptDesignSettings) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("receipt_settings_updated", { detail: settings }));
  } catch (e) {
    console.error("Error saving receipt design settings:", e);
  }
}

export function resetReceiptDesignSettings(): ReceiptDesignSettings {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("receipt_settings_updated", { detail: DEFAULT_RECEIPT_SETTINGS }),
    );
  }
  return DEFAULT_RECEIPT_SETTINGS;
}
