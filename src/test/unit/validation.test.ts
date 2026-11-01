import { describe, it, expect } from "vitest";
import { EventInputSchema, PlanSchema, BudgetSchema } from "@/lib/validation";

describe("EventInputSchema - wedding", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = tomorrow.toISOString().slice(0, 10);

  const valid = {
    eventType: "wedding" as const,
    name: "Test Wedding",
    date: futureDate,
    city: "Mumbai",
    guests: 200,
    totalBudget: 500000,
    currency: "INR" as const,
    theme: "",
    dietaryPreferences: "",
    culturalTraditions: "",
    isIndoor: true,
    notes: "",
    planLanguage: "en" as const,
    ceremonies: "",
    traditions: "",
  };

  it("accepts valid wedding input", () => {
    expect(EventInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects past event dates", () => {
    const result = EventInputSchema.safeParse({ ...valid, date: "2020-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects guests > 5000", () => {
    const result = EventInputSchema.safeParse({ ...valid, guests: 5001 });
    expect(result.success).toBe(false);
  });

  it("rejects guests < 1", () => {
    const result = EventInputSchema.safeParse({ ...valid, guests: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid currency", () => {
    const result = EventInputSchema.safeParse({ ...valid, currency: "XYZ" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = EventInputSchema.safeParse({ ...valid, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = EventInputSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 2000 chars", () => {
    const result = EventInputSchema.safeParse({ ...valid, notes: "n".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("BudgetSchema", () => {
  it("accepts valid budget items", () => {
    const budget = [{ id: "b1", category: "Venue", planned: 50000, actual: 0, notes: "" }];
    expect(BudgetSchema.safeParse(budget).success).toBe(true);
  });

  it("rejects negative planned values", () => {
    const budget = [{ id: "b1", category: "Venue", planned: -1000, actual: 0, notes: "" }];
    expect(BudgetSchema.safeParse(budget).success).toBe(false);
  });

  it("rejects empty budget array", () => {
    expect(BudgetSchema.safeParse([]).success).toBe(false);
  });
});

describe("EventInputSchema - birthday", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = tomorrow.toISOString().slice(0, 10);

  const valid = {
    eventType: "birthday" as const,
    name: "Raj's 30th",
    date: futureDate,
    city: "Bangalore",
    guests: 50,
    totalBudget: 100000,
    currency: "INR" as const,
    theme: "",
    dietaryPreferences: "",
    culturalTraditions: "",
    isIndoor: true,
    notes: "",
    planLanguage: "en" as const,
    isMilestone: true,
    isKidsParty: false,
  };

  it("accepts valid birthday input", () => {
    expect(EventInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional age field", () => {
    const result = EventInputSchema.safeParse({ ...valid, age: 30 });
    expect(result.success).toBe(true);
  });

  it("rejects age > 150", () => {
    const result = EventInputSchema.safeParse({ ...valid, age: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects budget below minimum", () => {
    const result = EventInputSchema.safeParse({ ...valid, totalBudget: 50 });
    expect(result.success).toBe(false);
  });
});

describe("EventInputSchema - community", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = tomorrow.toISOString().slice(0, 10);

  const valid = {
    eventType: "community" as const,
    name: "Heritage Festival",
    date: futureDate,
    city: "Delhi",
    guests: 1000,
    totalBudget: 500000,
    currency: "INR" as const,
    theme: "",
    dietaryPreferences: "",
    culturalTraditions: "",
    isIndoor: false,
    notes: "",
    planLanguage: "en" as const,
    purpose: "Cultural celebration",
    isPublic: true,
    isTicketed: false,
    volunteersNeeded: 20,
    permitsRequired: true,
  };

  it("accepts valid community input", () => {
    expect(EventInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid event type", () => {
    const result = EventInputSchema.safeParse({ ...valid, eventType: "concert" });
    expect(result.success).toBe(false);
  });

  it("rejects volunteers > 10000", () => {
    const result = EventInputSchema.safeParse({ ...valid, volunteersNeeded: 10001 });
    expect(result.success).toBe(false);
  });
});

describe("PlanSchema", () => {
  it("rejects plan with wrong version", () => {
    const result = PlanSchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
  });
});
