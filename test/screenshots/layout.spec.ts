import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { archivedBanner, cardBlock, deleteConfirmation, documentList, figmaPrivate, figmaReading, PROPERTIES, vocabulary } from "../samples.js";
import { open, show } from "./page.js";

// Layout and theming in a real browser. These compare renders within one run,
// so unlike the goldens they hold on any system.

test.beforeEach(async ({ page }) => {
  await open(page);
});

interface Fit {
  /** The root's width, and its content's: equal when nothing scrolls. */
  root: { width: number; scrollWidth: number };
  /** The column's width and its content's: the wireframe never widens it. */
  column: { width: number; scrollWidth: number };
  /** Elements that stick out of the box they are drawn in, by class. */
  escaped: string[];
}

/** How the rendered wireframe fits its column. */
function measure(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".wf-root")!;
    const column = root.closest<HTMLElement>(".column")!;
    const inside = (inner: Element, outer: Element): boolean => {
      const a = inner.getBoundingClientRect();
      const b = outer.getBoundingClientRect();
      return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
    };
    // Every drawn box holds its children, except the root, which scrolls.
    const escaped = [...root.querySelectorAll(":scope * > *")]
      .filter((element) => element.parentElement !== root && !inside(element, element.parentElement!))
      .map((element) => element.getAttribute("class") ?? element.localName);
    return {
      root: { width: root.getBoundingClientRect().width, scrollWidth: root.scrollWidth },
      column: { width: column.getBoundingClientRect().width, scrollWidth: column.scrollWidth },
      escaped,
    };
  });
}

/** How many lines `selector`'s text takes. */
function lines(page: Page, selector: string): Promise<number> {
  return page.evaluate((selector) => {
    // Count text lines, not the control boxes and SVGs around them: a bordered
    // select is taller than its text, while its chevron is shorter.
    const walker = document.createTreeWalker(document.querySelector(selector)!, NodeFilter.SHOW_TEXT);
    const tops = new Set<number>();
    while (walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
    }
    return tops.size;
  }, selector);
}

test.describe("fit", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const host of ["column", "standalone"] as const) {
      test(`the Card block fits at full size in ${scheme} on a ${host} host`, async ({ page }) => {
        await show(page, cardBlock, { host, scheme });
        const geometry = await page.evaluate(() => {
          const root = document.querySelector<HTMLElement>(".wf-root")!;
          const card = document.querySelector(".wf-card")!;
          const style = getComputedStyle(root);
          return {
            width: root.clientWidth, scrollWidth: root.scrollWidth,
            cardWidth: card.getBoundingClientRect().width,
            padding: Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight),
            fontSize: style.fontSize, shadow: getComputedStyle(card).boxShadow,
            pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
          };
        });
        expect(geometry.scrollWidth).toBe(geometry.width);
        expect(geometry.cardWidth).toBe(geometry.width - geometry.padding);
        expect(geometry.fontSize).toBe("14px");
        expect(geometry.shadow).toBe("none");
        expect(geometry.pageScrollWidth).toBe(geometry.pageWidth);
        expect(await lines(page, ".wf-card > .wf-title")).toBe(1);
        if (host === "column") expect(await measure(page)).toEqual({
          root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
        });
      });
    }

    for (const layout of ["block", "flex", "grid"] as const) {
      test(`long titles and footers wrap and cards stack in a ${scheme} ${layout} column`, async ({ page }) => {
        await show(page, `card\n  text.title ${"A long card title wraps between words. ".repeat(12)}\n  text.small.muted ${"A LONG FOOTER WRAPS WITHIN THE CARD. ".repeat(18)}\ncard\n  text.title Title only`, { host: "column", scheme, layout });
        expect(await measure(page)).toEqual({
          root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
        });
        expect(await lines(page, ".wf-card > .wf-title")).toBeGreaterThan(1);
        expect(await lines(page, ".wf-card > .wf-small")).toBeGreaterThan(1);
        const boxes = await page.locator(".wf-card").evaluateAll((cards) => cards.map((card) => {
          const { left, width, top, bottom } = card.getBoundingClientRect();
          return { left, width, top, bottom };
        }));
        expect(boxes[0]!.width).toBe(boxes[1]!.width);
        expect(boxes[0]!.left).toBe(boxes[1]!.left);
        expect(boxes[1]!.top - boxes[0]!.bottom).toBeCloseTo(10.5, 1);
      });
    }

    test(`card titles use the dialog size and small changes only size in ${scheme}`, async ({ page }) => {
      await show(page, 'dialog Dialog title\n  text.title Outside card\npage\n  text.title Page title\n  row\n    chip Caption\ncard\n  text Label\n  text.title Card title\n  text.small Small mixed case\n  text.small.muted Small muted\n  text.small.strong Small bold\n  text.small.title Small title\n  row\n    text.title Indirect title', { scheme });
      const style = async (selector: string) => page.locator(selector).evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          size: Number.parseFloat(css.fontSize), weight: css.fontWeight, colour: css.color,
          transform: css.textTransform, lineHeight: Number.parseFloat(css.lineHeight),
        };
      });
      const dialog = await style(".wf-dialog-title");
      const pageTitle = await style(".wf-page > .wf-title");
      const title = await style(".wf-card > .wf-title:not(.wf-small)");
      const body = await style(".wf-card > .wf-text:not(.wf-title, .wf-small)");
      const small = await style(".wf-card > .wf-small:not(.wf-muted, .wf-strong, .wf-title)");
      expect(title).toEqual(dialog);
      expect(title.size).toBeGreaterThan(body.size);
      expect(title.size).toBeLessThan(pageTitle.size);
      expect(await style(".wf-dialog-card > .wf-title")).toEqual(pageTitle);
      expect(await style(".wf-card > .wf-row > .wf-title")).toEqual(pageTitle);
      expect(small.size).toBeCloseTo(body.size * 0.85, 2);
      expect(small.size).toBe((await style(".wf-chip")).size);
      expect({ ...small, size: body.size, lineHeight: body.lineHeight }).toEqual(body);
      expect(small.transform).toBe("none");
      expect((await style(".wf-card > .wf-small.wf-muted")).colour).not.toBe(body.colour);
      expect((await style(".wf-card > .wf-small.wf-strong")).weight).toBe("600");
      expect((await style(".wf-card > .wf-small.wf-title")).size).toBe(small.size);
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    for (const [name, source] of [["reading", figmaReading], ["private", figmaPrivate]]) {
      for (const host of ["column", "standalone"] as const) {
        test(`the Figma ${name} frame fits at full size in ${scheme} on a ${host} host`, async ({ page }) => {
          await show(page, source!, { host, scheme });
          const geometry = await page.evaluate(() => {
            const root = document.querySelector<HTMLElement>(".wf-root")!;
            const frame = document.querySelector(".wf-frame")!.getBoundingClientRect();
            const rootStyle = getComputedStyle(root);
            const caption = document.querySelector(".wf-frame-caption")!.getBoundingClientRect();
            const label = document.querySelector(".wf-frame-label")!.getBoundingClientRect();
            const actions = document.querySelector(".wf-frame-actions")!.getBoundingClientRect();
            return {
              width: root.clientWidth, scrollWidth: root.scrollWidth,
              frameWidth: frame.width,
              padding: Number.parseFloat(rootStyle.paddingLeft) + Number.parseFloat(rootStyle.paddingRight),
              labelLeft: label.left, actionsLeft: actions.left, actionsRight: actions.right, captionRight: caption.right,
              fontSize: rootStyle.fontSize,
              pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
            };
          });
          expect(geometry.scrollWidth).toBe(geometry.width);
          expect(geometry.frameWidth).toBeCloseTo(geometry.width - geometry.padding, 1);
          expect(geometry.actionsLeft).toBeGreaterThan(geometry.labelLeft);
          expect(geometry.actionsRight).toBeCloseTo(geometry.captionRight, 1);
          expect(geometry.fontSize).toBe("14px");
          expect(geometry.pageScrollWidth).toBe(geometry.pageWidth);
          if (host === "column") expect((await measure(page)).escaped).toEqual([]);
        });
      }
    }
  }

  for (const layout of ["block", "flex", "grid"] as const) {
    test(`long frame labels, many actions and long action captions wrap in a ${layout} column`, async ({ page }) => {
      const source = `frame ${"Long caption ".repeat(20)}\n${"  button.link Open in Figma\n".repeat(18)}  button.link ${"x".repeat(300)}\n  card\n    text ${"A long paragraph wraps between words. ".repeat(20)}`;
      await show(page, source, { host: "column", layout });
      expect(await measure(page)).toEqual({ root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [] });
      expect(await lines(page, ".wf-frame-label")).toBeGreaterThan(1);
      expect(await lines(page, ".wf-frame-actions > .wf-button:last-child")).toBeGreaterThan(1);
      expect(await lines(page, ".wf-card > .wf-text")).toBeGreaterThan(1);
      const tops = await page.locator(".wf-frame-actions > .wf-button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
      expect(new Set(tops).size).toBeGreaterThan(1);
    });

    test(`a frame's wide body table scrolls inside the wireframe in a ${layout} column`, async ({ page }) => {
      await show(page, `frame Report\n  button.link Copy\n  table\n    row\n${"      cell Column\n".repeat(25)}`, { host: "column", layout });
      const { root, column, escaped } = await measure(page);
      expect(root.width).toBe(710);
      expect(root.scrollWidth).toBeGreaterThan(710);
      expect(column).toEqual({ width: 710, scrollWidth: 710 });
      expect(escaped).toEqual([]);
    });
  }

  for (const layout of ["block", "flex", "grid"] as const) {
    test(`labelled fields share columns and align below wrapped labels in a ${layout} host`, async ({ page }) => {
      await show(page, 'page\n  input label="Email address" name@company.com\n  select label=Role Editor\n  row\n    input label="Email address for invitations and workspace notifications" name@company.com\n    select label=Role Editor\n  row\n    select label=Team Engineering\n    select label=Region Europe', { host: "column", layout });
      expect(await measure(page)).toEqual({
        root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
      });
      const fields = await page.locator(".wf-field").evaluateAll((fields) => fields.map((field) => {
        const box = field.getBoundingClientRect();
        const label = field.querySelector(".wf-field-label")!.getBoundingClientRect();
        const control = field.querySelector(".wf-input, .wf-select")!.getBoundingClientRect();
        const caret = field.querySelector(".wf-select-caret")?.getBoundingClientRect();
        return {
          x: box.x, width: box.width, labelTop: label.top, labelBottom: label.bottom,
          controlTop: control.top, controlWidth: control.width, controlRight: control.right,
          caretRight: caret?.right,
        };
      }));
      expect(fields[0]!.width).toBe(fields[1]!.width);
      for (const [left, right] of [[fields[2]!, fields[3]!], [fields[4]!, fields[5]!]] as const) {
        expect(left.width).toBeCloseTo(right.width, 1);
        expect(left.labelTop).toBe(right.labelTop);
        expect(left.controlTop).toBe(right.controlTop);
        expect(left.controlWidth).toBe(left.width);
        expect(right.controlWidth).toBe(right.width);
      }
      for (const field of fields) {
        expect(field.labelBottom).toBeLessThan(field.controlTop);
        if (field.caretRight !== undefined) expect(field.controlRight - field.caretRight).toBeLessThan(11);
      }
      expect(fields[2]!.x).toBe(fields[4]!.x);
      expect(fields[3]!.x).toBe(fields[5]!.x);
      expect(await lines(page, ".wf-row .wf-field-label")).toBeGreaterThan(1);
    });

    test(`a long field label never changes its column width in a ${layout} host`, async ({ page }) => {
      const widths = async (label: string) => {
        await show(page, `page\n  row\n    input label="${label}" Hint\n    select label=Role Editor`, { host: "column", layout });
        expect(await measure(page)).toEqual({
          root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
        });
        return page.locator(".wf-field").evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().width));
      };
      const short = await widths("Email");
      expect(await widths("Email address for invitations and workspace notifications ".repeat(8))).toEqual(short);
      expect(await widths("x".repeat(300))).toEqual(short);
    });

    test(`a labelled select's value stays inside its column beside another field in a ${layout} host`, async ({ page }) => {
      await show(page, 'page\n  row\n    select label=Team "Engineering, Product and Design leadership group"\n    input label=Name Hint', { host: "column", layout });
      expect(await measure(page)).toEqual({
        root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
      });
      expect(await lines(page, ".wf-select")).toBe(1);
      const select = await page.locator(".wf-select").boundingBox();
      const nextField = await page.locator(".wf-field").nth(1).boundingBox();
      expect(select!.x + select!.width).toBeLessThan(nextField!.x);
    });
  }

  for (const [name, source] of [
    ["delete confirmation", deleteConfirmation],
    ["archived banner", archivedBanner],
  ]) {
    for (const width of [710, 320]) {
      test(`the ${name} fits a ${width} px column without scrolling`, async ({ page }) => {
        await show(page, source!, { host: "column", width });
        expect(await measure(page)).toEqual({
          root: { width, scrollWidth: width },
          column: { width, scrollWidth: width },
          escaped: [],
        });
      });
    }
  }

  test("the banner is one line at 710 px: icon, text, then the buttons on the right", async ({ page }) => {
    await show(page, archivedBanner, { host: "column" });
    expect(await lines(page, ".wf-banner > .wf-text")).toBe(1);
    const boxes = await page.evaluate(() =>
      [...document.querySelector(".wf-banner")!.children].map((child) => {
        const { left, right, top, bottom } = child.getBoundingClientRect();
        return { left, right, top, bottom };
      }),
    );
    // The icon, the text and the row share a line, in that order.
    expect(Math.max(...boxes.map((box) => box.top))).toBeLessThan(Math.min(...boxes.map((box) => box.bottom)));
    expect(boxes.map((box) => box.left)).toEqual([...boxes.map((box) => box.left)].sort((a, b) => a - b));
    const banner = await page.locator(".wf-banner").boundingBox();
    expect(banner!.x + banner!.width - boxes.at(-1)!.right).toBeLessThan(16);
  });

  test("the document list fits a 710 px column at full size", async ({ page }) => {
    await show(page, documentList, { host: "column" });
    expect(await measure(page)).toEqual({
      root: { width: 710, scrollWidth: 710 },
      column: { width: 710, scrollWidth: 710 },
      escaped: [],
    });
    // Nothing wraps: the title, the count, the filter row, the field and every cell are one line each.
    for (const selector of [".wf-title", ".wf-page > .wf-muted", ".wf-page > .wf-row", ".wf-input"]) {
      expect(await lines(page, selector), selector).toBe(1);
    }
    // A cell's content is on one line when all its boxes overlap vertically; an empty cell has none.
    const cells = await page.evaluate(() =>
      [...document.querySelectorAll(".wf-cell")].map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const rects = [...range.getClientRects()].filter((rect) => rect.height > 0);
        if (rects.length === 0) return 0;
        return Math.max(...rects.map((rect) => rect.top)) < Math.min(...rects.map((rect) => rect.bottom)) ? 1 : 2;
      }),
    );
    expect(cells).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1]);
  });

  test("the document list's table has rules under the header and between rows, and no other lines", async ({ page }) => {
    await show(page, documentList, { host: "column" });
    const borders = await page.evaluate(() => {
      const width = (element: Element, side: string): number =>
        Number.parseFloat(getComputedStyle(element).getPropertyValue(`border-${side}-width`));
      const table = document.querySelector(".wf-table")!;
      const rows = [...table.children];
      return {
        table: ["top", "right", "bottom", "left"].map((side) => width(table, side)),
        rows: rows.map((row) => ["top", "right", "bottom", "left"].map((side) => width(row, side))),
        // The top border of each row's cells, and whether any cell has a side or bottom border.
        cells: rows.map((row) => [...row.children].map((cell) => width(cell, "top"))),
        sides: [...table.querySelectorAll(".wf-cell")].some((cell) =>
          ["right", "bottom", "left"].some((side) => width(cell, side) > 0),
        ),
      };
    });
    expect(borders).toEqual({
      table: [0, 0, 0, 0],
      rows: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      cells: [
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
      sides: false,
    });
  });

  test("the document list's columns line up, Changed on the right in tabular figures", async ({ page }) => {
    await show(page, documentList, { host: "column" });
    const columns = await page.evaluate(() =>
      [...document.querySelectorAll(".wf-table > .wf-row")].map((row) =>
        [...row.children].map((cell) => {
          const { left, right } = cell.getBoundingClientRect();
          return { left: Math.round(left), right: Math.round(right) };
        }),
      ),
    );
    expect(columns[1]).toEqual(columns[0]);
    expect(columns[2]).toEqual(columns[0]);
    const changed = await page.evaluate(() =>
      [...document.querySelectorAll(".wf-cell.wf-end")].map((cell) => {
        const style = getComputedStyle(cell);
        const range = document.createRange();
        range.selectNodeContents(cell);
        // The space between the text's right edge and the cell's padding box.
        const gap = cell.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) - range.getBoundingClientRect().right;
        return { textAlign: style.textAlign, numeric: style.fontVariantNumeric, gap: Math.round(gap) };
      }),
    );
    expect(changed).toEqual(Array(3).fill({ textAlign: "end", numeric: "tabular-nums", gap: 0 }));
  });

  test("an empty input is as tall as one with a placeholder, and an input in a row takes the room left", async ({ page }) => {
    await show(page, "page\n  input Search titles\n  input\n  row\n    input Search\n    button Go", { host: "column" });
    const [full, empty, inRow] = await Promise.all(
      [0, 1, 2].map((index) => page.locator(".wf-input").nth(index).boundingBox()),
    );
    expect(empty!.height).toBe(full!.height);
    expect(empty!.width).toBe(full!.width);
    const button = await page.locator(".wf-button").boundingBox();
    // The row's input and button fill the page's width between them.
    expect(Math.round(button!.x + button!.width - inRow!.x)).toBe(Math.round(full!.width));
  });

  for (const container of ["root", "page", "dialog"] as const) {
    test(`a select stretches like an input in a ${container}, with its chevron at the far end`, async ({ page }) => {
      const fields = "input Search\nselect Any tag\nselect";
      const source = container === "root" ? fields : `${container}\n${fields.split("\n").map((line) => `  ${line}`).join("\n")}`;
      await show(page, source, { host: "column" });
      const input = await page.locator(".wf-input").boundingBox();
      for (const select of await page.locator(".wf-select").all()) {
        const box = await select.boundingBox();
        expect(box).toMatchObject({ x: input!.x, width: input!.width, height: input!.height });
        const gap = await select.evaluate((element) => {
          const style = getComputedStyle(element);
          const chevron = element.querySelector("svg")!.getBoundingClientRect();
          return element.getBoundingClientRect().right - chevron.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth);
        });
        expect(gap).toBeCloseTo(0, 1);
      }
      expect((await measure(page)).escaped).toEqual([]);
    });
  }

  test("a row's select keeps its content width while the input fills the space, at the same height", async ({ page }) => {
    await show(page, "page\n  input Search\n  row\n    input Search\n    select Any tag\n    select Any tag", { host: "column" });
    const [full, input, first, second, row] = await Promise.all(
      [".wf-page > .wf-input", ".wf-row > .wf-input", ".wf-select:first-of-type", ".wf-select:last-of-type", ".wf-row"].map((selector) => page.locator(selector).boundingBox()),
    );
    expect(first!.height).toBe(input!.height);
    expect(second!.height).toBe(input!.height);
    expect(first!.width).toBe(second!.width);
    expect(first!.width).toBeLessThan(input!.width);
    expect(row!.width).toBe(full!.width);
    expect(second!.x + second!.width).toBeCloseTo(full!.x + full!.width, 1);
  });

  test("a toggle's options and a select share one line, the chevron after the value", async ({ page }) => {
    await show(page, documentList, { host: "column" });
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll(".wf-option, .wf-select, .wf-select-caret")].map((element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left, right, top, bottom };
      }),
    );
    expect(Math.max(...boxes.map((box) => box.top))).toBeLessThan(Math.min(...boxes.map((box) => box.bottom)));
    const [, , select, caret] = boxes;
    expect(caret!.left).toBeGreaterThan(select!.left);
    expect(caret!.right).toBeLessThanOrEqual(select!.right);
    const separator = await page.evaluate(
      () => getComputedStyle(document.querySelectorAll(".wf-option")[1]!, "::before").content,
    );
    expect(separator).toBe('"·"');
  });

  const wide = {
    "a row of many buttons": `dialog Pick one\n  row.end\n${"    button Option\n".repeat(25)}`,
    "a long word in a dialog": `dialog Title\n  text ${"x".repeat(300)}`,
    "a long word in a banner": `banner\n  text ${"x".repeat(300)}\n  row.end\n    button Restore`,
    "a long button caption": `banner\n  row\n    button ${"x".repeat(300)}`,
    "a row of buttons at the top level": `row\n${"  button Option\n".repeat(25)}`,
    "a table of many columns": `page\n  table\n    row\n${"      cell Column\n".repeat(25)}`,
    "a long word in a table cell": `page\n  table\n    row\n      cell ${"x".repeat(300)}\n      cell.end 2 hours ago`,
    "a long word in a page's title": `page\n  text.title ${"x".repeat(100)}`,
    "a long word in an input": `page\n  row\n    input ${"x".repeat(300)}\n    select Any tag`,
    "a long select value at the top level": `select ${"Long chosen value ".repeat(30)}`,
    "a long select value in a page": `page\n  select ${"Long chosen value ".repeat(30)}`,
    "a long select value in a dialog": `dialog Pick one\n  select ${"Long chosen value ".repeat(30)}`,
    "a long select value in a row": `page\n  row\n    input Search\n    select ${"Long chosen value ".repeat(30)}`,
    "a long select value in a labelled field at the top level": `select label=Team ${"Long chosen value ".repeat(30)}`,
    "a long select value in a labelled field in a page": `page\n  select label=Team ${"Long chosen value ".repeat(30)}`,
    "a long select value in a labelled field in a dialog": `dialog Pick one\n  select label=Team ${"Long chosen value ".repeat(30)}`,
    "a long select value in a labelled field in a row": `page\n  row\n    select label=Team ${"Long chosen value ".repeat(30)}\n    input label=Name Hint`,
    "a row of many chips": `page\n  row\n${"    chip release\n".repeat(25)}`,
  };
  for (const [name, source] of Object.entries(wide)) {
    for (const layout of ["block", "flex", "grid"] as const) {
      test(`${name} scrolls inside the wireframe, never the page, in a ${layout} column`, async ({ page }) => {
        await show(page, source, { host: "column", layout });
        const { root, column, escaped } = await measure(page);
        expect(root.width).toBe(710);
        expect(root.scrollWidth).toBeGreaterThan(710);
        expect(column).toEqual({ width: 710, scrollWidth: 710 });
        expect(escaped).toEqual([]);
        if (name.startsWith("a long select value")) {
          const lineCount = await page.locator(".wf-select").evaluate((select) => {
            const range = document.createRange();
            range.selectNode(select.firstChild!);
            return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
          });
          expect(lineCount).toBe(1);
        }
      });
    }
  }

  test("in a host that shrinks to fit, a wireframe takes the width it needs, up to the column", async ({ page }) => {
    const fitContent = async (source: string): Promise<Fit> => {
      await show(page, source, { host: "column" });
      await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>(".wf-root")!;
        const item = document.createElement("div");
        item.style.width = "fit-content";
        root.replaceWith(item);
        item.append(root);
      });
      return measure(page);
    };
    const banner = await fitContent(archivedBanner);
    expect(banner.root.width).toBeGreaterThan(400);
    expect(banner.root.width).toBeLessThan(710);
    expect(banner.root.scrollWidth).toBeLessThanOrEqual(Math.ceil(banner.root.width));
    const row = await fitContent(wide["a row of many buttons"]);
    expect(row.root.width).toBe(710);
    expect(row.column).toEqual({ width: 710, scrollWidth: 710 });
  });

  test("a focus ring at the wireframe's edge isn't cut off", async ({ page }) => {
    await show(page, "row\n  button.focus Go", { host: "column" });
    const room = await page.evaluate(() => {
      const button = document.querySelector(".wf-button")!;
      const root = document.querySelector(".wf-root")!.getBoundingClientRect();
      const { outlineWidth, outlineOffset } = getComputedStyle(button);
      const ring = Number.parseFloat(outlineWidth) + Number.parseFloat(outlineOffset);
      const box = button.getBoundingClientRect();
      return { left: box.left - ring - root.left, top: box.top - ring - root.top, bottom: root.bottom - box.bottom - ring };
    });
    expect(room).toEqual({ left: 0, top: 0, bottom: 0 });
  });

  test("an empty wireframe takes no space", async ({ page }) => {
    await show(page, "", { host: "column" });
    expect(await page.locator(".wf-root").boundingBox()).toMatchObject({ width: 710, height: 0 });
  });

  test("the dialog's scrim stays inside the wireframe's box", async ({ page }) => {
    await show(page, `text Before\n${deleteConfirmation}\ntext After`, { host: "column" });
    const position = await page.evaluate(() => getComputedStyle(document.querySelector(".wf-dialog")!).position);
    expect(position).toBe("static");
    expect((await measure(page)).escaped).toEqual([]);
    const [before, scrim, after] = await Promise.all(
      [".wf-root > .wf-text:first-child", ".wf-dialog", ".wf-root > .wf-text:last-child"].map((selector) =>
        page.locator(selector).boundingBox(),
      ),
    );
    expect(before!.y + before!.height).toBeLessThanOrEqual(scrim!.y);
    expect(scrim!.y + scrim!.height).toBeLessThanOrEqual(after!.y);
  });
});

test.describe("theming", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`success banners use a green tone and tint, with host overrides in ${scheme}`, async ({ page }) => {
      const host = await show(page, "banner.success\n  icon archive\n  text Restored", { scheme });
      const appearance = () => page.evaluate(() => {
        const banner = getComputedStyle(document.querySelector(".wf-banner")!);
        return {
          icon: getComputedStyle(document.querySelector(".wf-icon")!).color,
          tint: banner.backgroundColor, border: banner.borderTopColor,
          text: getComputedStyle(document.querySelector(".wf-text")!).color,
          ink: getComputedStyle(document.querySelector(".wf-root")!).color,
        };
      });
      const defaults = await appearance();
      expect(defaults.icon).toBe(scheme === "light" ? "oklch(0.55 0.15 150)" : "oklch(0.75 0.14 150)");
      expect(defaults.tint).toBe(scheme === "light" ? "oklch(0.965 0.025 150)" : "oklch(0.24 0.035 150)");
      expect(defaults.text).toBe(defaults.ink);
      await host.evaluate((element) => element.style.setProperty("--wf-success", "rgb(10, 20, 30)"));
      const toned = await appearance();
      expect(toned.icon).toBe("rgb(10, 20, 30)");
      expect(toned.border).not.toBe(defaults.border);
      expect(toned.tint).toBe(defaults.tint);
      await host.evaluate((element) => element.style.setProperty("--wf-success-tint", "rgb(40, 50, 60)"));
      expect(await appearance()).toEqual({ ...toned, tint: "rgb(40, 50, 60)" });
    });

    test(`the long banner example wraps without widening a ${scheme} document column`, async ({ page }) => {
      const source = readFileSync(new URL("../../examples/badges-and-banners/2-banners/wrapping-text.wireframe", import.meta.url), "utf8");
      await show(page, source, { scheme, host: "column" });
      expect(await lines(page, ".wf-banner > .wf-text")).toBeGreaterThan(1);
      expect(await measure(page)).toEqual({
        root: { width: 710, scrollWidth: 710 }, column: { width: 710, scrollWidth: 710 }, escaped: [],
      });
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`frame and card use neutral host tokens and the base geometry in ${scheme}`, async ({ page }) => {
      const host = await show(page, figmaReading, { scheme });
      const appearance = () => page.evaluate(() => {
        const frame = getComputedStyle(document.querySelector(".wf-frame")!);
        const card = getComputedStyle(document.querySelector(".wf-card")!);
        const label = getComputedStyle(document.querySelector(".wf-frame-label")!);
        const muted = getComputedStyle(document.querySelector(".wf-text.wf-muted")!);
        const button = getComputedStyle(document.querySelector(".wf-button")!);
        return {
          barWidth: frame.borderLeftWidth, barColour: frame.borderLeftColor,
          otherBorders: [frame.borderTopWidth, frame.borderRightWidth, frame.borderBottomWidth],
          corners: [frame.borderTopLeftRadius, frame.borderBottomLeftRadius, frame.borderTopRightRadius, frame.borderBottomRightRadius],
          tint: frame.backgroundColor, labelColour: label.color, muted: muted.color, labelWeight: label.fontWeight,
          cardBorder: card.border, cardRadius: card.borderRadius, cardFill: card.backgroundColor,
          cardShadow: card.boxShadow, frameShadow: frame.boxShadow, paper: button.backgroundColor,
        };
      });
      const defaults = await appearance();
      expect(defaults.barWidth).toBe("3px");
      expect(defaults.barColour).toBe(defaults.muted);
      expect(defaults.labelColour).toBe(defaults.muted);
      expect(defaults.labelWeight).toBe("500");
      expect(defaults.otherBorders).toEqual(["0px", "0px", "0px"]);
      expect(defaults.corners).toEqual(["0px", "0px", "6px", "6px"]);
      expect(defaults.cardBorder).toMatch(/^1px solid /);
      expect(defaults.cardRadius).toBe("6px");
      expect([defaults.cardShadow, defaults.frameShadow]).toEqual(["none", "none"]);
      expect(defaults.cardFill).not.toBe(defaults.tint);
      await host.evaluate((element) => {
        element.style.setProperty("--wf-muted", "rgb(10, 20, 30)");
        element.style.setProperty("--wf-neutral-tint", "rgb(40, 50, 60)");
        element.style.setProperty("--wf-paper", "rgb(70, 80, 90)");
        element.style.setProperty("--wf-line", "rgb(100, 110, 120)");
        element.style.setProperty("--wf-radius", "11px");
        element.style.setProperty("--wf-stroke", "2px");
      });
      const changed = await appearance();
      expect(changed).toMatchObject({
        barWidth: "6px", barColour: "rgb(10, 20, 30)", labelColour: "rgb(10, 20, 30)",
        tint: "rgb(40, 50, 60)", cardFill: "rgb(70, 80, 90)",
        cardBorder: "2px solid rgb(100, 110, 120)", cardRadius: "11px",
        corners: ["0px", "0px", "11px", "11px"],
      });
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`field labels use ink above muted hints in ${scheme}`, async ({ page }) => {
      const host = await show(page, 'page\n  input label="Email address" name@company.com\n  select label=Role Editor', { scheme });
      const colours = () => page.evaluate(() => [".wf-root", ".wf-field-label", ".wf-input", ".wf-select"]
        .map((selector) => getComputedStyle(document.querySelector(selector)!).color));
      const [ink, label, hint, value] = await colours();
      expect(label).toBe(ink);
      expect(value).toBe(ink);
      expect(hint).not.toBe(ink);
      await host.evaluate((element) => element.style.setProperty("--wf-ink", "rgb(10, 20, 30)"));
      const changed = await colours();
      expect(changed[1]).toBe("rgb(10, 20, 30)");
      expect(changed[2]).toBe(hint);
    });

    test(`select shares input geometry and icon strokes in ${scheme}, including host overrides`, async ({ page }) => {
      const host = await show(page, "page\n  row\n    input Search\n    select Any tag\n  icon archive", { scheme });
      const appearance = () => page.evaluate(() => {
        const field = (selector: string) => {
          const element = document.querySelector(selector)!;
          const style = getComputedStyle(element);
          return {
            height: element.getBoundingClientRect().height,
            border: style.border,
            radius: style.borderRadius,
            padding: style.padding,
            fill: style.backgroundColor,
          };
        };
        const input = getComputedStyle(document.querySelector(".wf-input")!);
        const select = getComputedStyle(document.querySelector(".wf-select")!);
        const chevron = getComputedStyle(document.querySelector(".wf-select-caret")!);
        const icon = getComputedStyle(document.querySelector(".wf-icon-glyph")!);
        return {
          input: field(".wf-input"), select: field(".wf-select"),
          ink: getComputedStyle(document.querySelector(".wf-root")!).color,
          value: select.color, muted: input.color, chevron: chevron.color,
          fill: chevron.fill, stroke: chevron.stroke, strokeWidth: chevron.strokeWidth,
          iconStrokeWidth: icon.strokeWidth, cap: chevron.strokeLinecap, join: chevron.strokeLinejoin,
        };
      });
      const check = async () => {
        const styles = await appearance();
        expect(styles.select).toEqual(styles.input);
        expect(styles.select.fill).toBe("rgba(0, 0, 0, 0)");
        expect(styles.value).toBe(styles.ink);
        expect(styles.chevron).toBe(styles.muted);
        expect(styles.chevron).not.toBe(styles.value);
        expect(styles.fill).toBe("none");
        expect(styles.stroke).toBe(styles.chevron);
        expect(styles.strokeWidth).toBe(styles.iconStrokeWidth);
        expect([styles.cap, styles.join]).toEqual(["round", "round"]);
        return styles;
      };
      const defaults = await check();
      expect(defaults.select.radius).toBe("6px");
      expect(defaults.strokeWidth).toBe("1.5px");
      await host.evaluate((element) => {
        element.style.setProperty("--wf-line", "rgb(10, 20, 30)");
        element.style.setProperty("--wf-radius", "11px");
        element.style.setProperty("--wf-stroke", "3px");
        element.style.setProperty("--wf-muted", "rgb(40, 50, 60)");
      });
      const overridden = await check();
      expect(overridden.select.border).toBe("3px solid rgb(10, 20, 30)");
      expect(overridden.select.radius).toBe("11px");
      expect(overridden.strokeWidth).toBe("4.5px");
      expect(overridden.chevron).toBe("rgb(40, 50, 60)");
    });
  }

  /** The dialog title's colour and the card's fill. */
  const colours = (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      [
        getComputedStyle(document.querySelector(".wf-dialog-title")!).color,
        getComputedStyle(document.querySelector(".wf-dialog-card")!).backgroundColor,
      ].map(String),
    );

  test("follows the page's colour scheme, and a host can force one without re-rendering", async ({ page }) => {
    await show(page, deleteConfirmation, { scheme: "light" });
    const light = await colours(page);
    await page.evaluate(() => {
      document.documentElement.style.colorScheme = "dark";
    });
    const dark = await colours(page);
    expect(dark).not.toEqual(light);

    // Forced on an ancestor, against the page.
    await page.evaluate(() => {
      document.getElementById("host")!.style.colorScheme = "light";
    });
    expect(await colours(page)).toEqual(light);

    // A page that offers both follows the system.
    await page.evaluate(() => {
      document.getElementById("host")!.style.colorScheme = "";
      document.documentElement.style.colorScheme = "light dark";
    });
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await colours(page)).toEqual(dark);
    await page.emulateMedia({ colorScheme: "light" });
    expect(await colours(page)).toEqual(light);
  });

  const values: Record<string, string> = {
    "--wf-shadow": "0 0 0 6px rgb(0, 160, 0)",
    "--wf-stroke": "4px",
    "--wf-focus-width": "6px",
    "--wf-radius": "0px",
    "--wf-radius-lg": "0px",
    "--wf-text-size": "20px",
    "--wf-title-size": "30px",
  };

  test("each public property restyles the wireframe from an ancestor", async ({ page }) => {
    const host = await show(page, vocabulary);
    const root = page.locator(".wf-root");
    const before = await root.screenshot();
    const unchanged: string[] = [];
    for (const property of PROPERTIES) {
      // Colours get a green nothing draws by default.
      const value = values[property] ?? "rgb(0, 160, 0)";
      await host.evaluate((element, [property, value]) => element.style.setProperty(property!, value!), [property, value]);
      if ((await root.screenshot()).equals(before)) unchanged.push(property);
      await host.evaluate((element, property) => element.style.removeProperty(property), property);
    }
    expect(unchanged).toEqual([]);
    expect((await root.screenshot()).equals(before)).toBe(true);
  });

  for (const [name, source, width] of [
    ["every kind and variant", vocabulary, 710],
    ["the delete confirmation in a narrow column", deleteConfirmation, 320],
  ] as const) {
    test(`text styles a host passes down change nothing: ${name}`, async ({ page }) => {
      await show(page, source, { host: "column", width });
      const root = page.locator(".wf-root");
      const before = await root.screenshot();
      await root.evaluate((element) => {
        Object.assign(element.parentElement!.style, {
          color: "red",
          fontSize: "30px",
          fontStyle: "italic",
          fontWeight: "700",
          fontVariant: "small-caps",
          fontFeatureSettings: '"smcp"',
          lineHeight: "3",
          letterSpacing: "2px",
          wordSpacing: "8px",
          textAlign: "center",
          textIndent: "40px",
          textTransform: "uppercase",
          textShadow: "1px 1px red",
          whiteSpace: "pre-wrap",
          textWrap: "balance",
          lineBreak: "anywhere",
          overflowWrap: "anywhere",
          wordBreak: "break-all",
          hyphens: "auto",
        });
      });
      expect((await root.screenshot()).equals(before)).toBe(true);
    });
  }

  const same = {
    "a banner is neutral by default": ["banner\n  text Hi", "banner.neutral\n  text Hi"],
    "an unknown variant on text adds no styling": ["dialog T\n  text Hi", "dialog T\n  text.big Hi"],
    "an unknown variant on a button adds no styling": [
      "dialog T\n  row\n    button Go",
      "dialog T\n  row\n    button.huge.end Go",
    ],
    "an unknown variant on a banner adds no styling": ["banner\n  text Hi", "banner.purple\n  text Hi"],
    "an unknown variant on a page, a table, a cell or a chip adds no styling": [
      "page\n  table\n    row\n      cell Hi\n      cell\n        chip web",
      "page.wide\n  table.striped\n    row\n      cell.big Hi\n      cell\n        chip.red web",
    ],
  };
  for (const [name, [plain, varied]] of Object.entries(same)) {
    test(name, async ({ page }) => {
      await show(page, plain!);
      const expected = await page.locator(".wf-root").screenshot();
      await show(page, varied!);
      expect((await page.locator(".wf-root").screenshot()).equals(expected)).toBe(true);
    });
  }
});

/** The classes of the elements in a wireframe that take focus, by Tab or by focus(). */
async function focusable(page: Page): Promise<string[]> {
  const found = new Set<string>();
  for (let press = 0; press < 5; press += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.closest(".wf-root") && document.activeElement);
    if (focused) found.add(await page.evaluate(() => document.activeElement!.getAttribute("class") ?? ""));
  }
  const programmatic = await page.evaluate(() =>
    [document.querySelector(".wf-root")!, ...document.querySelectorAll(".wf-root *")]
      .filter((element) => {
        (element as HTMLElement).focus();
        return document.activeElement === element;
      })
      .map((element) => element.getAttribute("class") ?? element.localName),
  );
  for (const name of programmatic) found.add(name);
  return [...found];
}

test("nothing in a wireframe takes focus", async ({ page }) => {
  await show(page, vocabulary, { host: "column" });
  expect(await focusable(page)).toEqual([]);
});

test("a wireframe that scrolls takes focus only as a whole, so the keyboard can scroll it", async ({ page }) => {
  await show(page, `dialog Pick one\n  row.end\n${"    button.focus Option\n".repeat(25)}`, { host: "column" });
  expect(await focusable(page)).toEqual(["wf-root"]);
});
