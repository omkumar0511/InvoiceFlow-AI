/**
 * Decimal-safe financial calculations.
 * Avoids IEEE 754 floating-point inaccuracies by computing in integer cents.
 */

/**
 * Converts a currency amount (number or string, e.g. "450.50" or 450.5) to integer cents.
 */
export function toCents(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") {
    return 0;
  }
  const cleanStr = String(amount).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleanStr);
  if (isNaN(num)) {
    return 0;
  }
  // Round to nearest integer cent
  return Math.round(num * 100);
}

/**
 * Converts integer cents back to a 2-decimal string (e.g. 1050 -> "10.50").
 */
export function fromCents(cents: number): string {
  if (isNaN(cents)) return "0.00";
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Multiplies a unit price by quantity safely.
 */
export function multiplyLineItem(
  unitPrice: number | string,
  quantity: number | string
): { cents: number; formatted: string } {
  const priceCents = toCents(unitPrice);
  const qty = parseFloat(String(quantity)) || 0;
  const totalCents = Math.round(priceCents * qty);
  return {
    cents: totalCents,
    formatted: fromCents(totalCents),
  };
}

/**
 * Computes sum total of items in integer cents.
 */
export function calculateInvoiceTotal(
  items: Array<{ unit_price: number | string; quantity: number | string }>
): { cents: number; formatted: string } {
  let totalCents = 0;
  for (const item of items) {
    const itemTotal = multiplyLineItem(item.unit_price, item.quantity);
    totalCents += itemTotal.cents;
  }
  return {
    cents: totalCents,
    formatted: fromCents(totalCents),
  };
}

/**
 * Human-readable display with symbol.
 */
export function formatMoneyDisplay(
  amount: number | string,
  currency = "USD"
): string {
  const cents = toCents(amount);
  const formattedNumber = fromCents(cents);

  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "CA$",
    AUD: "A$",
    INR: "₹",
    JPY: "¥",
  };

  const symbol = symbols[currency.toUpperCase()] || `${currency.toUpperCase()} `;
  return `${symbol}${formattedNumber}`;
}
