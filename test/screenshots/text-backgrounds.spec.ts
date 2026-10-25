import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const tones = { red: "danger", amber: "warning", green: "success", blue: "info" } as const;
const hues = Object.keys(tones) as (keyof typeof tones)[];

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`text backgrounds fill root, dock and card content while rows keep content widths in ${scheme}`, async ({ page }) => {
    for (const parent of ["dialog Title", "banner", "page", "frame Caption", "phone", "card", "phone\n  dock"]) {
      const indent = parent.includes("\n") ? "    " : "  ";
      await show(page, `${parent}\n${indent}text.bg-red Before\n${indent}text.bg-green After\n${indent}row\n${indent}  text.bg-amber Review\n${indent}  text.red.bg-blue Check\n${indent}  button Action`, { scheme, host: "column" });
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

  test(`ink and muted text have 4.5:1 contrast on every tint and follow host tokens in ${scheme}`, async ({ page }) => {
    const source = `card\n${hues.flatMap((hue) => [`  text.bg-${hue}.strong.small Use \`GitHub\`.`, `  text.muted.bg-${hue} Review the change.`]).join("\n")}`;
    const host = await show(page, source, { scheme, host: "column" });
    for (const hue of hues) {
      await expect(page.locator(`.wf-bg-${hue}.wf-strong`)).toMatchAriaSnapshot('- text: Use GitHub.');
      await expect(page.locator(`.wf-bg-${hue}.wf-muted`)).toMatchAriaSnapshot('- text: Review the change.');
    }
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
        const ink = luminance(css.color);
        const tint = luminance(css.backgroundColor);
        return {
          colour: css.color, tint: css.backgroundColor,
          contrast: (Math.max(ink, tint) + 0.05) / (Math.min(ink, tint) + 0.05),
          content: getComputedStyle(node, "::before").content,
          weight: css.fontWeight, size: Number.parseFloat(css.fontSize),
        };
      });
    });
    const original = await styles();
    const ink = await page.locator(".wf-root").evaluate((root) => getComputedStyle(root).color);
    for (const [index, line] of original.entries()) {
      if (index % 2 === 0) expect(line.colour).toBe(ink);
      else expect(line.colour).not.toBe(ink);
      expect(line.contrast).toBeGreaterThanOrEqual(4.5);
      expect(line.content).toBe("none");
    }
    expect(original[0]!.weight).toBe("600");
    expect(original[0]!.size).toBe(11.9);
    for (const mono of await page.locator(".wf-mono").all()) {
      await expect(mono).toHaveCSS("font-size", "11.9px");
      await expect(mono).toHaveCSS("font-weight", "600");
    }
    await host.evaluate((node) => {
      node.style.setProperty("--wf-ink", "rgb(10, 20, 30)");
      node.style.setProperty("--wf-muted", "rgb(60, 70, 80)");
      node.style.setProperty("--wf-danger-tint", "rgb(250, 230, 235)");
      node.style.setProperty("--wf-warning-tint", "rgb(250, 245, 220)");
      node.style.setProperty("--wf-success-tint", "rgb(230, 250, 235)");
      node.style.setProperty("--wf-info-tint", "rgb(230, 235, 250)");
    });
    const custom = await styles();
    expect(custom.map(({ tint }) => tint)).toEqual([
      "rgb(250, 230, 235)", "rgb(250, 230, 235)",
      "rgb(250, 245, 220)", "rgb(250, 245, 220)",
      "rgb(230, 250, 235)", "rgb(230, 250, 235)",
      "rgb(230, 235, 250)", "rgb(230, 235, 250)",
    ]);
    expect(custom.map(({ colour }) => colour)).toEqual(hues.flatMap(() => ["rgb(10, 20, 30)", "rgb(60, 70, 80)"]));
    await page.keyboard.press("Tab");
    expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
  });

  test(`text hue and background draw independently in either order and keep title sizing in ${scheme}`, async ({ page }) => {
    await show(page, "card\n  text.red.bg-blue.title Use `GitHub`.\n  text.bg-blue.red.title Use `GitHub`.\n  text.red Red\n  text.bg-blue Blue\n  text.title Title", { scheme, host: "column" });
    const styles = await page.locator(".wf-text").evaluateAll((nodes) => nodes.map((node) => {
      const css = getComputedStyle(node);
      return { colour: css.color, tint: css.backgroundColor, weight: css.fontWeight, size: css.fontSize };
    }));
    expect(styles[0]).toEqual(styles[1]);
    expect(styles[0]!.colour).toBe(styles[2]!.colour);
    expect(styles[0]!.tint).toBe(styles[3]!.tint);
    expect(styles[0]!.size).toBe(styles[4]!.size);
    expect(styles[0]!.weight).toBe(styles[4]!.weight);
    for (const line of await page.locator(".wf-title.wf-bg-blue").all()) await expect(line).toMatchAriaSnapshot('- text: Use GitHub.');
  });

  test(`banners share text tints and host overrides, with readable dark highlights in ${scheme}`, async ({ page }) => {
    const source = [
      "page",
      "  card",
      ...hues.map((hue) => `    text.${hue}.bg-${hue} ${hue}`),
      ...hues.flatMap((hue) => [
        `banner.${tones[hue]}`,
        "  icon point",
        "  text State",
        "  text.muted Details",
      ]),
    ].join("\n");
    const host = await show(page, source, { scheme, host: "column" });
    const styles = () => page.evaluate((tones) => {
      const paper = getComputedStyle(document.querySelector(".wf-page")!).backgroundColor;
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
      const contrast = (foreground: string, background: string) => {
        const a = luminance(foreground);
        const b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      return Object.entries(tones).map(([hue, tone]) => {
        const text = getComputedStyle(document.querySelector(`.wf-text.wf-bg-${hue}`)!);
        const banner = document.querySelector(`.wf-banner.wf-${tone}`)!;
        const fill = getComputedStyle(banner).backgroundColor;
        return {
          hue, textTint: text.backgroundColor, bannerTint: fill,
          paperContrast: contrast(text.backgroundColor, paper),
          hueContrast: contrast(text.color, text.backgroundColor),
          iconContrast: contrast(getComputedStyle(banner.querySelector(".wf-icon")!).color, fill),
          inkContrast: contrast(getComputedStyle(banner.querySelector(".wf-text:not(.wf-muted)")!).color, fill),
          mutedContrast: contrast(getComputedStyle(banner.querySelector(".wf-muted")!).color, fill),
        };
      });
    }, tones);
    for (const actual of await styles()) {
      expect(actual.bannerTint, actual.hue).toBe(actual.textTint);
      expect(actual.inkContrast, actual.hue).toBeGreaterThanOrEqual(4.5);
      expect(actual.mutedContrast, actual.hue).toBeGreaterThanOrEqual(4.5);
      if (scheme === "dark") {
        expect(actual.iconContrast, actual.hue).toBeGreaterThanOrEqual(3);
        expect(actual.paperContrast, actual.hue).toBeGreaterThanOrEqual(1.2);
        expect(actual.hueContrast, actual.hue).toBeGreaterThanOrEqual(4.5);
      }
    }
    const overrides = {
      danger: "rgb(250, 230, 235)", warning: "rgb(250, 245, 220)",
      success: "rgb(230, 250, 235)", info: "rgb(230, 235, 250)",
    };
    await host.evaluate((node, overrides) => {
      for (const [tone, tint] of Object.entries(overrides)) node.style.setProperty(`--wf-${tone}-tint`, tint);
    }, overrides);
    for (const actual of await styles()) {
      const expected = overrides[tones[actual.hue as keyof typeof tones]];
      expect(actual.textTint, actual.hue).toBe(expected);
      expect(actual.bannerTint, actual.hue).toBe(expected);
    }
  });

  test(`tinted lines wrap in narrow cards and rows in both directions in ${scheme}`, async ({ page }) => {
    for (const parent of ["card", "card\n  row"]) {
      const indent = parent.includes("\n") ? "    " : "  ";
      await show(page, `${parent}\n${indent}text.bg-red Before \`a command with enough separate words to wrap across several lines in this narrow document column\` after.`, { scheme, host: "column", width: 250 });
      const check = async () => page.locator(".wf-bg-red").evaluate((node) => {
        const box = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node.querySelector(".wf-mono")!);
        const host = document.querySelector(".column")!;
        const css = getComputedStyle(node);
        return {
          lines: new Set([...range.getClientRects()].map((rect) => rect.top)).size,
          contained: [...range.getClientRects()].every((rect) => rect.left >= box.left && rect.right <= box.right),
          insetStart: Number.parseFloat(css.paddingInlineStart), insetEnd: Number.parseFloat(css.paddingInlineEnd),
          overflow: host.scrollWidth - host.clientWidth,
        };
      });
      for (const direction of ["ltr", "rtl"]) {
        await page.locator(".wf-root").evaluate((node, direction) => { node.setAttribute("dir", direction); }, direction);
        const actual = await check();
        expect(actual.lines).toBeGreaterThan(1);
        expect(actual.contained).toBe(true);
        expect(actual.insetStart).toBeGreaterThan(0);
        expect(actual.insetEnd).toBe(actual.insetStart);
        expect(actual.overflow).toBe(0);
      }
    }
  });
}
