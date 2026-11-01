import { type NextRequest } from "next/server";
import { PlanRequestSchema, MAX_REQUEST_BODY_BYTES } from "@/lib/validation";
import { generateAIPlan } from "@/lib/ai";
import { planRateLimiter, isSameOrigin, isJsonContentType, genericError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<Response> {
  // Origin / Content-Type checks
  if (!isSameOrigin(request)) {
    return genericError("Forbidden", 403);
  }
  if (!isJsonContentType(request)) {
    return genericError("Content-Type must be application/json", 400);
  }

  // Rate limiting by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = planRateLimiter.check(ip);
  if (!rl.allowed) {
    return genericError("Too Many Requests", 429, rl.retryAfter);
  }

  // Body size check
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    return genericError("Request body too large", 413);
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericError("Invalid JSON body", 400);
  }

  const parseResult = PlanRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return genericError(
      `Validation error: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
      400,
    );
  }

  // Generate plan with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const { plan, isAiGenerated } = await generateAIPlan(parseResult.data.input, controller.signal);

    return Response.json(
      { plan, isAiGenerated },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (err) {
    if (controller.signal.aborted) {
      return genericError("Request timed out", 504);
    }
    console.error("[api/plan] Unexpected error:", err);
    return genericError("Internal server error", 500);
  } finally {
    clearTimeout(timeout);
  }
}
