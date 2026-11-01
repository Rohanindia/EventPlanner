import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(globalThis, "window", {
  value: { localStorage: localStorageMock },
  writable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

import {
  readPlan,
  writePlan,
  writePlanImmediate,
  deletePlan,
  eraseAllData,
  listPlans,
  listPlanIds,
  generatePlanId,
} from "@/lib/storage";
import type { Plan } from "@/lib/validation";

const makePlan = (id: string): Plan => ({
  id,
  version: 2,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  isAiGenerated: false,
  input: {
    eventType: "wedding",
    name: "Test Event",
    date: "2027-06-15",
    city: "Mumbai",
    guests: 100,
    totalBudget: 500000,
    currency: "INR",
    theme: "",
    dietaryPreferences: "",
    culturalTraditions: "",
    isIndoor: true,
    notes: "",
    planLanguage: "en",
    ceremonies: "",
    traditions: "",
  },
  summary: "Test summary",
  budget: [{ id: "b1", category: "Venue", planned: 500000, actual: 0, notes: "" }],
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
    menuSuggestions: ["Food"],
    activities: ["Dance"],
    favours: ["Gift"],
    moneySavingTips: ["Save"],
    pinnedIds: [],
  },
  tips: ["Tip 1"],
});

describe("storage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("generatePlanId", () => {
    it("generates unique IDs", () => {
      const id1 = generatePlanId();
      const id2 = generatePlanId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^plan_/);
    });
  });

  describe("writePlanImmediate and readPlan", () => {
    it("writes and reads a plan", () => {
      const plan = makePlan("test-1");
      writePlanImmediate(plan);
      const read = readPlan("test-1");
      expect(read).not.toBeNull();
      expect(read?.id).toBe("test-1");
      expect(read?.input.name).toBe("Test Event");
    });

    it("returns null for non-existent plan", () => {
      expect(readPlan("nonexistent")).toBeNull();
    });

    it("returns null for corrupted data", () => {
      localStorageMock.setItem("jashn_plan_bad", "not-json");
      expect(readPlan("bad")).toBeNull();
    });

    it("returns null for invalid plan schema", () => {
      localStorageMock.setItem("jashn_plan_invalid", JSON.stringify({ id: "invalid" }));
      expect(readPlan("invalid")).toBeNull();
    });
  });

  describe("writePlan (debounced)", () => {
    it("schedules debounced write without throwing", () => {
      const plan = makePlan("test-debounced");
      expect(() => writePlan(plan)).not.toThrow();
    });
  });

  describe("deletePlan", () => {
    it("deletes a plan", () => {
      const plan = makePlan("del-1");
      writePlanImmediate(plan);
      expect(readPlan("del-1")).not.toBeNull();
      deletePlan("del-1");
      expect(readPlan("del-1")).toBeNull();
    });

    it("handles deleting non-existent plan gracefully", () => {
      expect(() => deletePlan("nonexistent")).not.toThrow();
    });
  });

  describe("listPlans and listPlanIds", () => {
    it("lists saved plans", () => {
      writePlanImmediate(makePlan("list-1"));
      writePlanImmediate(makePlan("list-2"));
      const ids = listPlanIds();
      expect(ids).toContain("list-1");
      expect(ids).toContain("list-2");
      const plans = listPlans();
      expect(plans.length).toBe(2);
    });

    it("returns empty for no saved plans", () => {
      expect(listPlans()).toEqual([]);
      expect(listPlanIds()).toEqual([]);
    });

    it("skips corrupted entries", () => {
      writePlanImmediate(makePlan("good-1"));
      localStorageMock.setItem("jashn_plan_corrupt", "{bad}");
      const plans = listPlans();
      expect(plans.length).toBe(1);
    });
  });

  describe("eraseAllData", () => {
    it("removes all jashn keys", () => {
      writePlanImmediate(makePlan("erase-1"));
      writePlanImmediate(makePlan("erase-2"));
      eraseAllData();
      expect(listPlans()).toEqual([]);
    });
  });
});
