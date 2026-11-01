import { describe, it, expect } from "vitest";
import { generateTemplatePlan } from "@/lib/planner";
import type { EventInput } from "@/lib/validation";

const baseWedding: EventInput = {
  eventType: "wedding",
  name: "Priya & Arjun Wedding",
  date: "2027-03-15",
  city: "Mumbai",
  guests: 300,
  totalBudget: 2_000_000,
  currency: "INR",
  theme: "Rustic elegance",
  dietaryPreferences: "Vegetarian",
  culturalTraditions: "",
  isIndoor: true,
  notes: "",
  planLanguage: "en",
  ceremonies: "Mehendi, Sangeet, Wedding",
  traditions: "",
};

const baseBirthday: EventInput = {
  eventType: "birthday",
  name: "Raj's 30th",
  date: "2027-06-20",
  city: "Bangalore",
  guests: 50,
  totalBudget: 100_000,
  currency: "INR",
  theme: "",
  dietaryPreferences: "",
  culturalTraditions: "",
  isIndoor: true,
  notes: "",
  planLanguage: "en",
  isMilestone: true,
  isKidsParty: false,
};

const baseCommunity: EventInput = {
  eventType: "community",
  name: "Heritage Festival 2027",
  date: "2027-11-01",
  city: "Delhi",
  guests: 1000,
  totalBudget: 500_000,
  currency: "INR",
  theme: "",
  dietaryPreferences: "",
  culturalTraditions: "",
  isIndoor: false,
  notes: "",
  planLanguage: "en",
  purpose: "Annual cultural festival",
  isPublic: true,
  isTicketed: false,
  volunteersNeeded: 20,
  permitsRequired: true,
};

describe("generateTemplatePlan - wedding", () => {
  it("generates a valid plan structure", () => {
    const plan = generateTemplatePlan(baseWedding);
    expect(plan.id).toBeTruthy();
    expect(plan.version).toBe(2);
    expect(plan.isAiGenerated).toBe(false);
    expect(plan.budget.length).toBeGreaterThan(0);
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.vendors.length).toBeGreaterThan(0);
  });

  it("budget sums exactly to totalBudget", () => {
    const plan = generateTemplatePlan(baseWedding);
    const sum = plan.budget.reduce((s, b) => s + b.planned, 0);
    expect(sum).toBe(baseWedding.totalBudget);
  });

  it("all timeline dates are in the future or today", () => {
    const plan = generateTemplatePlan(baseWedding);
    const today = new Date().toISOString().slice(0, 10);
    plan.timeline.forEach((t) => {
      expect(t.date >= today).toBe(true);
    });
  });

  it("includes dietary preferences in menu suggestions", () => {
    const plan = generateTemplatePlan(baseWedding);
    const menuText = plan.ideas.menuSuggestions.join(" ");
    expect(menuText.toLowerCase()).toContain("vegetarian");
  });

  it("summary is non-empty", () => {
    const plan = generateTemplatePlan(baseWedding);
    expect(plan.summary.length).toBeGreaterThan(20);
  });
});

describe("generateTemplatePlan - birthday", () => {
  it("generates plan with birthday-specific vendors", () => {
    const plan = generateTemplatePlan(baseBirthday);
    const categories = plan.vendors.map((v) => v.category);
    expect(categories.some((c) => c.toLowerCase().includes("cake"))).toBe(true);
  });

  it("budget sums exactly to totalBudget", () => {
    const plan = generateTemplatePlan(baseBirthday);
    const sum = plan.budget.reduce((s, b) => s + b.planned, 0);
    expect(sum).toBe(baseBirthday.totalBudget);
  });
});

describe("generateTemplatePlan - community", () => {
  it("generates plan with community-specific vendors", () => {
    const plan = generateTemplatePlan(baseCommunity);
    const categories = plan.vendors.map((v) => v.category);
    expect(
      categories.some((c) => c.toLowerCase().includes("av") || c.toLowerCase().includes("audio")),
    ).toBe(true);
  });

  it("budget sums exactly to totalBudget", () => {
    const plan = generateTemplatePlan(baseCommunity);
    const sum = plan.budget.reduce((s, b) => s + b.planned, 0);
    expect(sum).toBe(baseCommunity.totalBudget);
  });

  it("includes tips", () => {
    const plan = generateTemplatePlan(baseCommunity);
    expect(plan.tips.length).toBeGreaterThan(0);
  });
});

describe("generateTemplatePlan - near-date compression", () => {
  it("handles event tomorrow without crashing", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    const plan = generateTemplatePlan({ ...baseBirthday, date: dateStr });
    expect(plan.timeline.length).toBeGreaterThan(0);
    // All dates should be today or tomorrow
    plan.timeline.forEach((t) => {
      expect(t.date >= new Date().toISOString().slice(0, 10)).toBe(true);
    });
  });
});
