# Jashn — Security Threat Model

## Assets

| Asset                     | Sensitivity                     | Location                     |
| ------------------------- | ------------------------------- | ---------------------------- |
| `GROQ_API_KEY`            | HIGH — access to Groq LLM API   | Server env var only          |
| User event plan data      | MEDIUM — personal event details | Browser localStorage         |
| AI-generated plan content | LOW                             | In-memory, localStorage      |
| Server infrastructure     | MEDIUM                          | Cloud Run / Vercel / Node.js |

## Threat Model

### T1: API Key Exposure in Client Bundle

**Threat:** `GROQ_API_KEY` leaks into the client-side JavaScript bundle, allowing unauthorized extraction.  
**Mitigation:**

- `GROQ_API_KEY` is only accessed in `src/lib/env/index.ts` and `src/lib/ai/index.ts`, both server-only modules.
- `next.config.mjs` uses `serverExternalPackages: ["groq-sdk"]` to ensure the SDK is never bundled into client chunks.
- `npm run bundle:audit` script verifies absence of API key patterns in `.next/static`. CI fails if found.  
  **Residual risk:** LOW — server/client boundary strictly enforced by Next.js App Router architecture.

### T2: Prompt Injection

**Threat:** User supplies adversarial prompts (`[INST] Ignore previous instructions [/INST]`, system delimiters) to hijack model instructions.  
**Mitigation:**

- `sanitizeInput()` strips control characters and escapes delimiter tokens (` ``` `, `###`, `[INST]`, `<<SYS>>`, etc.)
- User text is placed only inside delimited data blocks: `--- EVENT DETAILS START --- ... --- EVENT DETAILS END ---`
- Fixed system instruction is prepended separately from user input.
- JSON-only output (`response_format: { type: "json_object" }`) prevents instruction-injection via raw output formatting.
- Chat endpoint's `isOnTopic()` guard enforces event planning scope.  
  **Residual risk:** LOW — delimited data blocks and JSON enforcement provide strong defense-in-depth.

### T3: Rate Limit Abuse / DoS

**Threat:** Malicious actor floods `/api/plan` or `/api/chat` to exhaust API quota or degrade availability.  
**Mitigation:**

- Per-IP token-bucket rate limiter (`RateLimiter`) active on all API routes:
  - `/api/plan`: capacity=5, refillRate=0.2/s
  - `/api/chat`: capacity=20, refillRate=2/s
  - `/api/refine`: capacity=10, refillRate=0.5/s
- Returns HTTP 429 + `Retry-After` header.
- AbortController timeout (55s plan, 25s chat/refine) terminates hanging connections.  
  **Residual risk:** LOW in single-node/serverless; multi-instance environments can back token buckets with Redis.

### T4: Request Tampering / CSRF

**Threat:** Cross-origin request forgery targeting POST endpoints.  
**Mitigation:**

- `isSameOrigin()` validates `Origin` against `Host` on all POST routes.
- `isJsonContentType()` enforces `Content-Type: application/json`.
- Strict body size limit (`MAX_REQUEST_BODY_BYTES = 32 KB`) rejects oversized payloads early.  
  **Residual risk:** LOW.

### T5: XSS via AI-Generated or User Content

**Threat:** Model or user injects script tags or HTML attributes.  
**Mitigation:**

- React JSX automatically escapes content by default. `dangerouslySetInnerHTML` is never used.
- Nonce-based Content Security Policy (`script-src 'self' 'nonce-...'`) enforced via middleware.
- Strict Zod validation on incoming and outgoing payloads.  
  **Residual risk:** LOW.

### T6: CSV Formula Injection

**Threat:** Budget names or notes starting with `=`, `+`, `-`, `@`, `|`, `%` execute arbitrary formulas when opened in Excel/Sheets.  
**Mitigation:**

- `guardCsvCell()` in `src/lib/security/index.ts` prefixes dangerous leading characters with a tab (`\t`).  
  **Residual risk:** LOW.

### T7: ICS Calendar Injection

**Threat:** Malicious payload injected into calendar event descriptions or UID headers (RFC 5545).  
**Mitigation:**

- `icsEscape()` escapes backslashes, semicolons, commas, and newlines.
- `icsLineFold()` enforces RFC 5545 §3.1 75-octet line folding.  
  **Residual risk:** LOW.

### T8: Client Storage Tampering

**Threat:** Corrupted or tampered localStorage crashes the application.  
**Mitigation:**

- `readPlan()` passes stored data through `PlanSchema.safeParse()`. Corrupted entries are safely skipped.  
  **Residual risk:** NEGLIGIBLE.

### T9: Information Disclosure in Error Responses

**Threat:** Stack traces, internal file paths, or credentials leak via 500 error responses.  
**Mitigation:**

- `genericError()` sanitizes responses, returning opaque user-safe error messages.
- Server logs capture internal errors securely without exposing them over the wire.  
  **Residual risk:** LOW.

### T10: Dependency Vulnerabilities

**Threat:** Vulnerabilities in third-party npm packages.  
**Mitigation:**

- `npm run audit` runs against production dependencies.
- Next.js, React 19, Zod v4, and PostCSS kept on secure, patched versions.  
  **Residual risk:** LOW.

## Security Headers

| Header                         | Value                                                                  | Purpose                                   |
| ------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------- |
| `Content-Security-Policy`      | Nonce-based script-src, style-src self/unsafe-inline, connect-src self | Prevents unauthorized scripts/connections |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                         | Enforces HTTPS                            |
| `X-Content-Type-Options`       | `nosniff`                                                              | Blocks MIME confusion attacks             |
| `X-Frame-Options`              | `DENY`                                                                 | Prevents clickjacking                     |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                      | Protects navigation privacy               |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=()`                 | Restricts privileged browser APIs         |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                          | Process isolation                         |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                          | Resource isolation                        |
