/**
 * Normalizes a unit string to standard categories.
 */
export function normalizeUnit(unit: string | undefined): string {
  const u = (unit || "").trim().toLowerCase();
  if (["kg", "kilogram", "كجم", "كيلوجرام", "كيلو"].includes(u)) return "kg";
  if (["g", "gram", "جم", "جرام"].includes(u)) return "g";
  if (["l", "liter", "لتر", "ل"].includes(u)) return "l";
  if (["ml", "milliliter", "مل", "مليلتر"].includes(u)) return "ml";
  if (["pcs", "piece", "قطعة", "حبة"].includes(u)) return "pcs";
  if (["box", "علبة", "صندوق"].includes(u)) return "box";
  if (["pack", "كيس", "عبوة"].includes(u)) return "pack";
  if (["bottle", "زجاجة"].includes(u)) return "bottle";
  if (["can", "كان"].includes(u)) return "can";
  return u;
}

/**
 * Converts a quantity from one unit to another.
 * Handles:
 * - Grams (g) <-> Kilograms (kg) [1 kg = 1000 g]
 * - Milliliters (ml) <-> Liters (l) [1 l = 1000 ml]
 */
export function convertToInventoryUnit(
  qty: number,
  fromUnit: string | undefined,
  toUnit: string | undefined,
): number {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo || !normFrom || !normTo) return qty;

  // Weight conversions
  if (normTo === "kg" && normFrom === "g") {
    return qty / 1000;
  }
  if (normTo === "g" && normFrom === "kg") {
    return qty * 1000;
  }

  // Volume conversions
  if (normTo === "l" && normFrom === "ml") {
    return qty / 1000;
  }
  if (normTo === "ml" && normFrom === "l") {
    return qty * 1000;
  }

  return qty;
}

/**
 * Validates and cleans table IDs for Supabase UUID columns.
 */
export function cleanTableId(tableId: string | null | undefined): string | null {
  if (!tableId) return null;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(tableId) ? tableId : null;
}
