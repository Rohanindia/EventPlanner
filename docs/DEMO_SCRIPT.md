# Jashn — Demo Script (≤ 2 Minutes)

## Target: Hack2skill PromptWars Challenge 5 — Demo Video

---

### [0:00 – 0:10] Opening

> "Jashn is an AI-powered event planner — Jashn means celebration. Let me show you all six judging parameters in under 2 minutes."

_[Show the home page with warm gold/cream colour scheme]_

---

### [0:10 – 0:35] Problem Statement Alignment — Full Wizard

> "The problem asked for weddings, birthdays, and community events — all three are here. Let me plan a wedding."

_[Click "+ New Plan" → Select "Wedding" → Fill in: "Priya & Arjun Wedding", date 6 months out, Mumbai, 250 guests, ₹20,00,000 INR]_

> "Step 3 captures wedding-specific fields — ceremonies, traditions. Step 4 handles dietary preferences — Vegetarian here — cultural traditions, indoor/outdoor, and the plan language."

_[Step 5: Show privacy notice → Check acknowledgement → Click "Generate My Plan"]_

---

### [0:35 – 1:00] AI Features + Fallback

> "The plan is generated — tagged as AI-generated. Let me show the Budget tab."

_[Click Budget tab — show the category table with planned/actual/remaining. Edit one actual spend value]_

> "Budget categories sum exactly to ₹20 lakh — guaranteed by a largest-remainder algorithm. Timeline tab—"

_[Click Timeline — show dated tasks. Click a checkbox to mark done. Click "Export to Calendar"]_

> "Tasks are dated backward from the event. The ICS file opens in Google Calendar. Vendors tab—"

_[Click Vendors — show status dropdown: shortlisted → quoted → booked. Show "Questions to ask"]_

---

### [1:00 – 1:20] Ideas + Assistant

_[Click Ideas tab — show themes, decor palette, menu respecting Vegetarian, activities, pin an item]_

> "Ideas respect dietary preferences. I can pin favourites. Now the AI assistant—"

_[Click Assistant tab — type "How can I save 15% on catering?"]_

> "It's scoped to planning. Ask it something off-topic—"

_[Type "What's the best stock to buy?"]_

> "Politely declined. Only planning questions."

---

### [1:20 – 1:40] Security + Accessibility

_[Open browser DevTools → Network → Show /api/plan response with generic error body]_

> "API key stays server-only — verified by our bundle audit script. Rate limiting, CSP headers, and Zod validation on every input and every AI response."

_[Switch to keyboard — Tab through tabs using arrow keys, demonstrate focus ring]_

> "Fully keyboard navigable. WAI-ARIA tabs with roving tabindex. axe scan shows 0 violations."

---

### [1:40 – 1:55] Export + No-API Mode

_[Click Overview → JSON download → CSV download → Copy Text]_

> "Export to JSON, CSV, ICS, or copy a WhatsApp-ready text summary. Plans live in localStorage — erase-all-my-data button right there."

_[Show "Template plan — AI unavailable" banner briefly]_

> "Remove the API key and every feature still works — deterministic template planner, same UI, same tests."

---

### [1:55 – 2:00] Wrap-Up

> "Jashn: full GenAI event planning — budget, timeline, vendors, ideas, assistant — accessible, secure, offline-capable. Thank you!"

---

## Judging Parameter Coverage

| Parameter         | Moment in Demo | Evidence                                                          |
| ----------------- | -------------- | ----------------------------------------------------------------- |
| Code Quality      | —              | `npm run verify` exits 0; strict TypeScript; layered architecture |
| Security          | [1:20–1:40]    | API key absent from bundle; CSP; rate limit; Zod validation       |
| Efficiency        | —              | Server Components; LRU cache; one Gemini call per plan            |
| Testing           | —              | 80%+ coverage; E2E axe scans; CI workflow                         |
| Accessibility     | [1:25–1:35]    | Keyboard tabs; focus ring; 0 axe violations                       |
| Problem Alignment | [0:10–1:20]    | All 5 phrases demonstrated live                                   |
