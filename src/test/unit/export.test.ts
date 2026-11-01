import { describe, it, expect } from "vitest";
import { generateBudgetCSV, generateTextSummary, generatePlanJSON } from "@/lib/export";
import type { Budget, Plan } from "@/lib/validation";

const mockBudget: Budget = [
  { id: "b1", category: "Venue", planned: 50000, actual: 45000, notes: "Confirmed" },
  { id: "b2", category: "Catering", planned: 80000, actual: 0, notes: "" },
  { id: "b3", category: "=SUM injection", planned: 10000, actual: 0, notes: "+formula" },
];

describe("generateBudgetCSV", () => {
  it("contains header row", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    expect(csv).toContain("Category");
    expect(csv).toContain("Planned");
    expect(csv).toContain("Actual");
  });

  it("includes all categories", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    expect(csv).toContain("Venue");
    expect(csv).toContain("Catering");
  });

  it("guards CSV formula injection with = prefix", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    // The dangerous cell should be prefixed with tab
    expect(csv).not.toMatch(/"=SUM/);
  });

  it("guards + prefix formula", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    expect(csv).not.toMatch(/"\+formula/);
  });

  it("includes totals row", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    expect(csv.toUpperCase()).toContain("TOTAL");
  });

  it("uses CRLF line endings (RFC 4180)", () => {
    const csv = generateBudgetCSV(mockBudget, "INR");
    expect(csv).toContain("\r\n");
  });
});

const mockPlan: Plan = {
  id: "plan_test",
  version: 2,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  isAiGenerated: false,
  input: {
    eventType: "wedding",
    name: "Test Wedding",
    date: "2027-06-15",
    city: "Mumbai",
    guests: 200,
    totalBudget: 500000,
    currency: "INR",
    theme: "",
    dietaryPreferences: "Vegetarian",
    culturalTraditions: "",
    isIndoor: true,
    notes: "",
    planLanguage: "en",
    ceremonies: "",
    traditions: "",
  },
  summary: "A test wedding plan.",
  budget: mockBudget,
  timeline: [
    {
      id: "t1",
      date: "2027-01-01",
      task: "Book venue",
      category: "Venue",
      priority: "high",
      done: false,
      notes: "",
    },
  ],
  vendors: [
    {
      id: "v1",
      category: "Venue",
      name: "",
      contact: "",
      costRangeLow: 0,
      costRangeHigh: 0,
      quotedAmount: 0,
      status: "not_started",
      questionsToAsk: [],
      notes: "",
    },
  ],
  ideas: {
    themes: ["Theme 1"],
    decorPalette: ["Gold"],
    menuSuggestions: ["Vegetarian buffet"],
    activities: ["Dance"],
    favours: ["Candles"],
    moneySavingTips: ["Book early"],
    pinnedIds: [],
  },
  tips: ["Tip 1", "Tip 2"],
};

describe("generateTextSummary", () => {
  it("contains event name", () => {
    const text = generateTextSummary(mockPlan);
    expect(text).toContain("Test Wedding");
  });

  it("contains event date", () => {
    const text = generateTextSummary(mockPlan);
    expect(text).toContain("2027-06-15");
  });

  it("contains budget breakdown", () => {
    const text = generateTextSummary(mockPlan);
    expect(text).toContain("Venue");
  });

  it("contains tips", () => {
    const text = generateTextSummary(mockPlan);
    expect(text).toContain("Tip 1");
  });

  it("is plain text with no HTML", () => {
    const text = generateTextSummary(mockPlan);
    expect(text).not.toMatch(/<[^>]+>/);
  });
});

describe("generatePlanJSON", () => {
  it("produces valid JSON", () => {
    const json = generatePlanJSON(mockPlan);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("contains all plan fields", () => {
    const json = generatePlanJSON(mockPlan);
    const parsed = JSON.parse(json) as Plan;
    expect(parsed.id).toBe("plan_test");
    expect(parsed.version).toBe(2);
    expect(parsed.budget).toHaveLength(3);
  });

  it("is pretty-printed with 2 spaces", () => {
    const json = generatePlanJSON(mockPlan);
    expect(json).toContain("  ");
  });
});

describe("generateBudgetCSV edge cases", () => {
  it("handles single-item budget", () => {
    const budget = [{ id: "b1", category: "Venue", planned: 1000, actual: 500, notes: "" }];
    const csv = generateBudgetCSV(budget, "USD");
    expect(csv).toContain("Venue");
    expect(csv).toContain("TOTAL");
  });

  it("handles empty notes", () => {
    const budget = [{ id: "b1", category: "Test", planned: 0, actual: 0, notes: "" }];
    const csv = generateBudgetCSV(budget, "INR");
    expect(csv).toBeTruthy();
  });
});
