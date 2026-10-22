import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const tones = { red: "danger", amber: "warning", green: "success", blue: "info" } as const;
const hues = Object.keys(tones) as (keyof typeof tones)[];

for (const scheme of ["light", "dark"] as const) {
  test(`named icon colours override contexts and follow host tones in ${scheme}`, async ({ page }) => {
    await open(page);
    const source = hues.map((hue) => [
      "page",
      `  icon.${hue} point`,
      `  icon.filled.${hue} point`,
      "  table",
      "    row",
      "      cell State",
      `        icon.${hue} point`,
      `        icon.${hue}.filled point`,
      ...["button", "button.primary", "button.danger", "button.link.danger", "button.primary.danger"].flatMap((button) => [
        `        ${button} Action`,
        `          icon.${hue} point`,
        `          icon.filled.${hue} point`,
      ]),
      "banner.warning",
      `  icon.${hue} point`,
      `  icon.filled.${hue} point`,
      "  icon point",
      "  text State",
    ].join("\n")).join("\n");
    await show(page, source, { scheme, host: "column" });
    const check = async () => {
      const actual = await page.evaluate((tones) => {
        const root = document.querySelector(".wf-root")!;
        const probe = document.createElement("span");
        root.append(probe);
        const colours = Object.entries(tones).map(([hue, tone]) => {
          probe.style.color = `var(--_wf-${tone})`;
          const expected = getComputedStyle(probe).color;
          const icons = [...root.querySelectorAll(`.wf-icon.wf-${hue} > svg`)].map((icon) => {
            const css = getComputedStyle(icon);
            return { colour: css.color, paint: icon.classList.contains("wf-icon-filled") ? css.fill : css.stroke };
          });
          return { hue, expected, icons };
        });
        probe.remove();
        return colours;
      }, tones);
      for (const { hue, expected, icons } of actual) {
        expect(icons, hue).toHaveLength(16);
        for (const icon of icons) expect(icon, hue).toEqual({ colour: expected, paint: expected });
      }
    };
    await check();
    await page.locator(".column").evaluate((host) => {
      host.style.setProperty("--wf-danger", "rgb(120, 30, 40)");
      host.style.setProperty("--wf-warning", "rgb(140, 100, 20)");
      host.style.setProperty("--wf-success", "rgb(30, 110, 40)");
      host.style.setProperty("--wf-info", "rgb(30, 70, 130)");
    });
    await check();
    await expect(page.locator(".wf-banner-line > .wf-icon:not(.wf-red, .wf-amber, .wf-green, .wf-blue)")).toHaveCount(4);
    for (const icon of await page.locator(".wf-banner-line > .wf-icon:not(.wf-red, .wf-amber, .wf-green, .wf-blue)").all()) {
      await expect(icon).toHaveCSS("color", "rgb(140, 100, 20)");
    }
  });

  test(`named text colours have 4.5:1 paper contrast and keep variants in ${scheme}`, async ({ page }) => {
    await open(page);
    await show(page, `page\n${hues.map((hue) => `  text.small.strong.${hue} ${hue}`).join("\n")}\n  text.muted.green Muted first\n  text.green.muted Green first`, { scheme, host: "column" });
    const styles = async () => page.evaluate((tones) => {
      const root = document.querySelector(".wf-root")!;
      const probe = document.createElement("span");
      root.append(probe);
      const resolve = (value: string) => {
        probe.style.color = value;
        return getComputedStyle(probe).color;
      };
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (colour: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      };
      const paper = luminance(getComputedStyle(root.querySelector(".wf-page")!).backgroundColor);
      const text = Object.entries(tones).map(([hue, tone]) => {
        const css = getComputedStyle(root.querySelector(`.wf-text.wf-small.wf-${hue}`)!);
        const light = luminance(css.color);
        return {
          hue, colour: css.color, tone: resolve(`var(--_wf-${tone})`),
          amberText: resolve("light-dark(color-mix(in oklab, var(--_wf-warning) 80%, var(--_wf-ink)), var(--_wf-warning))"),
          contrast: (Math.max(paper, light) + 0.05) / (Math.min(paper, light) + 0.05),
          size: Number.parseFloat(css.fontSize), weight: css.fontWeight,
        };
      });
      const muted = resolve("var(--_wf-muted)");
      const first = getComputedStyle(root.querySelector(".wf-text.wf-muted")!).color;
      const green = getComputedStyle(root.querySelector(".wf-text.wf-green:not(.wf-small)")!).color;
      probe.remove();
      return { text, muted, first, green, baseSize: Number.parseFloat(getComputedStyle(root).fontSize) };
    }, tones);
    const original = await styles();
    for (const text of original.text) {
      expect(text.contrast, text.hue).toBeGreaterThanOrEqual(4.5);
      expect(text.colour).toBe(text.hue === "amber" ? text.amberText : text.tone);
      expect(text.size).toBeCloseTo(original.baseSize * 0.85, 1);
      expect(text.weight).toBe("600");
    }
    expect(original.first).toBe(original.muted);
    expect(original.green).toBe(original.text.find((text) => text.hue === "green")!.tone);
    await page.locator(".column").evaluate((host) => {
      host.style.setProperty("--wf-danger", "rgb(120, 30, 40)");
      host.style.setProperty("--wf-warning", "rgb(140, 100, 20)");
      host.style.setProperty("--wf-success", "rgb(30, 110, 40)");
      host.style.setProperty("--wf-info", "rgb(30, 70, 130)");
      host.style.setProperty("--wf-ink", "rgb(20, 20, 20)");
    });
    const custom = await styles();
    for (const text of custom.text) {
      expect(text.colour).toBe(text.hue === "amber" ? text.amberText : text.tone);
      expect(text.colour).not.toBe(original.text.find((before) => before.hue === text.hue)!.colour);
    }
  });
}
