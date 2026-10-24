import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const source = readFileSync(new URL("../../examples/blocks/5-rulers/document-changes.wireframe", import.meta.url), "utf8");

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`rulers span plain and stretched rows with all mark colours and endpoints, ${scheme}`, async ({ page }) => {
    const host = await show(page, source, { host: "column", scheme });
    for (const width of [710, 360]) {
      await page.locator(".column").evaluate((column, width) => { (column as HTMLElement).style.width = `${width}px`; }, width);
      const rows = await page.locator(".wf-row[data-line]").evaluateAll((rows) => rows.map((row) => {
        const box = (node: Element) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, right: rect.right };
        };
        const ruler = row.querySelector(":scope > .wf-ruler")!;
        const cards = [...row.querySelectorAll(":scope > .wf-card, :scope > .wf-card-track > .wf-card")];
        return {
          box: box(row), ruler: box(ruler), cards: cards.map(box),
          caption: row.querySelector(":scope > .wf-text") ? box(row.querySelector(":scope > .wf-text")!) : undefined,
          gap: Number.parseFloat(getComputedStyle(row).columnGap),
          marks: [...ruler.children].map((mark) => ({ box: box(mark), colour: getComputedStyle(mark).backgroundColor })),
        };
      }));
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.ruler.width).toBe(12);
        expect(row.ruler.top).toBe(row.box.top);
        expect(row.ruler.bottom).toBe(row.box.bottom);
        expect(row.ruler.right).toBeCloseTo(row.box.right, 1);
        expect(row.marks[0]!.box.top).toBe(row.ruler.top);
        expect(row.marks[2]!.box.bottom).toBe(row.ruler.bottom);
        for (const mark of row.marks) {
          expect(mark.box.width).toBe(12);
          expect(mark.box.top).toBeGreaterThanOrEqual(row.ruler.top);
          expect(mark.box.bottom).toBeLessThanOrEqual(row.ruler.bottom);
        }
        expect(new Set(row.marks.map((mark) => mark.colour)).size).toBe(3);
      }
      const [stretched, plain] = rows;
      expect(stretched!.cards.map((card) => card.height)).toEqual([stretched!.box.height, stretched!.box.height]);
      expect(stretched!.caption!.top).toBe(stretched!.box.top);
      expect(stretched!.caption!.height).toBeLessThan(stretched!.box.height);
      const room = stretched!.box.width - 12 - stretched!.caption!.width - 3 * stretched!.gap;
      expect(stretched!.cards[0]!.width).toBeCloseTo(room / 3, 1);
      expect(stretched!.cards[1]!.width).toBeCloseTo(room * 2 / 3, 1);
      expect(plain!.cards[0]!.height).toBeLessThan(plain!.cards[1]!.height);
      for (const card of plain!.cards) expect(card.top + card.height / 2).toBeCloseTo(plain!.box.top + plain!.box.height / 2, 1);
      expect(stretched!.marks[1]!.box.top).toBeCloseTo(stretched!.ruler.top + stretched!.ruler.height / 2, 1);
      expect(plain!.marks[1]!.box.top).toBeCloseTo(plain!.ruler.top + plain!.ruler.height * 0.22, 1);
      expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      const accessible = await page.locator(".wf-root").ariaSnapshot();
      expect(accessible).not.toMatch(/ruler|mark/);
      expect(accessible.match(/Earlier draft/g)).toHaveLength(1);
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    }
    await page.locator(".column").evaluate((column) => { (column as HTMLElement).style.width = "710px"; });
    await expect(host).toHaveScreenshot(`rulers-document-changes-${scheme}.png`);
  });

  test(`rulers stretch in every non-table row and keep theme colours, ${scheme}`, async ({ page }) => {
    for (const row of ["row", "row.stretch", "row.end", "row.between", "row.scroll", "row\n    row"]) {
      const indent = row.includes("\n") ? "      " : "    ";
      await show(page, `page\n  ${row}\n${indent}image.square width=80 Cover\n${indent}ruler\n${indent}  mark at=0\n${indent}  mark.red at=50\n${indent}  mark.green at=100`, { host: "column", scheme });
      const geometry = await page.locator(".wf-ruler[data-line]").evaluate((ruler) => {
        const row = ruler.parentElement!.getBoundingClientRect();
        const track = ruler.getBoundingClientRect();
        return { top: track.top - row.top, bottom: track.bottom - row.bottom, width: track.width };
      });
      expect(geometry).toEqual({ top: 0, bottom: 0, width: 12 });
      await page.locator(".wf-root").evaluate((root) => {
        const style = (root as HTMLElement).style;
        style.setProperty("--wf-warning", "rgb(130, 80, 10)");
        style.setProperty("--wf-danger", "rgb(170, 20, 30)");
        style.setProperty("--wf-success", "rgb(10, 120, 40)");
      });
      expect(await page.locator(".wf-ruler[data-line] > .wf-mark").evaluateAll((marks) => marks.map((mark) => getComputedStyle(mark).backgroundColor)))
        .toEqual(["rgb(130, 80, 10)", "rgb(170, 20, 30)", "rgb(10, 120, 40)"]);
    }
  });

  test(`ruler width stays fixed beside flexible cards in narrow and content-sized hosts, ${scheme}`, async ({ page }) => {
    for (const layout of ["block", "fit-content", "flex-content", "grid-content"] as const) {
      for (const fraction of ["", " width=1/3"]) {
        await show(page, `page\n  row.stretch\n    card${fraction} padding=0\n    card padding=0\n    ruler`, { host: "column", scheme, layout });
        for (const width of [710, 240, 120]) {
          await page.locator(".column").evaluate((column, width) => { (column as HTMLElement).style.width = `${width}px`; }, width);
          const geometry = await page.locator(".wf-row[data-line]").evaluate((row) => {
            const cards = [...row.querySelectorAll(":scope > .wf-card, :scope > .wf-card-track > .wf-card")];
            return {
              width: row.getBoundingClientRect().width,
              ruler: row.querySelector(".wf-ruler")!.getBoundingClientRect().width,
              gap: Number.parseFloat(getComputedStyle(row).columnGap),
              cards: cards.map((card) => card.getBoundingClientRect().width),
            };
          });
          expect(geometry.ruler).toBe(12);
          const room = geometry.width - 12 - 2 * geometry.gap;
          const share = fraction === "" ? 1 / 2 : 1 / 3;
          expect(geometry.cards[0]).toBeCloseTo(room * share, 1);
          expect(geometry.cards[1]).toBeCloseTo(room * (1 - share), 1);
          expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
        }
      }
    }
  });
}
