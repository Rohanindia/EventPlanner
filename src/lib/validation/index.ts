import { z } from "zod";

// ===== Constants =====
export const EVENT_TYPES = ["wedding", "birthday", "community"] as const;
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;
export const PLAN_LANGUAGES = ["en", "hi", "kn", "ta", "te"] as const;
export const VENDOR_STATUSES = ["not_started", "shortlisted", "quoted", "booked", "paid"] as const;

export const MAX_GUESTS = 5000;
export const MIN_GUESTS = 1;
export const MAX_BUDGET = 1_000_000_000;
export const MIN_BUDGET = 100;
export const MAX_TEXT_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;
export const MAX_CITY_LENGTH = 100;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_REQUEST_BODY_BYTES = 32 * 1024; // 32 KB

// ===== Event Input Schema =====
const BaseEventSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  name: z.string().min(1).max(MAX_NAME_LENGTH).trim(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(d) > new Date(), { message: "Event date must be in the future" }),
  city: z.string().min(1).max(MAX_CITY_LENGTH).trim(),
  guests: z.number().int().min(MIN_GUESTS).max(MAX_GUESTS),
  totalBudget: z.number().positive().min(MIN_BUDGET).max(MAX_BUDGET),
  currency: z.enum(CURRENCIES),
  theme: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
  dietaryPreferences: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
  culturalTraditions: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
  isIndoor: z.boolean().default(true),
  notes: z.string().max(MAX_NOTES_LENGTH).trim().default(""),
  planLanguage: z.enum(PLAN_LANGUAGES).default("en"),
});

const WeddingFieldsSchema = z.object({
  ceremonies: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
  traditions: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
});

const BirthdayFieldsSchema = z.object({
  age: z.number().int().min(0).max(150).optional(),
  isMilestone: z.boolean().default(false),
  isKidsParty: z.boolean().default(false),
});

const CommunityFieldsSchema = z.object({
  purpose: z.string().max(MAX_TEXT_LENGTH).trim().default(""),
  isPublic: z.boolean().default(true),
  isTicketed: z.boolean().default(false),
  volunteersNeeded: z.number().int().min(0).max(10000).default(0),
  permitsRequired: z.boolean().default(false),
});

export const EventInputSchema = BaseEventSchema.and(
  z.discriminatedUnion("eventType", [
    z.object({ eventType: z.literal("wedding") }).merge(WeddingFieldsSchema),
    z.object({ eventType: z.literal("birthday") }).merge(BirthdayFieldsSchema),
    z.object({ eventType: z.literal("community") }).merge(CommunityFieldsSchema),
  ]),
);

export type EventInput = z.infer<typeof EventInputSchema>;

// ===== Budget Schema =====
export const BudgetItemSchema = z.object({
  id: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  planned: z.number().nonnegative(),
  actual: z.number().nonnegative().default(0),
  notes: z.string().max(MAX_TEXT_LENGTH).default(""),
});

export type BudgetItem = z.infer<typeof BudgetItemSchema>;

export const BudgetSchema = z.array(BudgetItemSchema).min(1).max(30);
export type Budget = z.infer<typeof BudgetSchema>;

// ===== Timeline Schema =====
export const TimelineItemSchema = z.object({
  id: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task: z.string().min(1).max(200),
  category: z.string().max(100),
  priority: z.enum(["high", "medium", "low"]),
  done: z.boolean().default(false),
  notes: z.string().max(MAX_TEXT_LENGTH).default(""),
});

export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export const TimelineSchema = z.array(TimelineItemSchema).min(1).max(200);
export type Timeline = z.infer<typeof TimelineSchema>;

// ===== Vendor Schema =====
export const VendorItemSchema = z.object({
  id: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  name: z.string().max(MAX_NAME_LENGTH).default(""),
  contact: z.string().max(MAX_TEXT_LENGTH).default(""),
  costRangeLow: z.number().nonnegative().default(0),
  costRangeHigh: z.number().nonnegative().default(0),
  quotedAmount: z.number().nonnegative().default(0),
  status: z.enum(VENDOR_STATUSES).default("not_started"),
  questionsToAsk: z.array(z.string().max(200)).max(10).default([]),
  notes: z.string().max(MAX_TEXT_LENGTH).default(""),
});

export type VendorItem = z.infer<typeof VendorItemSchema>;
export const VendorsSchema = z.array(VendorItemSchema).min(1).max(50);
export type Vendors = z.infer<typeof VendorsSchema>;

// ===== Ideas Schema =====
export const IdeasSchema = z.object({
  themes: z.array(z.string().max(200)).max(10),
  decorPalette: z.array(z.string().max(100)).max(10),
  menuSuggestions: z.array(z.string().max(200)).max(20),
  activities: z.array(z.string().max(200)).max(15),
  favours: z.array(z.string().max(200)).max(10),
  moneySavingTips: z.array(z.string().max(300)).max(10),
  pinnedIds: z.array(z.string().max(50)).default([]),
});

export type Ideas = z.infer<typeof IdeasSchema>;

// ===== Full Plan Schema =====
export const PlanSchema = z.object({
  id: z.string().min(1).max(50),
  version: z.literal(2),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: EventInputSchema,
  summary: z.string().min(1).max(2000),
  budget: BudgetSchema,
  timeline: TimelineSchema,
  vendors: VendorsSchema,
  ideas: IdeasSchema,
  tips: z.array(z.string().max(300)).max(15),
  isAiGenerated: z.boolean(),
});

export type Plan = z.infer<typeof PlanSchema>;

// ===== API Request/Response Schemas =====
export const PlanRequestSchema = z.object({
  input: EventInputSchema,
});

export const RefineRequestSchema = z.object({
  planId: z.string().min(1).max(50),
  instruction: z.string().min(1).max(500).trim(),
  currentPlan: PlanSchema,
});

export const ChatRequestSchema = z.object({
  planId: z.string().min(1).max(50),
  message: z.string().min(1).max(500).trim(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(1000),
      }),
    )
    .max(20)
    .default([]),
  currentPlan: PlanSchema.optional(),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type RefineRequest = z.infer<typeof RefineRequestSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ===== Typed Result Type =====
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}
