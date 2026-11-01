import type { CURRENCIES } from "@/lib/validation";

/** Currency locale map for Intl.NumberFormat */
const CURRENCY_LOCALES: Record<(typeof CURRENCIES)[number], string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "ar-AE",
};

/** Currency display names */
export const CURRENCY_NAMES: Record<(typeof CURRENCIES)[number], string> = {
  INR: "Indian Rupee (₹)",
  USD: "US Dollar ($)",
  EUR: "Euro (€)",
  GBP: "British Pound (£)",
  AED: "UAE Dirham (د.إ)",
};

/**
 * Format a number as currency with locale-appropriate grouping.
 * INR uses en-IN grouping (lakh/crore system).
 */
export function formatMoney(
  amount: number,
  currency: (typeof CURRENCIES)[number],
  options?: { compact?: boolean },
): string {
  const locale = CURRENCY_LOCALES[currency];
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      notation: options?.compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    // Fallback for environments where locale is unavailable
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a plain number with locale grouping (no currency symbol).
 */
export function formatNumber(
  amount: number,
  currency: (typeof CURRENCIES)[number] = "INR",
): string {
  const locale = CURRENCY_LOCALES[currency];
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/**
 * Parse a possibly-formatted money string to a number.
 * Strips currency symbols, commas, spaces.
 */
export function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/** Currency symbol for display */
export const CURRENCY_SYMBOLS: Record<(typeof CURRENCIES)[number], string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
};

/**
 * Distribute a total budget across categories using largest-remainder method.
 * Guarantees the sum equals the exact total.
 */
export function distributeByLargestRemainder(total: number, ratios: number[]): number[] {
  if (ratios.length === 0) return [];
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    const even = Math.floor(total / ratios.length);
    const remainder = total - even * ratios.length;
    return ratios.map((_, i) => even + (i === 0 ? remainder : 0));
  }

  const floats = ratios.map((r) => (total * r) / sum);
  const floors = floats.map(Math.floor);
  const remainders = floats.map((f, i) => f - (floors[i] ?? 0));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

  // Distribute remainder to items with highest fractional part
  const indices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);

  const result = [...floors];
  for (let k = 0; k < remaining && k < indices.length; k++) {
    const idx = indices[k];
    if (idx !== undefined) {
      result[idx] = (result[idx] ?? 0) + 1;
    }
    remaining--;
  }
  return result;
}
