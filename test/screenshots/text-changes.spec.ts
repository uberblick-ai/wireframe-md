import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`change tints fill root, dock and card content while rows keep content widths in ${scheme}`, async ({ page }) => {
    for (const parent of ["dialog Title", "banner", "page", "frame Caption", "phone", "card", "phone\n  dock"]) {
      const indent = parent.includes("\n") ? "    " : "  ";
      await show(page, `${parent}\n${indent}text.added Added line\n${indent}text.removed Removed line\n${indent}row\n${indent}  text.added Added\n${indent}  text.removed Removed\n${indent}  button Action`, { scheme, host: "column" });
      const geometry = await page.locator(".wf-text").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const parent = node.parentElement!;
        const content = parent.getBoundingClientRect();
        const css = getComputedStyle(parent);
        return {
          left: box.left, right: box.right, top: box.top, height: box.height, width: box.width,
          contentLeft: content.left + Number.parseFloat(css.borderLeftWidth) + Number.parseFloat(css.paddingLeft),
          contentRight: content.right - Number.parseFloat(css.borderRightWidth) - Number.parseFloat(css.paddingRight),
          row: parent.classList.contains("wf-row"), flex: getComputedStyle(node).flex,
        };
      }));
      expect(geometry, parent).toHaveLength(4);
      for (const line of geometry.filter((line) => !line.row)) {
        expect(line.left, parent).toBeCloseTo(line.contentLeft, 1);
        expect(line.right, parent).toBeCloseTo(line.contentRight, 1);
      }
      const rows = geometry.filter((line) => line.row);
      for (const line of rows) {
        expect(line.width, parent).toBeLessThan(110);
        expect(line.flex, parent).toBe("0 1 auto");
      }
      expect(rows[0]!.right, parent).toBeLessThan(rows[1]!.left);
      expect(rows[0]!.top, parent).toBe(rows[1]!.top);
      const action = (await page.locator(".wf-button").boundingBox())!;
      expect(action.x, parent).toBeGreaterThan(rows[1]!.right);
      expect(action.y + action.height / 2, parent).toBeCloseTo(rows[0]!.top + rows[0]!.height / 2, 1);
    }
  });

  test(`change text has ink contrast, themed marks and tints, and a single reading in ${scheme}`, async ({ page }) => {
    const host = await show(page, "card\n  text.added.strong.small Use `GitHub`.\n  text.removed Use a password.", { scheme, host: "column" });
    await expect(page.locator(".wf-added")).toMatchAriaSnapshot('- text: added Use GitHub.');
    await expect(page.locator(".wf-removed")).toMatchAriaSnapshot('- text: removed Use a password.');
    const styles = async () => page.locator(".wf-text").evaluateAll((nodes) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (colour: string) => {
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      };
      return nodes.map((node) => {
        const css = getComputedStyle(node);
        const mark = getComputedStyle(node, "::before");
        const ink = luminance(css.color);
        const tint = luminance(css.backgroundColor);
        const alternative = getComputedStyle(node.querySelector(".wf-text-change")!);
        return {
          colour: css.color, ink: getComputedStyle(node.closest(".wf-root")!).color,
          tint: css.backgroundColor, mark: mark.backgroundColor, content: mark.content,
          markWidth: Number.parseFloat(mark.width), markHeight: Number.parseFloat(mark.height),
          contrast: (Math.max(ink, tint) + 0.05) / (Math.min(ink, tint) + 0.05),
          weight: css.fontWeight, size: Number.parseFloat(css.fontSize),
          alternative: { width: alternative.width, height: alternative.height, clip: alternative.clipPath },
        };
      });
    });
    const original = await styles();
    for (const line of original) {
      expect(line.colour).toBe(line.ink);
      expect(line.contrast).toBeGreaterThanOrEqual(4.5);
      expect(line.content).toBe('""');
      expect(line.markWidth).toBe(3);
      expect(line.markHeight).toBeCloseTo(line.size, 1);
      expect(line.alternative).toEqual({ width: "1px", height: "1px", clip: "inset(50%)" });
    }
    expect(original[0]!.weight).toBe("600");
    expect(original[0]!.size).toBe(11.9);
    await expect(page.locator(".wf-mono")).toHaveCSS("font-size", "11.9px");
    await expect(page.locator(".wf-mono")).toHaveCSS("font-weight", "600");
    await host.evaluate((node) => {
      node.style.setProperty("--wf-success", "rgb(20, 110, 40)");
      node.style.setProperty("--wf-danger", "rgb(150, 30, 40)");
      node.style.setProperty("--wf-success-tint", "rgb(230, 250, 235)");
      node.style.setProperty("--wf-danger-tint", "rgb(250, 230, 235)");
    });
    const custom = await styles();
    expect(custom.map(({ mark, tint }) => ({ mark, tint }))).toEqual([
      { mark: "rgb(20, 110, 40)", tint: "rgb(230, 250, 235)" },
      { mark: "rgb(150, 30, 40)", tint: "rgb(250, 230, 235)" },
    ]);
    await page.keyboard.press("Tab");
    expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
  });

  test(`change lines wrap in narrow cards and rows and put the mark at the logical start in ${scheme}`, async ({ page }) => {
    for (const parent of ["card", "card\n  row"]) {
      const indent = parent.includes("\n") ? "    " : "  ";
      await show(page, `${parent}\n${indent}text.removed Before \`a command with enough separate words to wrap across several lines in this narrow document column\` after.`, { scheme, host: "column", width: 250 });
      const check = async () => page.locator(".wf-removed").evaluate((node) => {
        const box = node.getBoundingClientRect();
        const mono = node.querySelector(".wf-mono")!;
        const range = document.createRange();
        range.selectNodeContents(mono);
        const mark = getComputedStyle(node, "::before");
        const host = document.querySelector(".column")!;
        return {
          lines: new Set([...range.getClientRects()].map((rect) => rect.top)).size,
          contained: [...range.getClientRects()].every((rect) => rect.left >= box.left && rect.right <= box.right),
          markLeft: mark.left, markRight: mark.right, overflow: host.scrollWidth - host.clientWidth,
        };
      });
      const ltr = await check();
      expect(ltr.lines).toBeGreaterThan(1);
      expect(ltr.contained).toBe(true);
      expect(ltr.markLeft).toBe("0px");
      expect(ltr.overflow).toBe(0);
      await page.locator(".wf-root").evaluate((node) => { node.setAttribute("dir", "rtl"); });
      const rtl = await check();
      expect(rtl.markRight).toBe("0px");
      expect(rtl.contained).toBe(true);
      expect(rtl.overflow).toBe(0);
    }
  });
}
