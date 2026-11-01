import { type NextRequest } from "next/server";
import { RefineRequestSchema, MAX_REQUEST_BODY_BYTES } from "@/lib/validation";
import { refineAIPlan } from "@/lib/ai";
import { refineRateLimiter, isSameOrigin, isJsonContentType, genericError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return genericError("Forbidden", 403);
  if (!isJsonContentType(request)) {
    return genericError("Content-Type must be application/json", 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = refineRateLimiter.check(ip);
  if (!rl.allowed) return genericError("Too Many Requests", 429, rl.retryAfter);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    return genericError("Request body too large", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericError("Invalid JSON body", 400);
  }

  const parseResult = RefineRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return genericError(
      `Validation error: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
      400,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const updates = await refineAIPlan(
      parseResult.data.instruction,
      parseResult.data.currentPlan,
      controller.signal,
    );

    return Response.json(
      { updates },
      {
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      },
    );
  } catch (err) {
    if (controller.signal.aborted) return genericError("Request timed out", 504);
    console.error("[api/refine] Error:", err);
    return genericError("Internal server error", 500);
  } finally {
    clearTimeout(timeout);
  }
}
