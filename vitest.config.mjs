import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["public/js/core.js", "public/js/i18n.js"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 },
    },
  },
});
