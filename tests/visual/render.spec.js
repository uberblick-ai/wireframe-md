import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { renderFixtureDocument } from "@wireframe-md/html";

const fixturesDir = new URL("./fixtures/", import.meta.url);
const fixtureFiles = readdirSync(fixturesDir).filter((name) => name.endsWith(".md")).sort();

for (const fixtureName of fixtureFiles) {
  test(fixtureName, async ({ page }) => {
    const markdown = readFileSync(new URL(`./fixtures/${fixtureName}`, import.meta.url), "utf8");
    const theme = fixtureName.endsWith("-dark.md") ? "dark" : "auto";

    await page.setContent(renderFixtureDocument(markdown, { title: fixtureName, theme }), {
      waitUntil: "load",
    });

    await expect(page.getByTestId("fixture-root")).toHaveScreenshot(fixtureName.replace(/\.md$/, ".png"));
  });
}
