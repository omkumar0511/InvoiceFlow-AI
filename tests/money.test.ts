import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  multiplyLineItem,
  calculateInvoiceTotal,
  formatMoneyDisplay,
} from "../lib/money";

describe("Money Math Utilities", () => {
  it("converts amounts to integer cents without floating point errors", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents("450.50")).toBe(45050);
    expect(toCents(0.1 + 0.2)).toBe(30); // Classic float bug 0.30000000000000004 avoided
  });

  it("converts cents back to 2-decimal string", () => {
    expect(fromCents(1999)).toBe("19.99");
    expect(fromCents(500)).toBe("5.00");
    expect(fromCents(5)).toBe("0.05");
  });

  it("multiplies quantity and unit price safely", () => {
    const res = multiplyLineItem("33.33", 3);
    expect(res.cents).toBe(9999);
    expect(res.formatted).toBe("99.99");
  });

  it("calculates multi-item invoice total exactly", () => {
    const items = [
      { unit_price: "450.00", quantity: 1 },
      { unit_price: "60.00", quantity: 2 },
      { unit_price: "0.10", quantity: 3 },
    ];
    const total = calculateInvoiceTotal(items);
    // 450.00 + 120.00 + 0.30 = 570.30
    expect(total.cents).toBe(57030);
    expect(total.formatted).toBe("570.30");
  });

  it("formats currency symbols properly", () => {
    expect(formatMoneyDisplay(450.5, "USD")).toBe("$450.50");
    expect(formatMoneyDisplay(120, "EUR")).toBe("€120.00");
    expect(formatMoneyDisplay(1500, "INR")).toBe("₹1500.00");
  });
});
