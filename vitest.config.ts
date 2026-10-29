import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30000,
    // Emit GitHub Actions annotations on CI so failing test names surface in the
    // check-run API even when job logs are not downloadable.
    reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : undefined,
    exclude: ["**/.worktrees/**", "**/node_modules/**", "**/scratch/**", "**/archive/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/lib/audio/**", "src/utils/**"],
      thresholds: {
        statements: 30,
        branches: 20,
        functions: 30,
        lines: 30,
      },
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
