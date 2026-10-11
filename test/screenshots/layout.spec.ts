import { expect, type Page, test } from "@playwright/test";
import { archivedBanner, deleteConfirmation, PROPERTIES, vocabulary } from "../samples.js";
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
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(selector)!);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  }, selector);
}

test.describe("fit", () => {
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

  const wide = {
    "a row of many buttons": `dialog Pick one\n  row.end\n${"    button Option\n".repeat(25)}`,
    "a long word in a dialog": `dialog Title\n  text ${"x".repeat(300)}`,
    "a long word in a banner": `banner\n  text ${"x".repeat(300)}\n  row.end\n    button Restore`,
    "a long button caption": `banner\n  row\n    button ${"x".repeat(300)}`,
    "a row of buttons at the top level": `row\n${"  button Option\n".repeat(25)}`,
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
