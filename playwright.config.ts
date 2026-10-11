import { defineConfig, devices } from "@playwright/test";

// Browser checks: layout, theming and the golden screenshots. The goldens come
// from CI's Linux Chromium; other systems draw text differently, so compare
// them there (`mise run screenshots`) and update them from CI's artifact.
export default defineConfig({
  testDir: "test/screenshots",
  snapshotPathTemplate: "{testDir}/goldens/{arg}{ext}",
  forbidOnly: true,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], viewport: { width: 960, height: 720 }, deviceScaleFactor: 2 },
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "device" } },
});
