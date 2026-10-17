import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const source = readFileSync(new URL("../../examples/blocks/2-cards/comment-header.wireframe", import.meta.url), "utf8");

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const width of [710, 260]) {
    for (const layout of ["block", "flex", "grid"] as const) {
      test(`comment groups wrap beside the trailing action in ${width} px ${layout}, ${scheme}`, async ({ page }) => {
        await show(page, source, { host: "column", scheme, width, layout });
        const cards = await page.locator(".wf-card").evaluateAll((nodes) => nodes.map((card) => {
          const header = card.firstElementChild!;
          const group = header.firstElementChild!;
          const action = header.lastElementChild!;
          const children = [...group.children];
          const texts = children.slice(1);
          const box = (node: Element) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width, centre: rect.top + rect.height / 2 };
          };
          const style = getComputedStyle(group);
          const textStyle = getComputedStyle(texts[1]!);
          return {
            card: box(card), header: box(header), group: box(group), action: box(action),
            children: children.map(box), gap: Number.parseFloat(style.columnGap),
            inset: Number.parseFloat(getComputedStyle(card).paddingRight),
            lines: texts.map((text) => {
              const range = document.createRange();
              range.selectNodeContents(text);
              return range.getClientRects().length;
            }),
            decoration: [style.borderTopWidth, style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft, style.marginTop, style.marginRight, style.marginBottom, style.marginLeft],
            background: style.backgroundColor,
            strong: getComputedStyle(texts[0]!).fontWeight,
            small: Number.parseFloat(textStyle.fontSize) < Number.parseFloat(style.fontSize),
            muted: textStyle.color !== getComputedStyle(texts[0]!).color,
            overflow: [card, header, group].map((node) => node.scrollWidth - node.clientWidth),
          };
        }));
        expect(cards).toHaveLength(2);
        for (const [index, card] of cards.entries()) {
          expect(card.card.width).toBe(index === 0 ? Math.min(400, width - 8) : 240);
          expect(card.group.left).toBe(card.header.left);
          expect(card.action.right).toBeCloseTo(card.card.right - card.inset, 1);
          expect(card.action.centre).toBeCloseTo(card.group.centre, 1);
          expect(card.group.width).toBeCloseTo(card.children.reduce((sum, child) => sum + child.width, 2 * card.gap), 1);
          for (const [childIndex, child] of card.children.entries()) {
            expect(child.centre).toBeCloseTo(card.group.centre, 1);
            if (childIndex > 0) expect(child.left - card.children[childIndex - 1]!.right).toBeCloseTo(card.gap, 1);
          }
          expect(card.decoration).toEqual(Array(9).fill("0px"));
          expect(card.background).toBe("rgba(0, 0, 0, 0)");
          expect(card.strong).toBe("600");
          expect(card.small).toBe(true);
          expect(card.muted).toBe(true);
          expect(card.overflow).toEqual([0, 0, 0]);
          if (index === 0 && width === 710) {
            expect(card.lines).toEqual([1, 1]);
            expect(card.action.left - card.group.right).toBeGreaterThan(card.gap);
          } else {
            expect(Math.max(...card.lines)).toBeGreaterThan(1);
          }
        }
        expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      });
    }
  }

  test(`nested layout variants keep the plain group layout in ${scheme}`, async ({ page }) => {
    await show(page, source, { host: "column", scheme });
    const plain = await page.locator(".wf-root").innerHTML();
    for (const variant of ["end", "between", "scroll"]) {
      await show(page, source.replaceAll("    row\n", `    row.${variant}\n`), { host: "column", scheme });
      expect(await page.locator(".wf-root").innerHTML()).toBe(plain);
    }
  });
}
