import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

for (const scheme of ["light", "dark"] as const) {
  test(`icons inherit context colours and scaled stroke tokens in ${scheme}`, async ({ page }) => {
    await open(page);
    await show(page, "banner.warning\n  icon pin\n  text State\npage\n  icon pin\n  icon.filled pin\n  select Any\n  table\n    row.head\n      cell.sortable Name\n    row\n      cell Text\n        icon pin\n        button.primary\n          icon pin\n        button.link.danger Archive\n          icon archive", { scheme, host: "column" });
    const styles = async () => page.evaluate(() => {
      const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      const ink = css(".wf-page");
      const caret = css(".wf-select-caret");
      const icon = css(".wf-page > .wf-icon > svg.wf-icon-outline");
      const filled = css(".wf-icon-filled");
      const banner = css(".wf-banner");
      return {
        muted: caret.color, standalone: icon.color, iconWidth: icon.width,
        iconStroke: Number.parseFloat(icon.strokeWidth) / 24,
        caretStroke: Number.parseFloat(caret.strokeWidth) / 16,
        sortStroke: Number.parseFloat(css(".wf-cell-sort").strokeWidth) / 16,
        outlineFill: icon.fill, outlineStroke: icon.stroke,
        filledFill: filled.fill, filledColor: filled.color, filledStroke: filled.stroke,
        bannerIcon: css(".wf-banner .wf-icon").color, bannerTone: banner.getPropertyValue("--_wf-tone").trim(),
        button: css(".wf-primary").color, buttonIcon: css(".wf-primary .wf-icon").color,
        danger: css(".wf-danger").color, dangerIcon: css(".wf-danger .wf-icon").color,
        fontSize: Number.parseFloat(ink.fontSize),
      };
    });
    const check = (actual: Awaited<ReturnType<typeof styles>>) => {
      expect(actual.standalone).toBe(actual.muted);
      expect(actual.iconStroke).toBe(actual.caretStroke);
      expect(actual.iconStroke).toBe(actual.sortStroke);
      expect(Number.parseFloat(actual.iconWidth)).toBeCloseTo(actual.fontSize * 1.15, 1);
      expect(actual.outlineFill).toBe("none");
      expect(actual.outlineStroke).toBe(actual.muted);
      expect(actual.filledFill).toBe(actual.filledColor);
      expect(actual.filledStroke).toBe("none");
      expect(actual.buttonIcon).toBe(actual.button);
      expect(actual.dangerIcon).toBe(actual.danger);
    };
    check(await styles());
    await page.locator(".column").evaluate((host) => {
      host.style.setProperty("--wf-muted", "rgb(40, 50, 60)");
      host.style.setProperty("--wf-warning", "rgb(70, 80, 90)");
      host.style.setProperty("--wf-stroke", "2px");
    });
    const custom = await styles();
    check(custom);
    expect(custom.standalone).toBe("rgb(40, 50, 60)");
    expect(custom.bannerIcon).toBe("rgb(70, 80, 90)");
    expect(custom.iconStroke).toBe(3 / 16);
  });

  test(`icons line up with cell text, chips and inert actions in ${scheme}`, async ({ page }) => {
    await open(page);
    const source = readFileSync(new URL("../../examples/icons/1-styles/pins-and-actions.wireframe", import.meta.url), "utf8");
    await show(page, source, { scheme, host: "column" });
    await expect(page.getByRole("img", { name: "pin", exact: true })).toHaveCount(6);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector(".wf-root")!;
      return {
        width: root.clientWidth, scrollWidth: root.scrollWidth,
        cells: [...document.querySelectorAll(".wf-cell")].map((cell) => {
          const elements = [...cell.children];
          return elements.every((element, i) => i === 0 || element.getBoundingClientRect().left >= elements[i - 1]!.getBoundingClientRect().right);
        }),
        buttons: [...document.querySelectorAll<HTMLElement>(".wf-button")].map((button) => {
          button.focus();
          return { tag: button.localName, focusable: document.activeElement === button };
        }),
      };
    });
    expect(geometry.scrollWidth).toBe(geometry.width);
    expect(geometry.cells.every(Boolean)).toBe(true);
    for (const button of geometry.buttons) expect(button).toEqual({ tag: "span", focusable: false });
    const bare = page.locator(".wf-button.wf-link.wf-icon-only").first();
    await expect(bare).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".wf-button.wf-icon-only:not(.wf-link)")).toHaveCSS("border-top-style", "solid");
  });

  for (const host of ["standalone", "column"] as const) {
    test(`cell icons and action captions align vertically in ${scheme} on ${host}`, async ({ page }) => {
      await open(page);
      const actions = ["button.link", "button", "button.link Archive", "button Archive", "button.link Remove"];
      const rows = actions.map((action, index) =>
        `    row\n      cell Name\n        icon pin\n        chip web\n        ${action}${index === 4 ? "" : "\n          icon pin"}`);
      const container = await show(page, `page\n  table\n${rows.join("\n")}`, { scheme, host });
      for (const fontSize of [16, 20]) {
        await container.evaluate((element, size) => element.style.setProperty("--wf-text-size", `${size}px`), fontSize);
        const cells = await page.locator(".wf-cell").evaluateAll((elements) => elements.map((cell) => {
          const centre = (box: DOMRect) => box.top + box.height / 2;
          const textCentre = (node: Node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return centre(range.getBoundingClientRect());
          };
          const button = cell.querySelector(".wf-button")!;
          return {
            text: textCentre(cell.firstChild!),
            icon: centre(cell.querySelector(":scope > .wf-icon")!.getBoundingClientRect()),
            chip: centre(cell.querySelector(".wf-chip")!.getBoundingClientRect()),
            button: centre(button.getBoundingClientRect()),
            buttonIcon: button.querySelector("svg") === null ? null : centre(button.querySelector("svg")!.getBoundingClientRect()),
            caption: button.lastChild!.nodeType === Node.TEXT_NODE ? textCentre(button.lastChild!) : null,
          };
        }));
        for (const [index, cell] of cells.entries()) {
          // The text range includes ascenders and descenders; allow the small
          // difference from CSS's x-height centre, but reject an SVG baseline.
          for (const [kind, centre] of Object.entries(cell)) {
            if (centre === null) continue;
            expect(Math.abs(centre - cell.text), `${actions[index]} ${kind} at ${fontSize}px`).toBeLessThanOrEqual(fontSize / 8);
          }
        }
      }
    });
  }
}
