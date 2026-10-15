import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

const contexts = [
  ["top level", ""], ["page", "page"], ["phone", "phone"],
  ["dock", "phone\n  dock"], ["row", "phone\n  row"],
  ["scroll row", "phone\n  row.scroll"], ["dock row", "phone\n  dock\n    row"],
] as const;
const within = (parent: string, card: string): string => {
  if (parent === "") return card;
  const indent = " ".repeat(parent.split("\n").at(-1)!.search(/\S/) + 2);
  return `${parent}\n${card.split("\n").map((line) => indent + line).join("\n")}`;
};

for (const scheme of ["light", "dark"] as const) {
  test(`explicit padding keeps fixed insets and the existing card decoration in ${scheme}`, async ({ page }) => {
    for (const [name, parent] of contexts) {
      for (const width of ["", " width=240"]) {
        for (const padding of [0, 8]) {
          const card = `card${width}\n  text First\n  text Last`;
          await show(page, within(parent, card), { scheme, host: "column" });
          const decoration = () => page.locator(".wf-card").evaluate((node) => {
            const css = getComputedStyle(node);
            return [css.borderWidth, css.borderColor, css.borderRadius, css.boxShadow, css.backgroundColor, css.gap];
          });
          const before = await decoration();
          await show(page, within(parent, card.replace("card", `card padding=${padding}`)), { scheme, host: "column" });
          expect(await decoration(), name).toEqual(before);
          const insets = () => page.locator(".wf-card").evaluate((node) => {
            const box = node.getBoundingClientRect();
            const first = node.firstElementChild!.getBoundingClientRect();
            const last = node.lastElementChild!.getBoundingClientRect();
            return [first.top - box.top, box.right - first.right, box.bottom - last.bottom, first.left - box.left];
          });
          expect(await insets(), name).toEqual(Array(4).fill(padding + 1));
          await page.locator(".wf-root").evaluate((node) => (node as HTMLElement).style.setProperty("--wf-text-size", "24px"));
          expect(await insets(), name).toEqual(Array(4).fill(padding + 1));
        }
      }
    }
  });

  test(`cards without padding retain their em insets, including rows and sized cards in ${scheme}`, async ({ page }) => {
    for (const [, parent] of contexts) {
      for (const width of ["", " width=240"]) {
        await show(page, within(parent, `card${width}\n  text Body`), { scheme });
        const inset = () => page.locator(".wf-card").evaluate((node) => node.firstElementChild!.getBoundingClientRect().left - node.getBoundingClientRect().left);
        expect(await inset()).toBe(15);
        await page.locator(".wf-root").evaluate((node) => (node as HTMLElement).style.setProperty("--wf-text-size", "24px"));
        expect(await inset()).toBe(25);
      }
    }
  });

  test(`sized padding is capped without widening narrow cards or hosts in ${scheme}`, async ({ page }) => {
    for (const parent of ["phone", "phone\n  row", "phone\n  row.scroll", "phone\n  dock"]) {
      for (const [width, padding] of [[1, 64], [8, 8], [40, 64]]) {
        await show(page, within(parent, `card width=${width} padding=${padding}\n  image.square`), { scheme, host: "column", width: 200 });
        const geometry = await page.locator(".wf-card").evaluate((node) => {
          const box = node.getBoundingClientRect();
          const child = node.firstElementChild!.getBoundingClientRect();
          const css = getComputedStyle(node);
          return { width: box.width, inset: child.left - box.left, content: child.width, top: Number.parseFloat(css.paddingTop), border: css.boxShadow };
        });
        expect(geometry.width).toBe(width);
        expect(geometry.inset).toBe(width! / 2);
        expect(geometry.top).toBe(width! / 2);
        expect(geometry.content).toBe(0);
        expect(geometry.border).not.toBe("none");
        expect(await page.locator(".wf-phone-viewport").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
        expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
      }
    }
    for (const row of ["row", "row.scroll"]) {
      await show(page, `page width=120\n  ${row}\n    card width=9999 padding=64\n      image.square`, { scheme });
      const available = (await page.locator(".wf-row").boundingBox())!.width;
      const card = (await page.locator(".wf-card").boundingBox())!;
      expect(card.width).toBe(row === "row" ? available : 9999);
      expect(await page.locator(".wf-card").evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingLeft))).toBe(row === "row" ? available / 2 : 65);
      expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    }
  });

  test(`padded cards sharing a narrow row scroll inside the screen or wireframe in ${scheme}`, async ({ page }) => {
    for (const root of ["phone", "page"]) {
      await show(page, `${root}\n  row\n    card padding=64\n      text First\n    card padding=64\n      text Second`, { scheme, host: "column", width: 200 });
      const scroller = page.locator(root === "phone" ? ".wf-phone-viewport" : ".wf-root");
      expect(await scroller.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeGreaterThan(0);
      if (root === "phone") expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
      expect(await page.locator(".column").evaluate((node) => node.scrollWidth)).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
    }
  });
}
