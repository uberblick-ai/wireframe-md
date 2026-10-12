import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => {
  await open(page);
});

for (const scheme of ["light", "dark"] as const) {
  for (const name of ["browser", "window", "general"]) {
    test(`${name} wrapper fits the document column in ${scheme}`, async ({ page }) => {
      const source = readFileSync(new URL(`../../examples/pages/1-wrappers/${name}.wireframe`, import.meta.url), "utf8");
      await show(page, source, { scheme, host: "column" });
      const sizes = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>(".wf-root")!;
        const column = document.querySelector<HTMLElement>(".column")!;
        const wrapper = document.querySelector<HTMLElement>(".wf-page")!;
        const content = wrapper.querySelector<HTMLElement>(".wf-page-content") ?? wrapper;
        return {
          rootWidth: root.clientWidth, rootScroll: root.scrollWidth,
          columnWidth: column.clientWidth, columnScroll: column.scrollWidth,
          pageWidth: wrapper.getBoundingClientRect().width,
          pageOverflow: getComputedStyle(wrapper).overflow,
          contentOverflow: getComputedStyle(content).overflow,
        };
      });
      expect(sizes.rootWidth).toBe(710);
      expect(sizes.rootScroll).toBe(710);
      expect(sizes.columnScroll).toBe(sizes.columnWidth);
      expect(sizes.pageWidth).toBe(name === "browser" ? 702 : name === "window" ? 480 : 360);
      expect(sizes.pageOverflow).toBe("visible");
      expect(sizes.contentOverflow).toBe("visible");
      await expect(page.locator(".wf-root button, .wf-root input, .wf-root a, .wf-root [tabindex], .wf-root [contenteditable]")).toHaveCount(0);
      if (name === "browser") {
        const cards = await page.locator(".wf-page-content > .wf-row > .wf-card").evaluateAll((cards) => cards.map((card) => {
          const box = card.getBoundingClientRect();
          return { top: box.top, left: box.left, right: box.right };
        }));
        expect(cards).toHaveLength(3);
        expect(new Set(cards.map((card) => card.top)).size).toBe(1);
        expect(cards.every((card, index) => index === 0 || card.left > cards[index - 1]!.right)).toBe(true);
      }
      if (name === "window") {
        const geometry = await page.locator(".wf-window-title").evaluate((title) => {
          const text = document.createRange();
          text.selectNodeContents(title);
          const label = text.getBoundingClientRect();
          const window = title.closest(".wf-page")!.getBoundingClientRect();
          return { titleCentre: label.left + label.width / 2, windowCentre: window.left + window.width / 2 };
        });
        expect(Math.abs(geometry.titleCentre - geometry.windowCentre)).toBeLessThan(0.5);
      }
      if (name === "general") await expect(page.locator(".wf-page-chrome")).toHaveCount(0);
    });
  }

  for (const variant of ["browser", "window"]) {
    for (const layout of ["block", "flex", "grid"] as const) {
      test(`${variant} strip follows a wide table in a ${layout} host in ${scheme}`, async ({ page }) => {
        const cells = Array.from({ length: 12 }, (_, index) => `      cell UnbreakableColumn${index}`).join("\n");
        await show(page, `page.${variant} width=480 Label\n  text.title Wide content\n  table\n    row.head\n${cells}`, { scheme, host: "column", layout });
        const geometry = await page.evaluate(() => {
          const wrapper = document.querySelector<HTMLElement>(".wf-page")!;
          const strip = document.querySelector<HTMLElement>(".wf-page-chrome")!;
          const root = document.querySelector<HTMLElement>(".wf-root")!;
          const column = document.querySelector<HTMLElement>(".column")!;
          const pageBox = wrapper.getBoundingClientRect();
          const stripBox = strip.getBoundingClientRect();
          const border = Number.parseFloat(getComputedStyle(wrapper).borderLeftWidth);
          return {
            width: pageBox.width, stripWidth: stripBox.width,
            stripLeft: stripBox.left, pageLeft: pageBox.left, border,
            rootWidth: root.clientWidth, rootScroll: root.scrollWidth,
            columnWidth: column.clientWidth, columnScroll: column.scrollWidth,
            documentWidth: document.documentElement.clientWidth, documentScroll: document.documentElement.scrollWidth,
          };
        });
        expect(geometry.width).toBeGreaterThan(710);
        expect(geometry.stripWidth).toBeCloseTo(geometry.width - 2 * geometry.border, 1);
        expect(geometry.stripLeft).toBeCloseTo(geometry.pageLeft + geometry.border, 1);
        expect(geometry.rootScroll).toBeGreaterThan(geometry.rootWidth);
        expect(geometry.rootWidth).toBeLessThanOrEqual(710);
        expect(geometry.columnScroll).toBe(geometry.columnWidth);
        expect(geometry.documentScroll).toBe(geometry.documentWidth);
      });
    }

    for (const width of [710, 200]) {
      for (const attribute of ["", " width=480"]) {
        test(`${variant}${attribute} long label ellipsizes within ${width} px in ${scheme}`, async ({ page }) => {
          const sizes = async () => page.evaluate(() => {
            const root = document.querySelector<HTMLElement>(".wf-root")!;
            const wrapper = document.querySelector<HTMLElement>(".wf-page")!;
            const strip = document.querySelector<HTMLElement>(".wf-page-chrome")!;
            const label = strip.lastElementChild!;
            const css = getComputedStyle(label);
            const range = document.createRange();
            range.selectNodeContents(label);
            return {
              root: root.clientWidth, scroll: root.scrollWidth,
              page: wrapper.getBoundingClientRect().width,
              strip: strip.getBoundingClientRect().width,
              stripHeight: strip.getBoundingClientRect().height,
              labelWidth: label.getBoundingClientRect().width,
              labelRight: label.getBoundingClientRect().right,
              stripRight: strip.getBoundingClientRect().right,
              textWidth: range.getBoundingClientRect().width,
              whiteSpace: css.whiteSpace, overflow: css.overflow, ellipsis: css.textOverflow,
              lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size,
              marks: [...strip.firstElementChild!.children].map((mark) => mark.getBoundingClientRect().width),
            };
          });
          await show(page, `page.${variant}${attribute} Short\n  text Body`, { scheme, host: "column", width });
          const short = await sizes();
          await show(page, `page.${variant}${attribute}\n  text Body`, { scheme, host: "column", width });
          const empty = await sizes();
          expect(empty.stripHeight).toBe(short.stripHeight);
          await show(page, `page.${variant}${attribute} ${"x".repeat(2000)}\n  text Body`, { scheme, host: "column", width });
          const long = await sizes();
          expect(long.page).toBe(short.page);
          expect(long.strip).toBe(short.strip);
          expect(long.root).toBe(width);
          expect(long.scroll).toBe(width);
          expect(long.labelWidth).toBeGreaterThan(0);
          expect(long.labelRight).toBeLessThan(long.stripRight);
          expect(long.textWidth).toBeGreaterThan(long.labelWidth);
          expect(long.whiteSpace).toBe("nowrap");
          expect(long.overflow).toBe("hidden");
          expect(long.ellipsis).toBe("ellipsis");
          expect(long.lines).toBe(1);
          expect(long.marks).toEqual(short.marks);
          await page.keyboard.press("Tab");
          expect(await page.locator(".wf-page-chrome").evaluate((strip) => strip.contains(document.activeElement))).toBe(false);
        });
      }
    }

    test(`${variant} body matches a plain page and grows with content in ${scheme}`, async ({ page }) => {
      const body = "\n  text.title Content\n  row\n    input label=Name Hint\n    select label=Role Editor\n  divider\n  row\n    card\n      text.title Card\n      text Description\n      row\n        button Save\n  row.scroll\n    card width=400\n      text First\n    card width=400\n      text Second";
      await show(page, `page width=480${body}\npage.${variant} width=480 Label${body}`, { scheme, host: "column" });
      const geometry = await page.evaluate(() => {
        const [plain, decorated] = [...document.querySelectorAll<HTMLElement>(".wf-page")];
        const content = decorated!.querySelector<HTMLElement>(".wf-page-content")!;
        const measure = (body: HTMLElement) => {
          const box = body.getBoundingClientRect();
          return [...body.children].map((child) => {
            const rect = child.getBoundingClientRect();
            return { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height };
          });
        };
        const border = Number.parseFloat(getComputedStyle(plain!).borderLeftWidth);
        return {
          plain: measure(plain!).map((rect) => ({ ...rect, x: rect.x - border, y: rect.y - border })),
          decorated: measure(content),
          plainHeight: plain!.getBoundingClientRect().height,
          decoratedHeight: decorated!.getBoundingClientRect().height,
          stripHeight: decorated!.querySelector(".wf-page-chrome")!.getBoundingClientRect().height,
          scrollRows: [...document.querySelectorAll<HTMLElement>(".wf-row.wf-scroll")].map((row) => row.scrollWidth > row.clientWidth),
        };
      });
      expect(geometry.decorated).toEqual(geometry.plain);
      expect(geometry.decoratedHeight).toBeCloseTo(geometry.plainHeight + geometry.stripHeight, 1);
      expect(geometry.scrollRows).toEqual([true, true]);
    });
  }

  test(`window traffic lights and chrome use host properties in ${scheme}`, async ({ page }) => {
    await show(page, "page.window Settings\n  text Body", { scheme, host: "column" });
    await page.locator(".column").evaluate((host) => {
      for (const [name, value] of Object.entries({
        danger: "rgb(10, 20, 30)", warning: "rgb(40, 50, 60)", success: "rgb(70, 80, 90)",
        "neutral-tint": "rgb(100, 110, 120)", line: "rgb(130, 140, 150)", ink: "rgb(160, 170, 180)", stroke: "2px",
      })) host.style.setProperty(`--wf-${name}`, value);
    });
    const styles = await page.evaluate(() => {
      const strip = getComputedStyle(document.querySelector(".wf-page-chrome")!);
      const lights = [...document.querySelectorAll(".wf-window-light")].map((light) => {
        const css = getComputedStyle(light);
        const box = light.getBoundingClientRect();
        return { fill: css.backgroundColor, radius: css.borderRadius, circle: box.width === box.height };
      });
      return { lights, fill: strip.backgroundColor, border: strip.borderBottomColor, stroke: strip.borderBottomWidth, title: getComputedStyle(document.querySelector(".wf-window-title")!).color };
    });
    expect(styles).toEqual({
      lights: ["rgb(10, 20, 30)", "rgb(40, 50, 60)", "rgb(70, 80, 90)"].map((fill) => ({ fill, radius: "50%", circle: true })),
      fill: "rgb(100, 110, 120)", border: "rgb(130, 140, 150)", stroke: "2px", title: "rgb(160, 170, 180)",
    });
  });
}
