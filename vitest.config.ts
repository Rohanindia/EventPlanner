import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        perFile: false,
      },
      include: ["src/lib/**/*.{ts,tsx}"],
      exclude: ["src/lib/ai/**", "src/lib/env/**", "src/**/*.d.ts", "src/**/*.config.*"],
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
