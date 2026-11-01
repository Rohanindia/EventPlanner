import type { EventInput, Plan, Budget, Timeline, Vendors, Ideas } from "@/lib/validation";
import { distributeByLargestRemainder } from "@/lib/money";
import { addDays, todayString } from "@/lib/dates";
import { generatePlanId } from "@/lib/storage";

// ===== Budget Category Ratios =====

const WEDDING_RATIOS: { category: string; ratio: number }[] = [
  { category: "Venue & Decor", ratio: 25 },
  { category: "Catering & Food", ratio: 30 },
  { category: "Photography & Video", ratio: 12 },
  { category: "Music & Entertainment", ratio: 8 },
  { category: "Flowers & Bouquets", ratio: 6 },
  { category: "Bridal Attire & Jewellery", ratio: 8 },
  { category: "Invitations & Stationery", ratio: 2 },
  { category: "Transportation", ratio: 3 },
  { category: "Honeymoon", ratio: 4 },
  { category: "Miscellaneous & Contingency", ratio: 2 },
];

const BIRTHDAY_RATIOS: { category: string; ratio: number }[] = [
  { category: "Venue", ratio: 25 },
  { category: "Catering & Cake", ratio: 35 },
  { category: "Decorations", ratio: 15 },
  { category: "Entertainment & Activities", ratio: 15 },
  { category: "Invitations & Favours", ratio: 5 },
  { category: "Photography", ratio: 5 },
];

const COMMUNITY_RATIOS: { category: string; ratio: number }[] = [
  { category: "Venue & Infrastructure", ratio: 30 },
  { category: "Food & Beverages", ratio: 25 },
  { category: "Audio-Visual & Tech", ratio: 15 },
  { category: "Marketing & Promotions", ratio: 10 },
  { category: "Permits & Insurance", ratio: 5 },
  { category: "Volunteer Coordination", ratio: 5 },
  { category: "Contingency", ratio: 10 },
];

// ===== Timeline Template =====

interface TaskTemplate {
  daysBeforeEvent: number;
  task: string;
  category: string;
  priority: "high" | "medium" | "low";
}

const WEDDING_TASKS: TaskTemplate[] = [
  {
    daysBeforeEvent: 365,
    task: "Set overall budget and guest list",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 360,
    task: "Choose and book wedding venue",
    category: "Venue",
    priority: "high",
  },
  {
    daysBeforeEvent: 330,
    task: "Hire wedding planner / coordinator",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 300,
    task: "Book officiant / pandit / priest",
    category: "Ceremonies",
    priority: "high",
  },
  {
    daysBeforeEvent: 270,
    task: "Book photographer and videographer",
    category: "Photography",
    priority: "high",
  },
  {
    daysBeforeEvent: 240,
    task: "Book caterer and finalize menu",
    category: "Catering",
    priority: "high",
  },
  {
    daysBeforeEvent: 210,
    task: "Purchase / order wedding attire",
    category: "Attire",
    priority: "high",
  },
  {
    daysBeforeEvent: 180,
    task: "Send save-the-dates",
    category: "Invitations",
    priority: "medium",
  },
  {
    daysBeforeEvent: 150,
    task: "Book florist and décor vendor",
    category: "Decor",
    priority: "medium",
  },
  {
    daysBeforeEvent: 120,
    task: "Send formal invitations",
    category: "Invitations",
    priority: "high",
  },
  {
    daysBeforeEvent: 90,
    task: "Book musicians / DJ / entertainment",
    category: "Entertainment",
    priority: "medium",
  },
  {
    daysBeforeEvent: 60,
    task: "Arrange transportation",
    category: "Logistics",
    priority: "medium",
  },
  {
    daysBeforeEvent: 45,
    task: "Confirm headcount with caterer",
    category: "Catering",
    priority: "high",
  },
  {
    daysBeforeEvent: 30,
    task: "Final fitting for all attire",
    category: "Attire",
    priority: "high",
  },
  {
    daysBeforeEvent: 21,
    task: "Prepare vendor payment schedule",
    category: "Finance",
    priority: "high",
  },
  {
    daysBeforeEvent: 14,
    task: "Confirm all vendors and timings",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 7,
    task: "Prepare emergency kit and day-of checklist",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 3,
    task: "Deliver decorations to venue",
    category: "Decor",
    priority: "medium",
  },
  {
    daysBeforeEvent: 1,
    task: "Rehearsal and briefing for wedding party",
    category: "Ceremonies",
    priority: "high",
  },
];

const BIRTHDAY_TASKS: TaskTemplate[] = [
  {
    daysBeforeEvent: 60,
    task: "Decide on theme and guest list",
    category: "Planning",
    priority: "high",
  },
  { daysBeforeEvent: 45, task: "Book venue", category: "Venue", priority: "high" },
  { daysBeforeEvent: 40, task: "Send invitations", category: "Invitations", priority: "high" },
  { daysBeforeEvent: 30, task: "Order birthday cake", category: "Catering", priority: "high" },
  {
    daysBeforeEvent: 21,
    task: "Book entertainment / activities",
    category: "Entertainment",
    priority: "medium",
  },
  { daysBeforeEvent: 14, task: "Purchase decorations", category: "Decor", priority: "medium" },
  {
    daysBeforeEvent: 7,
    task: "Confirm RSVPs and finalize headcount",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 3,
    task: "Prepare goodie bags / favours",
    category: "Favours",
    priority: "low",
  },
  { daysBeforeEvent: 1, task: "Set up decorations at venue", category: "Decor", priority: "high" },
];

const COMMUNITY_TASKS: TaskTemplate[] = [
  {
    daysBeforeEvent: 90,
    task: "Define event goals and target audience",
    category: "Planning",
    priority: "high",
  },
  {
    daysBeforeEvent: 80,
    task: "Apply for permits and licenses",
    category: "Legal",
    priority: "high",
  },
  { daysBeforeEvent: 70, task: "Book venue / outdoor space", category: "Venue", priority: "high" },
  {
    daysBeforeEvent: 60,
    task: "Launch registration / ticketing",
    category: "Marketing",
    priority: "high",
  },
  {
    daysBeforeEvent: 50,
    task: "Recruit and brief volunteers",
    category: "Volunteers",
    priority: "high",
  },
  {
    daysBeforeEvent: 40,
    task: "Arrange food and beverages",
    category: "Catering",
    priority: "medium",
  },
  {
    daysBeforeEvent: 30,
    task: "Book audio-visual and tech vendors",
    category: "AV & Tech",
    priority: "high",
  },
  {
    daysBeforeEvent: 21,
    task: "Confirm speaker / performer lineup",
    category: "Program",
    priority: "high",
  },
  {
    daysBeforeEvent: 14,
    task: "Send reminder to registrants",
    category: "Marketing",
    priority: "medium",
  },
  {
    daysBeforeEvent: 7,
    task: "Confirm all logistics with venue",
    category: "Logistics",
    priority: "high",
  },
  {
    daysBeforeEvent: 3,
    task: "Final briefing with all volunteers",
    category: "Volunteers",
    priority: "high",
  },
  {
    daysBeforeEvent: 1,
    task: "Set up venue and conduct safety walkthrough",
    category: "Venue",
    priority: "high",
  },
];

// ===== Vendor Templates =====

const WEDDING_VENDORS = [
  "Venue",
  "Caterer",
  "Photographer",
  "Videographer",
  "Florist",
  "Music / DJ",
  "Wedding Coordinator",
  "Bridal Attire",
  "Groom Attire",
  "Cake & Desserts",
  "Transportation",
  "Officiant",
];

const BIRTHDAY_VENDORS = [
  "Venue",
  "Caterer",
  "Cake Artist",
  "Photographer",
  "Decorator",
  "Entertainment / Entertainer",
];

const COMMUNITY_VENDORS = [
  "Venue",
  "Catering",
  "AV & Sound",
  "Stage & Infrastructure",
  "Security",
  "Photography",
  "Marketing Agency",
];

const VENDOR_QUESTIONS: Record<string, string[]> = {
  default: [
    "What is your availability on our event date?",
    "Can you provide references or a portfolio?",
    "What is included in your base package?",
    "What are your payment terms and cancellation policy?",
    "Do you have liability insurance?",
  ],
  Caterer: [
    "Can you accommodate dietary restrictions?",
    "Do you provide tastings?",
    "What is your per-head cost?",
    "Do you provide serving staff?",
    "How do you handle excess food?",
  ],
  Photographer: [
    "How many hours are included?",
    "When will we receive the edited photos?",
    "Do you provide a second shooter?",
    "Who owns the copyright?",
    "What backup equipment do you carry?",
  ],
};

// ===== Idea Templates =====

const WEDDING_IDEAS = {
  themes: [
    "Rustic Elegance with Marigold Draping",
    "Minimalist White & Gold Luxury",
    "Bohemian Garden with Wildflowers",
    "Royal Mughal Inspired Grandeur",
    "Coastal / Beach Sunset Romance",
  ],
  decorPalette: ["Ivory & Gold", "Blush & Rose Gold", "Sage & White", "Terracotta & Marigold"],
  activities: [
    "Interactive photo booth with custom props",
    "Live mehendi artist",
    "Cocktail mixology station",
    "Acoustic live music during dinner",
    "Personalized wedding video slideshow",
  ],
  favours: [
    "Personalized candles",
    "Custom name-stamp cookies",
    "Miniature potted plants",
    "Handmade chocolates",
  ],
  moneySavingTips: [
    "Book venue on a weekday for up to 30% savings",
    "Use seasonal flowers — 40% cheaper than exotic blooms",
    "Opt for a dessert table instead of a tiered wedding cake",
    "Digital invitations save printing and postage costs",
    "Limit the open bar to wine & beer to cut beverage costs",
  ],
};

const BIRTHDAY_IDEAS = {
  themes: [
    "Retro Bollywood Night",
    "Garden Afternoon Tea Party",
    "Superhero Adventure",
    "Tropical Luau",
    "Decades Theme (pick a decade)",
  ],
  decorPalette: [
    "Pastel Rainbow",
    "Black & Gold Glam",
    "Tropical Green & Yellow",
    "Vintage Pink & Ivory",
  ],
  activities: [
    "DIY craft station",
    "Karaoke or music bingo",
    "Photo scavenger hunt",
    "Customized trivia about the birthday person",
    "Live caricature artist",
  ],
  favours: [
    "Personalised thank-you cards",
    "Mini succulent plants",
    "Customized bookmarks",
    "DIY cookie decorating kits",
  ],
  moneySavingTips: [
    "Host at home or a park — saves venue costs",
    "DIY decorations using crêpe paper and balloons",
    "Potluck style — guests contribute a dish",
    "Make a playlist instead of hiring a DJ",
    "Order cake from a local home baker",
  ],
};

const COMMUNITY_IDEAS = {
  themes: [
    "Cultural Heritage Festival",
    "Sustainability & Green Expo",
    "Youth Empowerment Summit",
    "Local Arts & Music Carnival",
    "Community Health & Wellness Fair",
  ],
  decorPalette: ["Vibrant Primary Colours", "Earthy Natural Tones", "Brand Colours with White"],
  activities: [
    "Panel discussions and Q&A sessions",
    "Live cultural performances",
    "Stall exhibitions and demos",
    "Networking mixer",
    "Awards and recognition ceremony",
  ],
  favours: [
    "Branded tote bags",
    "Seed packets for planting",
    "Notepads and pens",
    "Local artisan products",
  ],
  moneySavingTips: [
    "Partner with local businesses for sponsorships",
    "Use volunteer photographers",
    "Apply for government or NGO grants",
    "Promote via social media to avoid printing costs",
    "Request in-kind donations instead of cash",
  ],
};

// ===== Main Template Planner =====

/** Generate a deterministic fallback plan from event input (no AI required). */
export function generateTemplatePlan(input: EventInput): Plan {
  const today = todayString();
  const id = generatePlanId();

  const budget = buildBudget(input);
  const timeline = buildTimeline(input);
  const vendors = buildVendors(input);
  const ideas = buildIdeas(input);
  const summary = buildSummary(input);
  const tips = buildTips(input);

  return {
    id,
    version: 2,
    createdAt: today,
    updatedAt: today,
    input,
    summary,
    budget,
    timeline,
    vendors,
    ideas,
    tips,
    isAiGenerated: false,
  };
}

function buildBudget(input: EventInput): Budget {
  const ratios =
    input.eventType === "wedding"
      ? WEDDING_RATIOS
      : input.eventType === "birthday"
        ? BIRTHDAY_RATIOS
        : COMMUNITY_RATIOS;

  const amounts = distributeByLargestRemainder(
    Math.round(input.totalBudget),
    ratios.map((r) => r.ratio),
  );

  return ratios.map((r, i) => ({
    id: `budget_${i + 1}`,
    category: r.category,
    planned: amounts[i] ?? 0,
    actual: 0,
    notes: "",
  }));
}

function buildTimeline(input: EventInput): Timeline {
  const templates =
    input.eventType === "wedding"
      ? WEDDING_TASKS
      : input.eventType === "birthday"
        ? BIRTHDAY_TASKS
        : COMMUNITY_TASKS;

  const today = todayString();
  const daysToEvent = Math.max(
    0,
    Math.round((new Date(input.date).getTime() - new Date(today).getTime()) / 86_400_000),
  );

  return templates.map((t, i) => {
    // Compress: if event is soon, scale all offsets proportionally
    const scaledOffset = Math.min(t.daysBeforeEvent, Math.round(daysToEvent * 0.95));
    const taskDate = addDays(input.date, -scaledOffset);
    const clampedDate = taskDate < today ? today : taskDate;

    return {
      id: `task_${i + 1}`,
      date: clampedDate,
      task: t.task,
      category: t.category,
      priority: t.priority,
      done: false,
      notes: "",
    };
  });
}

function buildVendors(input: EventInput): Vendors {
  const categories =
    input.eventType === "wedding"
      ? WEDDING_VENDORS
      : input.eventType === "birthday"
        ? BIRTHDAY_VENDORS
        : COMMUNITY_VENDORS;

  return categories.map((cat, i) => ({
    id: `vendor_${i + 1}`,
    category: cat,
    name: "",
    contact: "",
    costRangeLow: 0,
    costRangeHigh: 0,
    quotedAmount: 0,
    status: "not_started" as const,
    questionsToAsk: VENDOR_QUESTIONS[cat] ?? VENDOR_QUESTIONS["default"] ?? [],
    notes: "",
  }));
}

function buildIdeas(input: EventInput): Ideas {
  const base =
    input.eventType === "wedding"
      ? WEDDING_IDEAS
      : input.eventType === "birthday"
        ? BIRTHDAY_IDEAS
        : COMMUNITY_IDEAS;

  const menuBase = input.dietaryPreferences
    ? [`Menu tailored to: ${input.dietaryPreferences}`]
    : [];

  const menuSuggestions = [
    ...menuBase,
    ...(input.eventType === "wedding"
      ? [
          "4-course sit-down dinner with appetisers",
          "Live chaat and street food station",
          "South Indian filter coffee station",
          "Dessert table with Indian mithai and fusion pastries",
          "Midnight snack station for late-night guests",
        ]
      : input.eventType === "birthday"
        ? [
            "Finger food and mini burgers",
            "Custom birthday cake as centrepiece",
            "Mocktail / cocktail bar",
            "Popcorn and candy station",
          ]
        : [
            "Buffet lunch with regional specialities",
            "Tea, coffee, and juice station",
            "Light snacks and refreshments",
          ]),
  ];

  return {
    themes: base.themes,
    decorPalette: base.decorPalette,
    menuSuggestions,
    activities: base.activities,
    favours: base.favours,
    moneySavingTips: base.moneySavingTips,
    pinnedIds: [],
  };
}

function buildSummary(input: EventInput): string {
  const guestDesc = input.guests <= 50 ? "intimate" : input.guests <= 150 ? "mid-size" : "large";
  const venueType = input.isIndoor ? "indoor" : "outdoor";
  const eventLabel =
    input.eventType === "wedding"
      ? "wedding"
      : input.eventType === "birthday"
        ? "birthday celebration"
        : "community event";

  return (
    `Welcome to your Jashn planning journey! This template plan covers your ${guestDesc} ` +
    `${venueType} ${eventLabel} in ${input.city} for ${input.guests} guests. ` +
    `Your budget, timeline, vendor checklist, and personalised ideas are ready below. ` +
    (input.dietaryPreferences
      ? `Dietary preferences (${input.dietaryPreferences}) are reflected in the menu suggestions. `
      : "") +
    `Review each section, update vendor details as you confirm bookings, and track your ` +
    `actual spend against the budget. You can upgrade to AI-generated planning by adding an API key.`
  );
}

function buildTips(input: EventInput): string[] {
  const baseTips = [
    "Keep a contingency fund of at least 10% of your total budget",
    "Get all vendor agreements in writing before paying a deposit",
    "Create a WhatsApp group for quick communication with key vendors",
    "Assign a trusted person to be the on-day coordinator",
    "Take photos of all vendor contracts for easy access",
  ];

  const typeTips =
    input.eventType === "wedding"
      ? [
          "Book your top vendors (venue, caterer, photographer) at least 6 months in advance",
          "Schedule vendor payments to align with your cash flow",
        ]
      : input.eventType === "birthday"
        ? [
            "Confirm dietary restrictions with all guests before ordering food",
            "Plan an indoor backup if hosting outdoors",
          ]
        : [
            "Apply for permits as early as possible — municipal approvals can take 4–8 weeks",
            "Have a clear volunteer briefing document ready at least a week before",
          ];

  return [...baseTips, ...typeTips];
}
