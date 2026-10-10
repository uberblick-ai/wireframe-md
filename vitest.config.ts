import { defineConfig } from "vitest/config";

// The renderer builds DOM nodes, so tests get a document by default.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
