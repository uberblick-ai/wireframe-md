import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const variants = Array.from({ length: 16 }, (_, mask) =>
  ["primary", "danger", "link", "focus"].filter((_, bit) => mask & (1 << bit)).map((variant) => `.${variant}`).join(""));

for (const scheme of ["light", "dark"] as const) {
  test(`disabled buttons keep each variant muted and readable in ${scheme}`, async ({ page }) => {
    await open(page);
    const source = `page\n${variants.map((variant) => `  row\n${["", "\n      icon.blue restore", "\n      icon archive"].map((icon, index) =>
      ["", ".disabled"].map((disabled) => `    button${disabled}${variant}${index === 2 ? "" : " Restore"}${icon}`).join("\n")).join("\n")}`).join("\n")}`;
    const host = await show(page, source, { scheme, host: "column" });
    const inspect = () => page.locator(".wf-button[data-line]").evaluateAll((buttons) => {
      // Resolve CSS colours through Chromium and composite the button as one
      // group over paper, as CSS opacity does. Contrast is measured on the
      // rendered colours, including translucent borders and transparent links.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const rgba = (colour: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
      };
      const blend = (front: number[], back: number[], opacity = 1) => front.slice(0, 3).map((value, index) =>
        value * front[3]! * opacity + back[index]! * (1 - front[3]! * opacity));
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      const contrast = (a: number[], b: number[]) => {
        const values = [luminance(a), luminance(b)];
        return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      };
      // Icons can have almost identical luminance to a destructive fill.
      // Include colour contrast: fading must reduce their RGB difference
      // from the ground, even when a hue's luminance crosses the fill's.
      const difference = (a: number[], b: number[]) => Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));
      return buttons.map((button) => {
        const css = getComputedStyle(button);
        const paper = rgba(getComputedStyle(button.closest(".wf-page")!).backgroundColor);
        const opacity = Number(css.opacity);
        const ground = blend(rgba(css.backgroundColor), paper, opacity);
        const caption = button.querySelector(".wf-button-caption");
        const icon = button.querySelector(".wf-icon");
        const foreground = (colour: string) => blend([...blend(rgba(colour), rgba(css.backgroundColor)), 1], paper, opacity);
        return {
          disabled: button.classList.contains("wf-disabled"), opacity,
          captionContrast: contrast(foreground(css.color), ground),
          iconDifference: icon === null ? null : difference(foreground(getComputedStyle(icon).color), ground),
          fillContrast: contrast(ground, paper),
          borderContrast: contrast(blend(rgba(css.borderTopColor), paper, opacity), paper),
          ringContrast: contrast(blend(rgba(css.outlineColor), paper, opacity), paper),
          colour: css.color, fill: css.backgroundColor, border: css.borderTopColor,
          iconColour: icon === null ? null : getComputedStyle(icon).color,
          link: button.classList.contains("wf-link"), focus: button.classList.contains("wf-focus"),
          decoration: caption === null ? "none" : getComputedStyle(caption).textDecorationLine,
          iconDecoration: icon === null ? "none" : getComputedStyle(icon).textDecorationLine,
          outline: css.outlineStyle, tag: button.localName,
          attributes: ["role", "tabindex", "aria-label"].map((name) => button.getAttribute(name)),
        };
      });
    });
    const original = await inspect();
    expect(original).toHaveLength(96);
    for (let index = 0; index < original.length; index += 2) {
      const enabled = original[index]!;
      const disabled = original[index + 1]!;
      expect(disabled.disabled).toBe(true);
      expect(disabled.captionContrast).toBeGreaterThanOrEqual(3);
      expect(disabled.captionContrast).toBeLessThan(enabled.captionContrast);
      if (disabled.iconDifference !== null) expect(disabled.iconDifference).toBeLessThan(enabled.iconDifference!);
      if (!disabled.link) {
        expect(disabled.borderContrast).toBeLessThan(enabled.borderContrast);
        if (disabled.fillContrast > 1) expect(disabled.fillContrast).toBeLessThan(enabled.fillContrast);
      }
      expect(disabled.tag).toBe("span");
      expect(disabled.attributes).toEqual([null, null, null]);
      expect(disabled.outline).toBe(disabled.focus ? "solid" : "none");
      if (disabled.focus) expect(disabled.ringContrast).toBeLessThan(enabled.ringContrast);
      expect(disabled.decoration).toBe(disabled.link && index % 6 !== 4 ? "underline" : "none");
      expect(disabled.iconDecoration).toBe("none");
    }
    await expect(page.locator(".wf-button[data-line]").nth(1)).toMatchAriaSnapshot('- text: Restore , unavailable');
    await expect(page.locator(".wf-button[data-line]").nth(3)).toMatchAriaSnapshot('- text: Restore , unavailable');
    await expect(page.locator(".wf-button[data-line]").nth(5)).toMatchAriaSnapshot('- text: archive, unavailable');
    await expect(host).toHaveScreenshot(`buttons-disabled-${scheme}-column.png`);
    await host.evaluate((node) => {
      node.style.setProperty("--wf-ink", "rgb(30, 40, 50)");
      node.style.setProperty("--wf-paper", "rgb(245, 240, 235)");
      node.style.setProperty("--wf-primary", "rgb(60, 70, 80)");
      node.style.setProperty("--wf-primary-ink", "rgb(250, 245, 240)");
      node.style.setProperty("--wf-danger", "rgb(140, 50, 60)");
      node.style.setProperty("--wf-danger-ink", "rgb(255, 245, 235)");
      node.style.setProperty("--wf-line", "rgb(120, 130, 140)");
      node.style.setProperty("--wf-info", "rgb(40, 70, 130)");
      node.style.setProperty("--wf-focus", "rgb(150, 80, 40)");
    });
    const mapped = await inspect();
    for (let index = 0; index < mapped.length; index += 2) {
      const enabled = mapped[index]!;
      const disabled = mapped[index + 1]!;
      expect(disabled.colour).toBe(enabled.colour);
      expect(disabled.fill).toBe(enabled.fill);
      expect(disabled.border).toBe(enabled.border);
      expect(disabled.iconColour).toBe(enabled.iconColour);
      expect(disabled.colour).not.toBe(original[index + 1]!.colour);
    }
    for (const button of await page.locator(".wf-button[data-line]").all()) {
      expect(await button.evaluate((node) => { (node as HTMLElement).focus(); return document.activeElement === node; })).toBe(false);
    }
  });
}
