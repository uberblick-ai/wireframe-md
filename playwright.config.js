import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    browserName: "chromium",
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: { width: 1600, height: 1200 },
  },
});
