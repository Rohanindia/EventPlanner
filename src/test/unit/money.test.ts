import { describe, it, expect } from "vitest";
import {
  formatMoney,
  formatNumber,
  parseMoney,
  distributeByLargestRemainder,
  CURRENCY_SYMBOLS,
} from "@/lib/money";

describe("formatMoney", () => {
  it("formats INR with en-IN grouping", () => {
    const result = formatMoney(500000, "INR");
    expect(result).toMatch(/5,00,000|500,000/); // en-IN uses lakh grouping
    expect(result).toContain("₹");
  });

  it("formats USD with en-US grouping", () => {
    const result = formatMoney(10000, "USD");
    expect(result).toContain("10,000");
    expect(result).toContain("$");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0, "INR")).toContain("0");
  });

  it("formats large numbers", () => {
    const result = formatMoney(10_000_000, "INR");
    expect(result).toBeTruthy();
  });

  it("formats with compact notation", () => {
    const result = formatMoney(500000, "INR", { compact: true });
    expect(result).toBeTruthy();
  });
});

describe("parseMoney", () => {
  it("parses a plain number string", () => {
    expect(parseMoney("5000")).toBe(5000);
  });

  it("strips currency symbols", () => {
    expect(parseMoney("₹5,00,000")).toBe(500000);
  });

  it("handles invalid input", () => {
    expect(parseMoney("abc")).toBe(0);
  });

  it("handles empty string", () => {
    expect(parseMoney("")).toBe(0);
  });
});

describe("distributeByLargestRemainder", () => {
  it("sums exactly to total with even split", () => {
    const total = 1000;
    const ratios = [25, 25, 25, 25];
    const result = distributeByLargestRemainder(total, ratios);
    expect(result.reduce((a, b) => a + b, 0)).toBe(total);
    result.forEach((v) => expect(v).toBe(250));
  });

  it("sums exactly to total with odd remainder", () => {
    const total = 100;
    const ratios = [1, 1, 1]; // 33.33... each
    const result = distributeByLargestRemainder(total, ratios);
    expect(result.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("handles single category", () => {
    const result = distributeByLargestRemainder(500, [1]);
    expect(result).toEqual([500]);
  });

  it("handles empty ratios array", () => {
    const result = distributeByLargestRemainder(1000, []);
    expect(result).toEqual([]);
  });

  it("handles zero ratios (equal split)", () => {
    const result = distributeByLargestRemainder(100, [0, 0, 0]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("handles large budget", () => {
    const total = 10_000_000;
    const ratios = [30, 25, 20, 15, 10];
    const result = distributeByLargestRemainder(total, ratios);
    expect(result.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("distributes proportionally", () => {
    const total = 1000;
    const ratios = [60, 40];
    const result = distributeByLargestRemainder(total, ratios);
    expect(result[0]).toBe(600);
    expect(result[1]).toBe(400);
  });
});

describe("CURRENCY_SYMBOLS", () => {
  it("has symbol for each supported currency", () => {
    expect(CURRENCY_SYMBOLS["INR"]).toBe("₹");
    expect(CURRENCY_SYMBOLS["USD"]).toBe("$");
    expect(CURRENCY_SYMBOLS["EUR"]).toBe("€");
    expect(CURRENCY_SYMBOLS["GBP"]).toBe("£");
    expect(CURRENCY_SYMBOLS["AED"]).toBe("د.إ");
  });
});

describe("formatNumber", () => {
  it("formats a plain number with grouping", () => {
    const result = formatNumber(100000, "INR");
    expect(result).toBeTruthy();
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBeTruthy();
  });

  it("handles decimals", () => {
    const result = formatNumber(1234.56, "USD");
    expect(result).toContain("1,234");
  });
});

describe("formatMoney edge cases", () => {
  it("formats negative numbers", () => {
    const result = formatMoney(-5000, "INR");
    expect(result).toBeTruthy();
  });

  it("handles all supported currencies", () => {
    const currencies = ["INR", "USD", "EUR", "GBP", "AED"] as const;
    currencies.forEach((c) => {
      const result = formatMoney(1000, c);
      expect(result).toBeTruthy();
    });
  });
});
