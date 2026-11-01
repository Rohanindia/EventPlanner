/**
 * AI adapter — server-only module (Groq).
 * Builds structured prompts, calls the Groq API, validates output with Zod.
 * Falls back to template planner on any error or when no API key is configured.
 */

import Groq from "groq-sdk";
import type { EventInput, Plan } from "@/lib/validation";
import { BudgetSchema, TimelineSchema, VendorsSchema, IdeasSchema } from "@/lib/validation";
import { z } from "zod";
import { env } from "@/lib/env";
import { sanitizeInput } from "@/lib/security";
import { generateTemplatePlan } from "@/lib/planner";
import { generatePlanId } from "@/lib/storage";
import { todayString } from "@/lib/dates";
import { LRUCache } from "@/lib/security";
import crypto from "crypto";

// ===== Cache =====
const planCache = new LRUCache<Plan>(50, 10 * 60 * 1000); // 10 min TTL

function hashInput(input: EventInput): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ===== Groq Client =====

let _groqClient: Groq | null = null;

function getClient(): Groq | null {
  if (!env.GROQ_API_KEY) return null;
  if (!_groqClient) {
    _groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return _groqClient;
}

// ===== AI Response Schema (Zod) =====
const AIPlanResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  budget: BudgetSchema,
  timeline: TimelineSchema,
  vendors: VendorsSchema,
  ideas: IdeasSchema,
  tips: z.array(z.string().max(300)).max(15),
});

// ===== Prompt Builder =====

function buildSystemInstruction(): string {
  return `You are Jashn, an expert event planning assistant. 
Your role is ONLY to help with event planning: budgets, timelines, vendors, themes, and logistics.
You NEVER provide legal, medical, or financial advice. 
For permits and regulations, always advise the user to check local authorities.
You NEVER make assumptions about religion, caste, or culture unless explicitly stated by the user.
You respond in JSON only — no markdown, no explanations outside the JSON structure.`;
}

function buildPlanPrompt(input: EventInput): string {
  const safeInput = {
    eventType: input.eventType,
    name: sanitizeInput(input.name, 100),
    date: input.date,
    city: sanitizeInput(input.city, 100),
    guests: input.guests,
    totalBudget: input.totalBudget,
    currency: input.currency,
    theme: sanitizeInput(input.theme, 500),
    dietaryPreferences: sanitizeInput(input.dietaryPreferences, 500),
    culturalTraditions: sanitizeInput(input.culturalTraditions, 500),
    isIndoor: input.isIndoor,
    notes: sanitizeInput(input.notes, 2000),
    planLanguage: input.planLanguage,
  };

  const typeSpecific =
    input.eventType === "wedding"
      ? `Ceremonies: ${sanitizeInput(input.ceremonies ?? "", 500)}\nTraditions: ${sanitizeInput(input.traditions ?? "", 500)}`
      : input.eventType === "birthday"
        ? `Age: ${input.age ?? "unspecified"}\nMilestone: ${input.isMilestone}\nKids party: ${input.isKidsParty}`
        : `Purpose: ${sanitizeInput(input.purpose ?? "", 500)}\nPublic: ${input.isPublic}\nTicketed: ${input.isTicketed}\nVolunteers needed: ${input.volunteersNeeded}\nPermits required: ${input.permitsRequired}`;

  return `Generate a comprehensive ${safeInput.eventType} event plan for the following event. 
Respond ONLY in valid JSON matching this exact structure — no markdown, no extra text:
{
  "summary": "string",
  "budget": [{"id":"string","category":"string","planned":number,"actual":number,"notes":"string"}],
  "timeline": [{"id":"string","date":"YYYY-MM-DD","task":"string","category":"string","priority":"high|medium|low","done":false,"notes":"string"}],
  "vendors": [{"id":"string","category":"string","name":"string","contact":"string","costRangeLow":number,"costRangeHigh":number,"quotedAmount":number,"status":"string","questionsToAsk":["string"],"notes":"string"}],
  "ideas": {"themes":["string"],"decorPalette":["string"],"menuSuggestions":["string"],"activities":["string"],"favours":["string"],"moneySavingTips":["string"],"pinnedIds":[]},
  "tips": ["string"]
}

Use ${safeInput.planLanguage === "en" ? "English" : safeInput.planLanguage} language.

--- EVENT DETAILS START ---
Type: ${safeInput.eventType}
Name: ${safeInput.name}
Date: ${safeInput.date}
City: ${safeInput.city}
Guests: ${safeInput.guests}
Total Budget: ${safeInput.totalBudget} ${safeInput.currency}
Theme/Vibe: ${safeInput.theme || "Not specified"}
Dietary Preferences: ${safeInput.dietaryPreferences || "None specified"}
Cultural/Tradition Preferences: ${safeInput.culturalTraditions || "None specified"}
Venue Type: ${safeInput.isIndoor ? "Indoor" : "Outdoor"}
Additional Notes: ${safeInput.notes || "None"}
${typeSpecific}
--- EVENT DETAILS END ---

Requirements:
1. Budget: Allocate the EXACT total of ${safeInput.totalBudget} ${safeInput.currency} across categories. Sum must equal exactly ${safeInput.totalBudget}.
2. Timeline: Create dated tasks counting backward from ${safeInput.date}. Today is ${todayString()}. Dates must be >= today.
3. Vendors: 6-12 vendor categories relevant to a ${safeInput.eventType}. Include cost ranges in ${safeInput.currency}.
4. Ideas: Respect dietary preferences (${safeInput.dietaryPreferences || "none"}) in menu suggestions. No assumptions about religion/culture unless stated.
5. Tips: 5-10 actionable money-saving and planning tips.
6. NEVER include any legal/medical/financial advice — only advise checking local regulations.`;
}

// ===== Main Plan Generator =====

/** Generate a plan using Groq AI with fallback to template planner. */
export async function generateAIPlan(
  input: EventInput,
  signal?: AbortSignal,
): Promise<{ plan: Plan; isAiGenerated: boolean }> {
  const cacheKey = hashInput(input);
  const cached = planCache.get(cacheKey);
  if (cached) return { plan: cached, isAiGenerated: cached.isAiGenerated };

  const client = getClient();
  if (!client) {
    // Template fallback mode when no API key configured
    const plan = generateTemplatePlan(input);
    planCache.set(cacheKey, plan);
    return { plan, isAiGenerated: false };
  }

  try {
    const response = await client.chat.completions.create(
      {
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemInstruction() },
          { role: "user", content: buildPlanPrompt(input) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8192,
        temperature: 0.7,
      },
      { signal },
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Empty response from Groq");

    const parsed: unknown = JSON.parse(text);
    const validated = AIPlanResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[ai] Groq response failed validation:", validated.error.message);
      throw new Error("Invalid AI response structure");
    }

    const today = todayString();
    const plan: Plan = {
      id: generatePlanId(),
      version: 2,
      createdAt: today,
      updatedAt: today,
      input,
      ...validated.data,
      isAiGenerated: true,
    };

    planCache.set(cacheKey, plan);
    return { plan, isAiGenerated: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[ai] Groq call failed, using template fallback:", err);
    const plan = generateTemplatePlan(input);
    return { plan, isAiGenerated: false };
  }
}

// ===== Refine Sections =====

const RefineResponseSchema = z.object({
  budget: BudgetSchema.optional(),
  timeline: TimelineSchema.optional(),
  vendors: VendorsSchema.optional(),
  ideas: IdeasSchema.optional(),
  tips: z.array(z.string().max(300)).max(15).optional(),
  summary: z.string().max(2000).optional(),
});

export type RefineResponse = z.infer<typeof RefineResponseSchema>;

/** Refine parts of a plan via natural language instruction. */
export async function refineAIPlan(
  instruction: string,
  currentPlan: Plan,
  signal?: AbortSignal,
): Promise<RefineResponse> {
  const client = getClient();
  if (!client) return {};

  const safeInstruction = sanitizeInput(instruction, 500);

  const prompt = `You are Jashn, an event planning assistant. The user wants to refine their event plan.
Current plan summary: "${currentPlan.summary.slice(0, 300)}"
Event: ${currentPlan.input.eventType} for ${currentPlan.input.guests} guests, budget ${currentPlan.input.totalBudget} ${currentPlan.input.currency}

--- USER INSTRUCTION START ---
${safeInstruction}
--- USER INSTRUCTION END ---

Return a JSON object with ONLY the sections that need to change. 
Omit sections that should remain unchanged.
Maintain the exact same total budget (${currentPlan.input.totalBudget} ${currentPlan.input.currency}) if updating budget.`;

  try {
    const response = await client.chat.completions.create(
      {
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemInstruction() },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0.5,
      },
      { signal },
    );

    const text = response.choices[0]?.message?.content;
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    const result = RefineResponseSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[ai] Refine failed:", err);
    return {};
  }
}

// ===== Chat =====

const OFF_TOPIC_RESPONSE =
  "I'm Jashn, your event planning assistant! I can only help with event planning topics like budgets, timelines, vendors, themes, and logistics. Is there something about your event I can help with?";

const PLANNING_KEYWORDS = [
  "budget",
  "venue",
  "vendor",
  "catering",
  "decor",
  "decoration",
  "flower",
  "photo",
  "music",
  "dj",
  "band",
  "guest",
  "invite",
  "invitation",
  "timeline",
  "task",
  "date",
  "plan",
  "book",
  "cost",
  "price",
  "theme",
  "food",
  "menu",
  "wedding",
  "birthday",
  "party",
  "event",
  "ceremony",
  "reception",
  "cake",
  "transport",
  "hotel",
  "accommodation",
  "permit",
  "volunteer",
  "ticket",
  "entertainment",
  "activity",
  "favour",
  "gift",
  "checklist",
  "schedule",
];

function isOnTopic(message: string): boolean {
  const lower = message.toLowerCase();
  return PLANNING_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Answer a planning question grounded in the current plan. */
export async function chatWithAI(
  message: string,
  history: Array<{ role: "user" | "model"; text: string }>,
  currentPlan?: Plan,
  signal?: AbortSignal,
): Promise<string> {
  const safeMessage = sanitizeInput(message, 500);

  if (!isOnTopic(safeMessage)) {
    return OFF_TOPIC_RESPONSE;
  }

  const client = getClient();
  if (!client) {
    return "AI assistant is currently in offline mode. Please add a GROQ_API_KEY environment variable to enable live AI responses. Meanwhile, check your budget, timeline, and vendor tabs for complete recommendations!";
  }

  const contextBlock = currentPlan
    ? `--- CURRENT PLAN CONTEXT ---
Event: ${currentPlan.input.eventType} - ${currentPlan.input.name}
Date: ${currentPlan.input.date}, City: ${currentPlan.input.city}
Guests: ${currentPlan.input.guests}, Budget: ${currentPlan.input.totalBudget} ${currentPlan.input.currency}
Summary: ${currentPlan.summary.slice(0, 500)}
--- END CONTEXT ---`
    : "";

  const historyPrompt = history
    .slice(-10)
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${sanitizeInput(h.text, 300)}`)
    .join("\n");

  const prompt = `${contextBlock}

Conversation history:
${historyPrompt}

--- USER MESSAGE START ---
${safeMessage}
--- USER MESSAGE END ---

Respond helpfully and concisely as a friendly event planning assistant.
Do NOT provide legal, medical, or financial advice.
For permits/regulations, advise checking local authorities.`;

  try {
    const response = await client.chat.completions.create(
      {
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemInstruction() },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      },
      { signal },
    );

    return (
      response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again."
    );
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[ai] Chat failed:", err);
    return "Sorry, I encountered an error. Please try again.";
  }
}
