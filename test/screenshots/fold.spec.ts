import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`fold fills the content width inside every supported container in ${scheme}`, async ({ page }) => {
    for (const parent of ["dialog Title", "banner", "page", "page.browser", "page.window", "frame Caption", "phone", "card padding=8", "phone\n  dock"]) {
      const indent = parent.includes("\n") ? "    " : "  ";
      await show(page, `${parent}\n${indent}text Before\n${indent}fold 4 unchanged blocks\n${indent}fold\n${indent}text After`, { scheme, host: "column" });
      const geometry = await page.locator(".wf-fold").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const container = node.parentElement!;
        const content = container.getBoundingClientRect();
        const parentCss = getComputedStyle(container);
        const css = getComputedStyle(node);
        return {
          left: box.left, right: box.right, height: box.height,
          contentLeft: content.left + Number.parseFloat(parentCss.borderLeftWidth) + Number.parseFloat(parentCss.paddingLeft),
          contentRight: content.right - Number.parseFloat(parentCss.borderRightWidth) - Number.parseFloat(parentCss.paddingRight),
          border: css.borderStyle, stroke: css.borderWidth, colour: css.borderColor,
          labelColour: css.color, size: css.fontSize, alignment: css.textAlign,
        };
      }));
      expect(geometry).toHaveLength(2);
      for (const bar of geometry) {
        expect(bar.left, parent).toBeCloseTo(bar.contentLeft, 1);
        expect(bar.right, parent).toBeCloseTo(bar.contentRight, 1);
        expect(bar.border).toBe("dashed");
        expect(bar.stroke).toBe("1px");
        expect(bar.colour).toBe(scheme === "light" ? "oklch(0.86 0.004 75)" : "oklch(1 0 0 / 0.2)");
        expect(bar.labelColour).toBe(scheme === "light" ? "oklch(0.511 0 0)" : "oklch(0.708 0 0)");
        expect(bar.size).toBe("11.9px");
        expect(bar.alignment).toBe("center");
      }
      expect(geometry[1]!.height).toBeCloseTo(geometry[0]!.height, 1);
      await expect(page.locator(".wf-fold").first()).toMatchAriaSnapshot('- text: 4 unchanged blocks');
      await expect(page.locator(".wf-fold").last()).toMatchAriaSnapshot('- text: fold');
      await page.keyboard.press("Tab");
      expect(await page.locator(".wf-fold").evaluateAll((nodes) => nodes.some((node) => node.contains(document.activeElement)))).toBe(false);
    }
  });

  test(`banner folds take their own line between ordinary content, tabs and tinted text in ${scheme}`, async ({ page }) => {
    await show(page, "banner\n  icon archive\n  text Before\n  fold First\n  fold Second\n  text After\n  row.end\n    button Compare\n  tabs\n    option.current History\n  fold Third\n  text.bg-blue End", { scheme, host: "column" });
    expect(await page.locator(".wf-banner").evaluate((banner) => [...banner.children].map((node) => node.className)))
      .toEqual(["wf-banner-line", "wf-fold", "wf-fold", "wf-banner-line", "wf-tabs", "wf-fold", "wf-text wf-bg-blue"]);
    const boxes = await page.locator(".wf-banner > *").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    for (let index = 1; index < boxes.length; index += 1) expect(boxes[index]!.top).toBeGreaterThan(boxes[index - 1]!.bottom);
  });

  test(`long fold labels wrap without widening cards, banners or documents in ${scheme}`, async ({ page }) => {
    for (const parent of ["card width=220", "page\n  card", "banner"]) {
      for (const label of ["unchanged blocks with enough words to wrap across several lines ".repeat(6), "unbroken".repeat(80)]) {
        const indent = parent.includes("\n") ? "    " : "  ";
        for (const layout of ["block", "flex", "grid", "fit-content"] as const) {
          await show(page, `${parent}\n${indent}fold ${label}`, { scheme, host: "column", width: 280, layout });
          const sizes = await page.locator(".wf-fold").evaluate((fold) => {
            const range = document.createRange();
            range.selectNodeContents(fold);
            const box = fold.getBoundingClientRect();
            return {
              lines: new Set([...range.getClientRects()].map((rect) => rect.top)).size,
              contained: [...range.getClientRects()].every((rect) => rect.left >= box.left && rect.right <= box.right),
              overflows: [fold, fold.parentElement!, document.querySelector(".wf-root")!, document.querySelector(".column")!, document.documentElement]
                .map((node) => node.scrollWidth - node.clientWidth),
            };
          });
          expect(sizes.lines, `${parent}, ${layout}`).toBeGreaterThan(1);
          expect(sizes.contained, `${parent}, ${layout}`).toBe(true);
          expect(sizes.overflows, `${parent}, ${layout}`).toEqual([0, 0, 0, 0, 0]);
        }
      }
    }
  });

  test(`fold uses the existing host theme tokens in ${scheme}`, async ({ page }) => {
    const host = await show(page, "card\n  fold 4 unchanged blocks", { scheme });
    await host.evaluate((element) => {
      element.style.setProperty("--wf-line", "rgb(10, 20, 30)");
      element.style.setProperty("--wf-stroke", "3px");
      element.style.setProperty("--wf-muted", "rgb(60, 70, 80)");
      element.style.setProperty("--wf-text-size", "20px");
    });
    await expect(page.locator(".wf-fold")).toHaveCSS("border", "3px dashed rgb(10, 20, 30)");
    await expect(page.locator(".wf-fold")).toHaveCSS("color", "rgb(60, 70, 80)");
    await expect(page.locator(".wf-fold")).toHaveCSS("font-size", "17px");
  });
}
