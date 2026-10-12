import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => {
  await open(page);
});

for (const scheme of ["light", "dark"] as const) {
  test(`mono spans inherit all line styles except the font family in ${scheme}`, async ({ page }) => {
    const variants = ["", ".small.muted", ".strong", ".title", ".small.strong.title", ".red", ".amber", ".green", ".blue"];
    const host = await show(page, ["page", ...variants.map((variant) => `  text${variant} Run \`npm test\``)].join("\n"), { scheme, host: "column" });
    const styles = async () => page.locator(".wf-mono").evaluateAll((spans) => spans.map((span) => {
      const mono = getComputedStyle(span);
      const line = getComputedStyle(span.parentElement!);
      const inherited = ["fontSize", "fontWeight", "color", "lineHeight", "whiteSpace", "wordBreak", "overflowWrap"] as const;
      return {
        same: inherited.every((property) => mono[property] === line[property]),
        font: mono.fontFamily, ui: line.fontFamily, display: mono.display,
        padding: mono.padding, background: mono.backgroundColor, border: mono.borderWidth,
      };
    }));
    for (const style of await styles()) {
      expect(style.same).toBe(true);
      expect(style.font).toContain("monospace");
      expect(style.ui).toContain("Geist");
      expect(style.display).toBe("inline");
      expect(style.padding).toBe("0px");
      expect(style.background).toBe("rgba(0, 0, 0, 0)");
      expect(style.border).toBe("0px");
    }
    await host.evaluate((element) => element.style.setProperty("--wf-mono-font", '"Host Mono", monospace'));
    for (const style of await styles()) {
      expect(style.same).toBe(true);
      expect(style.font).toBe('"Host Mono", monospace');
      expect(style.ui).toContain("Geist");
    }
  });

  for (const placement of ["page", "card", "page\n  row", "page\n  row.end"]) {
    test(`mono contents wrap between words inside ${placement.replaceAll("\n", " / ")} in ${scheme}`, async ({ page }) => {
      const indent = placement.includes("\n") ? "    " : "  ";
      await show(page, `${placement}\n${indent}text.small.muted Before \`a command with enough separate words to wrap across several lines in this narrow document column\` after.`, { scheme, host: "column", width: 250 });
      const geometry = await page.locator(".wf-mono").evaluate((span) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        const text = span.parentElement!.getBoundingClientRect();
        const column = document.querySelector(".column")!;
        return {
          lines: new Set([...range.getClientRects()].map((rect) => rect.top)).size,
          withinText: [...range.getClientRects()].every((rect) => rect.left >= text.left - 1 && rect.right <= text.right + 1),
          columnWidth: column.clientWidth, scrollWidth: column.scrollWidth,
        };
      });
      expect(geometry.lines).toBeGreaterThan(1);
      expect(geometry.withinText).toBe(true);
      expect(geometry.columnWidth).toBe(geometry.scrollWidth);
    });
  }

  test(`the document header keeps both labels small and muted with only the id in mono in ${scheme}`, async ({ page }) => {
    await show(page, "page\n  row\n    text.small.muted Edited 3 minutes ago\n    text.small.muted rev `e9faf4df`", { scheme, host: "column" });
    const lines = page.locator(".wf-row > .wf-text");
    await expect(lines).toHaveText(["Edited 3 minutes ago", "rev e9faf4df"]);
    await expect(page.locator(".wf-mono")).toHaveText("e9faf4df");
    const geometry = await lines.evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return { size: Number.parseFloat(style.fontSize), colour: style.color, height: box.height, top: box.top, lineHeight: Number.parseFloat(style.lineHeight) };
    }));
    for (const line of geometry) {
      expect(line.size).toBe(11.9);
      expect(line.colour).toBe(geometry[0]!.colour);
      // Mixed fonts have different ink tops within one line; measure its box.
      expect(line.height).toBeCloseTo(line.lineHeight, 1);
      expect(line.top).toBe(geometry[0]!.top);
    }
  });
}
