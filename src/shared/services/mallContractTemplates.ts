export type MallContractLanguage = "ar" | "en";

export interface MallContractFormData {
  shop_id: string;
  custom_shop_name: string;
  custom_activity: string;
  tenant_name: string;
  phone: string;
  nationality: string;
  id_number: string;
  authorized_representative: string;
  tenant_address: string;
  floor: string;
  area: string;
  start_date: string;
  end_date: string;
  lease_term: string;
  monthly_rent: number;
  deposit_amount: number;
  advance_payment: number;
  currency: string;
  payment_due_date: string;
  payment_method: string;
  service_charge: number | string;
  electricity_included: boolean;
  water_included: boolean;
  other_charges: string;
  annual_escalation: string;
  renewal_option: string;
  fit_out_period: string;
  terms: string;
  language: MallContractLanguage;
}

export const AR_CONTRACT_SECTIONS = {
  title: "عقد إيجار محل تجاري",
  intro:
    "تم الاتفاق بين إدارة المول والمستأجر على تأجير الوحدة الموضحة في بيانات العقد وفقاً للشروط والأحكام المدخلة.",
  parties: "أولاً: بيانات الأطراف",
  property: "ثانياً: بيانات المحل والوحدة",
  financial: "ثالثاً: القيمة الإيجارية والتأمين والدفعات",
  facilities: "رابعاً: الخدمات والمرافق",
  terms: "خامساً: الشروط والأحكام",
  schedule: "الجدول التجاري / Commercial Schedule",
  signatures: "التوقيعات",
};

export const EN_CONTRACT_SECTIONS = {
  title: "COMMERCIAL SHOP LEASE AGREEMENT",
  intro:
    "The Mall Management and the Tenant agree to lease the unit identified in the contract data in accordance with the entered terms and conditions.",
  parties: "1. PARTIES",
  property: "2. SHOP / PREMISES DETAILS",
  financial: "3. RENT, DEPOSIT AND PAYMENTS",
  facilities: "4. SERVICES AND UTILITIES",
  terms: "5. TERMS AND CONDITIONS",
  schedule: "COMMERCIAL SCHEDULE",
  signatures: "SIGNATURES",
};

export const AR_CONTRACT_DEFAULT_TERMS = `1. يسري هذا العقد للمدة المحددة ويتجدد تلقائياً بموافقة الطرفين.
2. يلتزم المستأجر بسداد القيمة الإيجارية في موعد أقصاه الخامس من كل شهر.
3. يتحمل المستأجر كافة فواتير الكهرباء والمياه والخدمات الخاصة بالوحدة ما لم يرد خلاف ذلك في الجدول التجاري.
4. لا يحق للمستأجر التنازل عن الوحدة أو تأجيرها من الباطن كلياً أو جزئياً دون موافقة كتابية مسبقة.
5. يلتزم المستأجر بالنشاط المحدد للمحل وبأنظمة وتعليمات إدارة المول.
6. في حال الإخلال بأي من شروط العقد، يحق للإدارة فسخ العقد واتخاذ الإجراءات القانونية اللازمة وفق القانون الواجب التطبيق.`;

export const EN_CONTRACT_DEFAULT_TERMS = `1. This Agreement shall remain effective for the stated lease term and may be renewed by mutual agreement.
2. The Tenant shall pay the monthly rent no later than the fifth day of each month.
3. The Tenant shall bear electricity, water and unit-related service charges unless otherwise stated in the Commercial Schedule.
4. The Tenant shall not assign the premises or sublease all or any part of it without prior written approval from Mall Management.
5. The Tenant shall operate only the approved activity and comply with Mall Management rules and regulations.
6. In the event of breach of the Agreement, Management may terminate the Agreement and take the necessary legal action under the applicable law.`;

export function normalizeMallContractForm(
  form: Partial<MallContractFormData>,
): MallContractFormData {
  return {
    shop_id: form.shop_id || "",
    custom_shop_name: form.custom_shop_name || "",
    custom_activity: form.custom_activity || "",
    tenant_name: form.tenant_name || "",
    phone: form.phone || "",
    nationality: form.nationality || "",
    id_number: form.id_number || "",
    authorized_representative: form.authorized_representative || "",
    tenant_address: form.tenant_address || "",
    floor: form.floor || "",
    area: form.area || "",
    start_date: form.start_date || "",
    end_date: form.end_date || "",
    lease_term: form.lease_term || "",
    monthly_rent: Number(form.monthly_rent || 0),
    deposit_amount: Number(form.deposit_amount || 0),
    advance_payment: Number(form.advance_payment || 0),
    currency: form.currency || "USD",
    payment_due_date: form.payment_due_date || "5",
    payment_method: form.payment_method || "",
    service_charge: Number(form.service_charge || 0),
    electricity_included: Boolean(form.electricity_included),
    water_included: Boolean(form.water_included),
    other_charges: form.other_charges || "",
    annual_escalation: form.annual_escalation || "",
    renewal_option: form.renewal_option || "",
    fit_out_period: form.fit_out_period || "",
    terms: form.terms || "",
    language: form.language === "en" ? "en" : "ar",
  };
}
