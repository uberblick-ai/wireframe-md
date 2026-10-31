import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`code fields keep equal square boxes and their natural width in every input placement, ${scheme}`, async ({ page }) => {
    for (const parent of ["dialog", "banner", "page", "frame", "phone", "phone\n  dock", "page\n  row", "page\n  row.end", "page\n  row.between", "page\n  row.stretch", "page\n  row.scroll", "page\n  row\n    row"]) {
      for (const labelled of [false, true]) {
        const indent = "  ".repeat(parent.split("\n").length);
        const fields = [4, 5, 6, 7, 8].map((count) => `${indent}input ${labelled ? 'label="A long field name that wraps within its boxes" ' : ""}boxes=${count} 4•`).join("\n");
        await show(page, `${parent}\n${fields}\n${indent}input Hint`, { scheme, host: "column" });
        const geometry = await page.locator(".wf-code").evaluateAll((nodes) => nodes.filter((node) => node.closest('[aria-hidden="true"]') === null).map((node) => {
          const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right };
          };
          const children = [...node.querySelectorAll(".wf-code-box")];
          const style = getComputedStyle(children[0]!);
          const input = document.querySelector('.wf-input:not(.wf-code)[data-line]')!;
          const ordinary = getComputedStyle(input);
          return {
            field: box(node), wrapper: box(node.closest(".wf-field") ?? node), boxes: children.map(box),
            gap: Number.parseFloat(getComputedStyle(node).gap),
            colour: style.color, ink: getComputedStyle(node.closest(".wf-root")!).color,
            background: style.backgroundColor,
            border: [style.borderTopWidth, style.borderTopColor, style.borderRadius],
            ordinaryBorder: [ordinary.borderTopWidth, ordinary.borderTopColor, ordinary.borderRadius],
            ordinaryHeight: input.getBoundingClientRect().height,
          };
        }));
        expect(geometry, parent).toHaveLength(5);
        for (const [index, field] of geometry.entries()) {
          expect(field.boxes).toHaveLength(index + 4);
          const first = field.boxes[0]!;
          expect(first.width).toBeCloseTo(first.height, 2);
          expect(first.height).toBeCloseTo(field.ordinaryHeight, 1);
          expect(field.background).toBe("rgba(0, 0, 0, 0)");
          expect(field.colour).toBe(field.ink);
          expect(field.border).toEqual(field.ordinaryBorder);
          expect(field.gap).toBeGreaterThan(0);
          for (const [boxIndex, box] of field.boxes.entries()) {
            expect(box.width).toBe(first.width);
            expect(box.height).toBe(first.height);
            expect(box.y).toBe(first.y);
            if (boxIndex > 0) expect(box.x - field.boxes[boxIndex - 1]!.right).toBeCloseTo(field.gap, 1);
          }
          expect(field.field.width).toBeCloseTo(field.boxes.at(-1)!.right - first.x, 2);
          expect(Math.abs(field.wrapper.width - field.field.width)).toBeLessThan(0.15);
        }
      }
    }
  });

  test(`eight boxes fit a full-width phone and dock without horizontal scrolling, ${scheme}`, async ({ page }) => {
    for (const labelled of [false, true]) {
      await show(page, `phone\n  input ${labelled ? "label=Code " : ""}boxes=8\n  row\n    input ${labelled ? "label=Code " : ""}boxes=8\n  dock\n    input ${labelled ? "label=Code " : ""}boxes=8`, { scheme, host: "column" });
      const geometry = await page.locator(".wf-phone-viewport, .wf-phone-content, .wf-dock, .wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
      expect(geometry).toEqual(geometry.map(() => 0));
      expect(await page.locator(".wf-code[data-line], .wf-field[data-line] > .wf-code").count()).toBe(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    }
  });

  test(`code fields follow ordinary input alignment beside taller row content, ${scheme}`, async ({ page }) => {
    for (const variant of ["", ".end", ".between", ".scroll", ".stretch"]) {
      await show(page, `page\n  row${variant}\n    image.square width=100 Cover\n    input boxes=6 48\n    input Hint`, { scheme, host: "column" });
      const geometry = await page.locator('.wf-row[data-line]').evaluate((row) => {
        const box = (selector: string) => {
          const rect = row.querySelector(selector)!.getBoundingClientRect();
          return { top: rect.top, height: rect.height };
        };
        return { code: box(".wf-code"), input: box(".wf-input:not(.wf-code)"), image: box(".wf-image") };
      });
      expect(geometry.code).toEqual(geometry.input);
      if (variant === ".stretch") expect(geometry.code.top).toBe(geometry.image.top);
      else expect(geometry.code.top + geometry.code.height / 2).toBeCloseTo(geometry.image.top + geometry.image.height / 2, 1);
    }
  });

  test(`a labelled code field stays at its box width beside fractional cards, ${scheme}`, async ({ page }) => {
    for (const layout of ["block", "flex", "grid", "fit-content"] as const) {
      await show(page, 'page\n  row.between.stretch\n    card width=1/2\n      text First\n    card width=1/2\n      text Second\n    input label="Long field name within the code width" boxes=4 48', { scheme, host: "column", layout });
      const geometry = await page.locator('.wf-code-field[data-line]').evaluate((field) => {
        const code = field.querySelector(".wf-code")!;
        const boxes = [...code.querySelectorAll(".wf-code-box")];
        const first = boxes[0]!.getBoundingClientRect();
        const last = boxes.at(-1)!.getBoundingClientRect();
        return { field: field.getBoundingClientRect().width, code: code.getBoundingClientRect().width, boxes: last.right - first.left };
      });
      expect(geometry.field).toBeCloseTo(geometry.boxes, 1);
      expect(geometry.code).toBeCloseTo(geometry.boxes, 2);
      expect(await page.locator(".wf-root, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth))).toEqual([0, 0]);
    }
  });

  test(`code fields announce one description, centre ink characters and remain inert, ${scheme}`, async ({ page }) => {
    await show(page, 'page\n  input boxes=6 4•\n  input boxes=8\n  input label=Code boxes=6 48', { scheme, host: "column" });
    await expect(page.locator('.wf-code[data-line="2"]')).toMatchAriaSnapshot('- text: 6-character code, 4 •');
    await expect(page.locator('.wf-code[data-line="3"]')).toMatchAriaSnapshot('- text: 8-character code');
    await expect(page.locator('.wf-field[data-line="4"]')).toMatchAriaSnapshot('- text: Code 6-character code, 4 8');
    const positions = await page.locator('.wf-code[data-line="2"] > .wf-code-box').evaluateAll((boxes) => boxes.slice(0, 2).map((box) => {
      const rect = box.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(box);
      const text = range.getBoundingClientRect();
      return { centre: rect.x + rect.width / 2, textCentre: text.x + text.width / 2, top: rect.top, bottom: rect.bottom, textTop: text.top, textBottom: text.bottom };
    }));
    for (const position of positions) {
      expect(position.textCentre).toBeCloseTo(position.centre, 1);
      expect(position.textTop).toBeGreaterThan(position.top);
      expect(position.textBottom).toBeLessThan(position.bottom);
    }
    await page.keyboard.press("Tab");
    expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
    expect(await page.locator(".wf-code [role], .wf-code [tabindex], .wf-code input").count()).toBe(0);
  });
}
