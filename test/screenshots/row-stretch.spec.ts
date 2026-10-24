import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const children = [
  "text Status",
  "button Run",
  "image.square Cover",
  "input Hint",
  "input label=Name Hint",
  "select label=Role Viewer",
  "switch.on Updates",
  "row\n  card width=60\n    text Group\n  text.small Tag",
];

const rows = (variant: string, cards = true): string => `page\n${children.map((child) =>
  `  row${variant}\n${cards ? "    card width=120\n      text Short\n    card\n      text One\n      text Two\n      text Three\n      text Four\n" : ""}    ${child.replaceAll("\n", "\n    ")}`,
).join("\n")}`;

const measure = (page: Page) => page.locator(".wf-page .wf-row[data-line]:not(.wf-row-group)").evaluateAll((nodes) => nodes.map((row) => {
  const box = (node: Element) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
  };
  return {
    box: box(row), children: [...row.children].map(box),
    content: [...row.querySelectorAll(":scope > .wf-card")].map((card) => ({
      box: box(card.firstElementChild!),
      inset: Number.parseFloat(getComputedStyle(card).paddingTop) + Number.parseFloat(getComputedStyle(card).borderTopWidth),
    })),
    group: [...row.querySelectorAll(":scope > .wf-row-group > *")].map(box),
  };
}));

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`cards fill a taller image's height in every layout container, ${scheme}`, async ({ page }) => {
    for (const prefix of ["dialog Title", "banner", "page", "frame", "phone", "phone\n  dock", "card"]) {
      const indent = prefix.includes("dock") ? "    " : "  ";
      const body = "row.stretch\n  card width=80\n    text Short\n  card\n    text Another\n  image.square width=160 Cover";
      const source = `${prefix}\n${indent}${body.replaceAll("\n", `\n${indent}`)}`;
      await show(page, source.replace("row.stretch", "row"), { host: "column", scheme });
      const imageHeight = await page.locator(".wf-image").evaluate((image) => image.getBoundingClientRect().height);
      expect(imageHeight).toBeGreaterThan(100);
      expect(imageHeight).toBeLessThanOrEqual(160);
      await show(page, source, { host: "column", scheme });
      const row = page.locator(".wf-row.wf-stretch");
      const boxes = await row.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }));
      expect(boxes).toHaveLength(3);
      expect(boxes).toEqual(Array(3).fill({ top: boxes[0]!.top, height: imageHeight }));
    }
  });

  test(`stretch preserves end and between spacing with sized cards, ${scheme}`, async ({ page }) => {
    for (const alignment of ["end", "between"]) {
      const source = `page\n  row.${alignment}\n    card width=80\n      text Short\n    card width=80\n      text Two\n      text Lines\n    button Run`;
      await show(page, source, { host: "column", scheme });
      const plain = (await measure(page))[0]!;
      await show(page, source.replace(`row.${alignment}`, `row.${alignment}.stretch`), { host: "column", scheme });
      const stretched = (await measure(page))[0]!;
      expect(stretched.children.map((child) => [child.left, child.width])).toEqual(plain.children.map((child) => [child.left, child.width]));
      expect(stretched.children[2]!.right).toBe(stretched.box.right);
      if (alignment === "between") expect(stretched.children[0]!.left).toBe(stretched.box.left);
      else expect(stretched.children[0]!.left).toBeGreaterThan(stretched.box.left);
    }
  });

  for (const width of [710, 360]) {
    for (const alignment of ["", ".end", ".between"]) {
      test(`stretch changes only card heights and vertical positions with ${alignment || "plain alignment"} in ${width} px, ${scheme}`, async ({ page }) => {
        await show(page, rows("", false), { host: "column", scheme, width });
        const natural = await measure(page);
        await show(page, rows(alignment), { host: "column", scheme, width });
        const plain = await measure(page);
        for (const row of plain) {
          const [short, tall] = row.children;
          expect(short!.height).toBeLessThan(tall!.height);
          expect(short!.top + short!.height / 2).toBeCloseTo(tall!.top + tall!.height / 2, 1);
        }

        await show(page, rows(`${alignment}.stretch`), { host: "column", scheme, width });
        const stretched = await measure(page);
        expect(stretched).toHaveLength(children.length);
        for (const [index, row] of stretched.entries()) {
          const baseline = plain[index]!;
          expect(row.box.width).toBe(baseline.box.width);
          expect(row.box.height).toBe(baseline.box.height);
          expect(row.children.map((child) => [child.left, child.width])).toEqual(baseline.children.map((child) => [child.left, child.width]));
          for (const child of row.children) expect(child.top).toBe(row.box.top);
          for (const card of row.children.slice(0, 2)) expect(card.bottom).toBe(row.box.bottom);
          expect(row.children[2]!.height).toBe(natural[index]!.children[0]!.height);
          expect(row.children[2]!.height).toBeLessThan(row.box.height);
          for (const [cardIndex, content] of row.content.entries()) {
            expect(content.box.top).toBeCloseTo(row.children[cardIndex]!.top + content.inset, 1);
          }
          if (row.group.length > 0) {
            expect(row.group.map((child) => child.height)).toEqual(baseline.group.map((child) => child.height));
            expect(row.group[0]!.top + row.group[0]!.height / 2).toBeCloseTo(row.group[1]!.top + row.group[1]!.height / 2, 1);
          }
        }
        expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      });
    }
  }
}
