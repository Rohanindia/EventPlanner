#!/usr/bin/env node
/**
 * Bundle Audit Script
 * Verifies that API keys and secret definitions are absent
 * from the built client bundle.
 * Fails with exit code 1 if any secret is found.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const NEXT_STATIC = join(process.cwd(), ".next", "static");
const DANGER_PATTERNS = [
  /gsk_[0-9A-Za-z_-]{20,}/, // Groq API key pattern
  /AIza[0-9A-Za-z_-]{35}/, // Google API key pattern
  /GROQ_API_KEY\s*=\s*['"]?[a-zA-Z0-9_-]+/i, // Env definition leak
  /GEMINI_API_KEY\s*=\s*['"]?[a-zA-Z0-9_-]+/i, // Env definition leak
];

async function findJsFiles(dir) {
  const results = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await findJsFiles(fullPath)));
      } else if (entry.name.endsWith(".js")) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return results;
}

async function main() {
  const jsFiles = await findJsFiles(NEXT_STATIC);

  if (jsFiles.length === 0) {
    console.warn("[bundle-audit] No JS files found in .next/static — run `npm run build` first.");
    process.exit(0);
  }

  let foundLeak = false;
  for (const file of jsFiles) {
    const content = await readFile(file, "utf-8");
    for (const pattern of DANGER_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`[bundle-audit] ❌ SECURITY LEAK found in: ${file}`);
        console.error(`[bundle-audit]    Pattern: ${pattern}`);
        foundLeak = true;
      }
    }
  }

  if (foundLeak) {
    console.error("[bundle-audit] FAILED — API key or secret detected in client bundle!");
    process.exit(1);
  } else {
    console.log(
      `[bundle-audit] ✅ Checked ${jsFiles.length} JS files — no API key or secret found.`,
    );
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[bundle-audit] Error:", err);
  process.exit(1);
});
