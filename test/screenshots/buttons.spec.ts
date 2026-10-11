import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

for (const scheme of ["light", "dark"] as const) {
  for (const parent of ["row", "cell", "frame"] as const) {
    test(`link captions alone are underlined in each variant in a ${parent} in ${scheme}`, async ({ page }) => {
      await open(page);
      const buttons: string[] = [];
      for (const primary of ["", ".primary"]) {
        for (const danger of ["", ".danger"]) {
          for (const focus of ["", ".focus"]) {
            for (const icon of ["", "pin", "pinn"]) {
              buttons.push(`button.link${primary}${danger}${focus} Clear filters${icon === "" ? "" : `\n  icon ${icon}`}`);
            }
          }
        }
      }
      buttons.push("button.link\n  icon pin", "button.link\n  icon pinn", "button Archive\n  icon archive", "button.primary Save");
      const indent = parent === "frame" ? "  " : parent === "row" ? "    " : "        ";
      const head = parent === "frame" ? "frame Actions" : parent === "row" ? "page\n  row" : "page\n  table\n    row\n      cell";
      const source = `${head}\n${buttons.map((button) => button.split("\n").map((line) => `${indent}${line}`).join("\n")).join("\n")}`;
      const container = await show(page, source, { scheme, host: "column" });
      const check = async (thickness: string) => {
        const actual = await page.locator(".wf-root").evaluate((root) => {
          const tokenColour = (token: string) => {
            const probe = document.createElement("span");
            probe.style.color = `var(--_wf-${token})`;
            root.append(probe);
            const colour = getComputedStyle(probe).color;
            probe.remove();
            return colour;
          };
          const colours = { ink: tokenColour("ink"), primary: tokenColour("primary"), danger: tokenColour("danger") };
          return [...root.querySelectorAll<HTMLElement>(".wf-button")].map((button) => {
            button.focus();
            const caption = button.querySelector(".wf-button-caption");
            const style = caption === null ? null : getComputedStyle(caption);
            const css = getComputedStyle(button);
            const token = button.classList.contains("wf-danger") ? "danger" : button.classList.contains("wf-primary") ? "primary" : "ink";
            return {
              tag: button.localName, focusable: document.activeElement === button,
              attributes: ["role", "href", "tabindex"].map((name) => button.getAttribute(name)),
              caption: caption?.textContent ?? null, link: button.classList.contains("wf-link"),
              expectedColour: colours[token], colour: css.color, decoration: css.textDecorationLine,
              captionColour: style?.color, captionDecoration: style?.textDecorationLine,
              underlineColour: style?.textDecorationColor, thickness: style?.textDecorationThickness,
              icons: [...button.querySelectorAll(".wf-icon, .wf-icon-glyph, .wf-icon-unknown")].map((icon) => getComputedStyle(icon).textDecorationLine),
              focus: button.classList.contains("wf-focus"), ring: css.outlineStyle,
            };
          });
        });
        for (const button of actual) {
          expect(button.tag).toBe("span");
          expect(button.focusable).toBe(false);
          expect(button.attributes).toEqual([null, null, null]);
          expect(button.decoration).toBe("none");
          expect(button.icons.every((decoration) => decoration === "none")).toBe(true);
          if (button.link && button.caption !== null) {
            expect(button.caption).toBe("Clear filters");
            expect(button.colour).toBe(button.expectedColour);
            expect(button.captionColour).toBe(button.colour);
            expect(button.underlineColour).toBe(button.colour);
            expect(button.captionDecoration).toBe("underline");
            expect(button.thickness).toBe(thickness);
          } else expect(button.caption).toBeNull();
          expect(button.ring).toBe(button.focus ? "solid" : "none");
        }
      };
      await check("1px");
      await container.evaluate((host) => {
        host.style.setProperty("--wf-stroke", "2px");
        host.style.setProperty("--wf-ink", "rgb(40, 50, 60)");
        host.style.setProperty("--wf-primary", "rgb(70, 80, 90)");
        host.style.setProperty("--wf-danger", "rgb(100, 110, 120)");
      });
      await check("2px");
    });
  }

  test(`wrapped link captions are underlined on every line in ${scheme}`, async ({ page }) => {
    await open(page);
    const container = await show(page, "frame Actions\n  button.link.focus Clear filters and restore the original selection for every document in the current view\n    icon pin\n  button.link.danger Archive the selected document and remove it from the current view\n    icon pinn", { scheme, host: "column", width: 320 });
    const captions = await page.locator(".wf-button-caption").evaluateAll((elements) => elements.map((caption) => {
      const range = document.createRange();
      range.selectNodeContents(caption);
      return { lines: range.getClientRects().length, decoration: getComputedStyle(caption).textDecorationLine };
    }));
    for (const caption of captions) {
      expect(caption.lines).toBeGreaterThan(1);
      expect(caption.decoration).toBe("underline");
    }
    await expect(container).toHaveScreenshot(`buttons-wrapping-links-${scheme}-column.png`);
  });
}
