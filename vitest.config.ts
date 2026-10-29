import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30000,
    // CI runners have less headroom than dev machines: cap the worker pool so the
    // full jsdom suite (and the coverage-instrumented run) does not OOM-kill a worker.
    maxWorkers: process.env.GITHUB_ACTIONS ? 2 : undefined,
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
