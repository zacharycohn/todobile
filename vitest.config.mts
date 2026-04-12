import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url))
    }
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "**/*.test.ts", "**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: [fileURLToPath(new URL("./packages/test-utils/src/setup-tests.ts", import.meta.url))]
  }
});
