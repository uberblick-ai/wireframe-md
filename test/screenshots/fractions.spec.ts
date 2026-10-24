import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const source = (width: number) => `page width=${width}
  row.stretch
    card width=1/3 padding=8
      text.strong History
      text Today
    card width=2/3 padding=8
      text.title Onboarding flow
      text Goals
  row
    card width=1/4 padding=8
      text Quarter
    card width=80 padding=8
      text Pixels
    card padding=8
      text Rest
  row
    card width=2/3 padding=8
      text Scaled
    card width=2/3 padding=8
      text Scaled`;

const geometry = (page: Page) => page.locator(".wf-row[data-line]:not(.wf-row-group)").evaluateAll((rows) => rows.map((row) => {
  const box = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height };
  };
  return {
    box: box(row), gap: Number.parseFloat(getComputedStyle(row).columnGap) || 7,
    children: [...row.children].filter((child) => !child.classList.contains("wf-card-space")).map((child) => box(child.classList.contains("wf-card-track") ? child.firstElementChild! : child)),
  };
}));

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const width of [360, 710]) {
    test(`fractional rows at page width ${width}, ${scheme}`, async ({ page }) => {
      const host = await show(page, source(width), { scheme, host: "column" });
      const [split, mixed, scaled] = await geometry(page);
      const room = split!.box.width - split!.gap;
      expect(split!.children[0]!.width).toBeCloseTo(room / 3, 1);
      expect(split!.children[1]!.width).toBeCloseTo(room * 2 / 3, 1);
      expect(split!.children[0]!.height).toBe(split!.children[1]!.height);
      expect(split!.children[1]!.right).toBeCloseTo(split!.box.right, 1);
      const mixedRoom = mixed!.box.width - 2 * mixed!.gap - 80;
      expect(mixed!.children[0]!.width).toBeCloseTo(mixedRoom / 4, 1);
      expect(mixed!.children[1]!.width).toBe(80);
      expect(mixed!.children[2]!.width).toBeCloseTo(mixedRoom * 3 / 4, 1);
      for (const card of scaled!.children) expect(card.width).toBeCloseTo((scaled!.box.width - scaled!.gap) / 2, 1);
      expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
      await expect(host).toHaveScreenshot(`fractional-card-widths-${width}-${scheme}.png`);
    });
  }

  test(`pixel cards and every other row child keep their existing widths, ${scheme}`, async ({ page }) => {
    const neighbours = [
      "text A longer caption that wraps beside the cards in a narrow row",
      "image.square width=80 Cover", "button Run", "input Hint", "input label=Name Hint",
      "select Choice", "select label=Role Viewer", "switch.on A longer switch caption that wraps beside the cards",
      "row\n  card width=60\n    text Group\n  text.small Tag",
    ];
    for (const width of [360, 710]) {
      for (const neighbour of neighbours) {
        const baseline = `page width=${width}\n  row\n    card padding=8\n      text First\n    card padding=4\n      text Second\n    card width=60 padding=8\n      text Pixel\n    ${neighbour.replaceAll("\n", "\n    ")}`;
        await show(page, baseline, { scheme, host: "column" });
        const before = (await geometry(page))[0]!;
        await show(page, baseline.replace("card padding=8", "card width=1/4 padding=8"), { scheme, host: "column" });
        const after = (await geometry(page))[0]!;
        const pool = before.children[0]!.width + before.children[1]!.width;
        expect(after.children[0]!.width, neighbour).toBeCloseTo(pool / 4, 1);
        expect(after.children[1]!.width, neighbour).toBeCloseTo(pool * 3 / 4, 1);
        expect(after.children.slice(2).map((child) => child.width), neighbour).toEqual(before.children.slice(2).map((child) => child.width));
      }
    }
  });

  test(`unclaimed room follows end and between alignment, including stretch, ${scheme}`, async ({ page }) => {
    for (const width of [360, 710]) {
      for (const alignment of ["", ".end", ".between", ".end.stretch", ".between.stretch"]) {
        await show(page, `page width=${width}\n  row${alignment}\n    card width=1/4 padding=8\n      text First\n    card width=1/4 padding=8\n      text Second\n      text Taller\n    button Run`, { scheme });
        const row = (await geometry(page))[0]!;
        const room = row.box.width - row.gap * 2 - row.children[2]!.width;
        expect(row.children[0]!.width).toBeCloseTo(room / 4, 1);
        expect(row.children[1]!.width).toBeCloseTo(room / 4, 1);
        if (alignment.includes("end")) expect(row.children[0]!.left).toBeCloseTo(row.box.left + room / 2, 1);
        else expect(row.children[0]!.left).toBe(row.box.left);
        if (alignment !== "") expect(row.children[2]!.right).toBeCloseTo(row.box.right, 1);
        if (alignment.includes("between")) {
          const gaps = [row.children[1]!.left - row.children[0]!.right, row.children[2]!.left - row.children[1]!.right];
          for (const gap of gaps) expect(gap).toBeCloseTo(row.gap + room / 4, 1);
        }
        if (alignment.includes("stretch")) {
          expect(row.children[0]!.height).toBe(row.children[1]!.height);
          for (const child of row.children) expect(child.top).toBe(row.box.top);
        }
      }
    }
  });

  test(`fractional insets fit their border box and over-full rows collapse unsized cards, ${scheme}`, async ({ page }) => {
    for (const padding of ["", " padding=0", " padding=8", " padding=64"]) {
      await show(page, `page width=360\n  row\n    card width=1/9999${padding}\n      image.square\n    card\n      text Rest\n  row\n    card width=2/3${padding}\n      text First\n    card width=2/3${padding}\n      text Second\n    card${padding}\n      text No room`, { scheme });
      const [tiny, overfull] = await geometry(page);
      expect(tiny!.children[0]!.width).toBeCloseTo((tiny!.box.width - tiny!.gap) / 9999, 1);
      expect(overfull!.children[2]!.width).toBe(0);
      for (const child of overfull!.children.slice(0, 2)) expect(child.width).toBeCloseTo((overfull!.box.width - 2 * overfull!.gap) / 2, 1);
      const insets = await page.locator(".wf-card-track > .wf-card").evaluateAll((cards) => cards.map((card) => {
        const box = card.getBoundingClientRect();
        const css = getComputedStyle(card);
        return { width: box.width, padding: Number.parseFloat(css.paddingLeft), border: css.boxShadow };
      }));
      for (const card of insets) {
        expect(card.padding).toBeLessThanOrEqual(card.width / 2 + 0.02);
        expect(card.border).not.toBe("none");
      }
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    }
  });
}
