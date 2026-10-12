import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const [kind, container] of [["page", ".wf-page"], ["dialog", ".wf-dialog-card"], ["frame", ".wf-frame"]] as const) {
    test(`divider spans ${kind} content with the usual gaps in ${scheme}`, async ({ page }) => {
      await show(page, `${kind}\n  text Before\n  divider\n  text After`, { scheme, host: "column" });
      const geometry = await page.locator(container).evaluate((element) => {
        const style = getComputedStyle(element);
        const before = element.querySelectorAll(".wf-text")[0]!.getBoundingClientRect();
        const after = element.querySelectorAll(".wf-text")[1]!.getBoundingClientRect();
        const divider = element.querySelector(".wf-divider")!;
        const line = divider.getBoundingClientRect();
        const lineStyle = getComputedStyle(divider);
        const box = element.getBoundingClientRect();
        return {
          contentLeft: box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
          contentRight: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          left: line.left, right: line.right, height: line.height,
          before: line.top - before.bottom, after: after.top - line.bottom, gap: Number.parseFloat(style.rowGap),
          margin: lineStyle.margin, stroke: lineStyle.borderTopWidth, colour: lineStyle.borderTopColor,
        };
      });
      expect(geometry.left).toBeCloseTo(geometry.contentLeft, 1);
      expect(geometry.right).toBeCloseTo(geometry.contentRight, 1);
      expect(geometry.height).toBe(1);
      expect(geometry.margin).toBe("0px");
      expect(geometry.before).toBeCloseTo(geometry.gap, 1);
      expect(geometry.after).toBeCloseTo(geometry.gap, 1);
      expect(geometry.stroke).toBe("1px");
      expect(geometry.colour).toBe(scheme === "light" ? "oklch(0.86 0.004 75)" : "oklch(1 0 0 / 0.2)");
      await expect(page.getByRole("separator")).toHaveCount(1);
    });
  }

  test(`divider uses table rule tokens and host overrides in ${scheme}`, async ({ page }) => {
    const host = await show(page, "page\n  divider\n  table\n    row\n      cell First\n    row\n      cell Second", { scheme });
    const borders = () => page.evaluate(() => [".wf-divider", ".wf-table > .wf-row:last-child > .wf-cell"]
      .map((selector) => getComputedStyle(document.querySelector(selector)!).borderTop));
    const defaults = await borders();
    expect(defaults[0]).toBe(defaults[1]);
    await host.evaluate((element) => {
      element.style.setProperty("--wf-line", "rgb(10, 20, 30)");
      element.style.setProperty("--wf-stroke", "3px");
    });
    expect(await borders()).toEqual(["3px solid rgb(10, 20, 30)", "3px solid rgb(10, 20, 30)"]);
    expect((await page.locator(".wf-divider").boundingBox())!.height).toBe(3);
  });
}

for (const kind of ["page", "page width=256", "dialog", "frame"]) {
  for (const layout of ["block", "flex", "grid"] as const) {
    test(`divider cannot widen ${kind} in a ${layout} host, and follows overflow`, async ({ page }) => {
      for (const content of ["text Short", `text ${"unbroken".repeat(100)}`, `row\n${"    button Action\n".repeat(30).trimEnd()}`]) {
        const source = `${kind}\n  ${content}`;
        await show(page, source, { host: "column", width: 320, layout });
        const geometry = () => page.evaluate(() => {
          const root = document.querySelector(".wf-root")!;
          const container = document.querySelector(".wf-dialog-card, .wf-page, .wf-frame")!;
          return {
            rootWidth: root.clientWidth, scrollWidth: root.scrollWidth,
            containerWidth: container.getBoundingClientRect().width,
            columnWidth: document.querySelector(".column")!.clientWidth,
            columnScroll: document.querySelector(".column")!.scrollWidth,
          };
        });
        const before = await geometry();
        await show(page, `${source}\n  divider`, { host: "column", width: 320, layout });
        expect(await geometry()).toEqual(before);
        expect(before.columnScroll).toBe(before.columnWidth);
        const width = await page.locator(".wf-divider").evaluate((element) => {
          const container = element.parentElement!;
          const style = getComputedStyle(container);
          const box = container.getBoundingClientRect();
          return {
            line: element.getBoundingClientRect().width,
            content: box.width - [style.borderLeftWidth, style.borderRightWidth, style.paddingLeft, style.paddingRight]
              .reduce((sum, value) => sum + Number.parseFloat(value), 0),
          };
        });
        expect(width.line).toBeCloseTo(width.content, 1);
      }
    });
  }
}

test("misplaced dividers still draw visible lines where written", async ({ page }) => {
  for (const source of [
    "divider", "banner\n  divider", "card\n  divider", "page\n  row\n    divider",
    "page\n  table\n    divider", "page\n  table\n    row\n      divider",
    "page\n  table\n    row\n      cell\n        divider", "page\n  divider\n    divider",
    "page\n  row\n    button\n      divider", "page\n  icon archive\n    divider",
  ]) {
    await show(page, source, { host: "column" });
    const line = await page.locator(".wf-divider").last().boundingBox();
    expect(line!.width, source).toBeGreaterThan(0);
    expect(line!.height, source).toBeGreaterThan(0);
  }
});

test("unknown variants and attributes add no divider styling", async ({ page }) => {
  await show(page, "page\n  text Before\n  divider\n  text After");
  const before = await page.locator(".wf-root").screenshot();
  await show(page, "page\n  text Before\n  divider.dashed#break colour=red width=9999\n  text After");
  expect((await page.locator(".wf-root").screenshot()).equals(before)).toBe(true);
});
