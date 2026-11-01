import { z } from "zod";
import { PlanSchema } from "@/lib/validation";
import type { Plan } from "@/lib/validation";

// ===== Constants =====
const STORAGE_KEY_PREFIX = "jashn_plan_";
const STORAGE_INDEX_KEY = "jashn_plans_index";
const STORAGE_VERSION = 2;
const MAX_PLANS = 20;

// ===== Types =====
interface PlansIndex {
  ids: string[];
  version: number;
}

const PlansIndexSchema = z.object({
  ids: z.array(z.string().min(1).max(50)).max(MAX_PLANS),
  version: z.literal(2),
});

// ===== Storage Adapter (isomorphic) =====

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// ===== Read / Write with Zod Validation =====

/** Read a plan from localStorage, validating with Zod. Returns null if absent or invalid. */
export function readPlan(id: string): Plan | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = PlanSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(`[storage] Plan ${id} failed validation:`, result.error.message);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

/** Write a plan to localStorage. Debounce writes to avoid excessive I/O. */
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export function writePlan(plan: Plan): void {
  const storage = getStorage();
  if (!storage) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      storage.setItem(`${STORAGE_KEY_PREFIX}${plan.id}`, JSON.stringify(plan));
      // Update index
      const index = readIndex();
      if (!index.ids.includes(plan.id)) {
        index.ids = [...index.ids.slice(-(MAX_PLANS - 1)), plan.id];
        writeIndex(index);
      }
    } catch (e) {
      console.error("[storage] Failed to write plan:", e);
    }
  }, 300);
}

/** Write immediately without debounce (for explicit saves). */
export function writePlanImmediate(plan: Plan): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${STORAGE_KEY_PREFIX}${plan.id}`, JSON.stringify(plan));
    const index = readIndex();
    if (!index.ids.includes(plan.id)) {
      index.ids = [...index.ids.slice(-(MAX_PLANS - 1)), plan.id];
      writeIndex(index);
    }
  } catch (e) {
    console.error("[storage] Failed to write plan:", e);
  }
}

/** Delete a plan. */
export function deletePlan(id: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    const index = readIndex();
    index.ids = index.ids.filter((i) => i !== id);
    writeIndex(index);
  } catch (e) {
    console.error("[storage] Failed to delete plan:", e);
  }
}

/** Delete ALL Jashn data from localStorage. */
export function eraseAllData(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith("jashn_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch (e) {
    console.error("[storage] Failed to erase data:", e);
  }
}

/** List all stored plan IDs. */
export function listPlanIds(): string[] {
  return readIndex().ids;
}

/** List all stored plans (skipping corrupt entries). */
export function listPlans(): Plan[] {
  return listPlanIds()
    .map(readPlan)
    .filter((p): p is Plan => p !== null);
}

// ===== Index helpers =====

function readIndex(): PlansIndex {
  const storage = getStorage();
  if (!storage) return { ids: [], version: STORAGE_VERSION };
  try {
    const raw = storage.getItem(STORAGE_INDEX_KEY);
    if (!raw) return { ids: [], version: STORAGE_VERSION };
    const parsed: unknown = JSON.parse(raw);
    const result = PlansIndexSchema.safeParse(parsed);
    if (!result.success) return { ids: [], version: STORAGE_VERSION };
    return result.data;
  } catch {
    return { ids: [], version: STORAGE_VERSION };
  }
}

function writeIndex(index: PlansIndex): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Quota exceeded — silently fail
  }
}

// ===== ID Generation =====

/** Generate a unique plan ID. */
export function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
