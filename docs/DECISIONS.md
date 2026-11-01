# Jashn — Architectural Decisions

All decisions logged here per project spec. Format: **Decision** | Rationale | Alternatives considered.

---

## D1: Next.js 15 App Router

**Decision:** Use Next.js 15 with App Router as the framework.  
**Rationale:** React Server Components reduce first-load JS; file-based routing; built-in API routes eliminate a separate backend; middleware for security headers; `output: "standalone"` for lean Docker images.  
**Alternatives:** Remix (similar RSC story but smaller ecosystem), SvelteKit (different language, harder to hire).

## D2: No Database, No Auth

**Decision:** All plan data stored in `localStorage` only, validated with Zod on every read.  
**Rationale:** Privacy-first design; no GDPR surface area; no auth complexity; plans are personal and ephemeral. Server cannot be subpoenaed for user data because there is none.  
**Alternatives:** Postgres + NextAuth (significant complexity, privacy concerns).

## D3: Tailwind CSS v4 with CSS Variables

**Decision:** Tailwind v4 using `@theme` CSS variables for all design tokens.  
**Rationale:** Zero-runtime CSS; design tokens in CSS (not JS) means they work without hydration; CSS variables enable live theme switching without a JS state machine.  
**Alternatives:** CSS Modules (more verbose), styled-components (runtime overhead, SSR complexity).

## D4: Zod for All Validation

**Decision:** Zod for all schema validation — API inputs, AI model outputs, localStorage reads.  
**Rationale:** Single source of truth for types (`z.infer`); runtime safety at all trust boundaries; excellent error messages; no additional code generation step.  
**Alternatives:** io-ts (more complex), yup (less TypeScript integration).

## D5: @google/genai with Structured Output

**Decision:** Use `@google/genai` SDK with `responseMimeType: "application/json"` and `responseSchema` for structured output.  
**Rationale:** Eliminates JSON parsing fragility; model output conforms to a declared schema; Zod re-validates as a second safety layer.  
**Alternatives:** Raw HTTP fetch to Gemini API (more control but more code); LangChain (heavy dependency).

## D6: Gemini 2.5 Flash as Default Model

**Decision:** Default to `gemini-2.5-flash`, overridable via `GEMINI_MODEL` env var.  
**Rationale:** Current stable Flash model (verified 2026-10-31); best latency/cost ratio; supports structured output and thinking budget.  
**Alternatives:** Gemini 2.5 Pro (slower, more expensive, not needed for this use case).

## D7: Template Planner as AI Fallback

**Decision:** When `GEMINI_API_KEY` is absent or the AI call fails, return a deterministic template plan.  
**Rationale:** The app must work fully without an API key (for CI, testing, demo environments, and offline use). The template planner ensures all UI features are exercisable.  
**Tradeoff:** Template plans are less personalised than AI plans. The UI clearly labels them as "Template plan — AI unavailable."

## D8: Token-Bucket Rate Limiter (In-Memory)

**Decision:** Per-IP in-memory token bucket rate limiter, not Redis.  
**Rationale:** No external dependencies; appropriate for single-instance deployment (Cloud Run 1 instance min). Returns 429 + `Retry-After` header.  
**Limitation:** Does not work across multiple instances. If scaling to multi-instance, replace with a Redis-backed limiter. Documented in SECURITY.md residual risks.

## D9: No Chart Library — Hand-Built SVG

**Decision:** Build the budget donut chart as a plain SVG path calculation.  
**Rationale:** Avoids ~50KB+ chart library; full control over accessibility (title, ARIA); paired with a data table for screen readers; no licence complications.  
**Alternatives:** Recharts (good a11y but heavy), Chart.js (canvas — harder to make accessible).

## D10: Vitest (not Jest) for Unit Tests

**Decision:** Vitest with `@vitejs/plugin-react` for unit and component tests.  
**Rationale:** Native ESM support; 10x faster than Jest in watch mode; compatible with the same RTL + jest-dom APIs; Vite config reuses the same alias config as the app.  
**Alternatives:** Jest (slower, requires more Babel/transform config for ESM).

## D11: CSP with `unsafe-inline` for Styles

**Decision:** CSP allows `unsafe-inline` for styles only. Scripts use nonce.  
**Rationale:** Tailwind v4 injects styles dynamically in dev mode and at build time; applying nonces to CSS is not practically supported. Script nonces are applied correctly.  
**Residual risk:** `style-src unsafe-inline` slightly weakens CSS injection protection. No user-controlled CSS is rendered, mitigating this.

## D12: `noUncheckedIndexedAccess: true`

**Decision:** Enable `noUncheckedIndexedAccess` in tsconfig alongside `strict: true`.  
**Rationale:** Array/object index access returns `T | undefined`, forcing explicit null checks. This catches a class of runtime errors (index out of bounds) at compile time.

## D13: Conventional Commits

**Decision:** Use Conventional Commits format for all git commits.  
**Rationale:** Enables automated changelog generation; clear categorisation (feat, fix, chore, docs, test); readable history.

## D14: Zod v4 (not v3)

**Decision:** Upgrade to Zod v4 to resolve high-severity audit advisory (GHSA-mrhx-c7xc-m3w5).  
**Rationale:** Zod v3 had a memory exhaustion vulnerability on oversized constrained collections. Since we validate user inputs (including from untrusted API responses), this was a real risk.  
**Migration:** Zod v4 is largely backwards-compatible for our usage patterns.
