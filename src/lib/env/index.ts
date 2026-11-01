import { z } from "zod";

/**
 * Validate and export server-side environment variables at boot time.
 * GROQ_API_KEY is optional — when absent, the template planner is used as a fallback.
 */
const EnvSchema = z.object({
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadEnv() {
  const apiKey = process.env["GROQ_API_KEY"];
  const isPlaceholder = !apiKey || apiKey === "your_groq_api_key_here";

  const result = EnvSchema.safeParse({
    GROQ_API_KEY: isPlaceholder ? undefined : apiKey,
    GROQ_MODEL: process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile",
    NODE_ENV: process.env["NODE_ENV"] || "development",
  });

  if (!result.success) {
    throw new Error(`[env] Invalid environment configuration:\n${result.error.message}`);
  }

  return result.data;
}

export const env = loadEnv();
