import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const home = readFileSync(new URL("../../examples/phones/1-screens/home-feed.wireframe", import.meta.url), "utf8");
test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  test(`dock stays at the bottom at both scroll ends and clears the last content in ${scheme}`, async ({ page }) => {
    await show(page, home, { scheme, host: "column" });
    const screen = page.locator(".wf-phone-screen");
    const dock = page.locator(".wf-phone-screen > .wf-dock");
    const initial = (await dock.boundingBox())!;
    expect(initial.y + initial.height).toBeCloseTo((await screen.boundingBox())!.y + 640, 1);
    expect(initial.width).toBe((await screen.boundingBox())!.width);
    const tabs = await page.locator(".wf-dock > .wf-toggle > .wf-option").evaluateAll((options) => options.map((option) => {
      const box = option.getBoundingClientRect();
      const icon = option.querySelector(".wf-icon")!.getBoundingClientRect();
      const caption = option.querySelector(".wf-option-caption")!.getBoundingClientRect();
      return { width: box.width, stacked: icon.bottom <= caption.top, separator: getComputedStyle(option, "::before").content };
    }));
    for (const tab of tabs) {
      expect(tab.width).toBeCloseTo(tabs[0]!.width, 1);
      expect(tab.stacked).toBe(true);
      expect(tab.separator).toBe("none");
    }
    await screen.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    expect(await screen.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    const final = (await dock.boundingBox())!;
    expect(final.y).toBeCloseTo(initial.y, 1);
    const content = (await page.locator(".wf-phone-content > .wf-card:last-child").boundingBox())!;
    expect(content.y + content.height).toBeLessThan(final.y);
    expect(await dock.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(await screen.evaluate((node) => getComputedStyle(node).backgroundColor));
    await screen.evaluate((node) => { node.scrollTop = 0; });
    expect((await dock.boundingBox())!.y).toBeCloseTo(initial.y, 1);
  });

  test(`scroll rows contain exact widths and take only overflowing keyboard stops in ${scheme}`, async ({ page }) => {
    await show(page, home, { scheme, host: "column" });
    const rows = page.locator(".wf-phone-content > .wf-row.wf-scroll");
    const screen = page.locator(".wf-phone-screen");
    const first = rows.nth(0);
    const second = rows.nth(1);
    expect(await first.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
    expect(await second.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    const geometry = await rows.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const screen = node.closest(".wf-phone-screen")!.getBoundingClientRect();
      const first = node.firstElementChild!.getBoundingClientRect();
      const last = node.lastElementChild!.getBoundingClientRect();
      return { left: box.left, right: box.right, screenLeft: screen.left, screenRight: screen.right, firstLeft: first.left, widths: [...node.children].map((child) => child.getBoundingClientRect().width), lastRight: last.right };
    }));
    const header = (await page.locator(".wf-phone-content > .wf-row.wf-between").boundingBox())!;
    for (const [index, row] of geometry.entries()) {
      expect(row.left).toBeCloseTo(row.screenLeft, 1);
      expect(row.right).toBeCloseTo(row.screenRight, 1);
      expect(row.firstLeft).toBeCloseTo(header.x, 1);
      expect(row.widths).toEqual(index === 0 ? [96, 96] : [144, 144, 144]);
    }
    expect(geometry[1]!.lastRight).toBeGreaterThan(geometry[1]!.screenRight);
    await page.keyboard.press("Tab");
    await expect(second).toBeFocused();
    expect(await second.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => second.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    expect(await screen.evaluate((node) => node.scrollLeft)).toBe(0);
    expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    await page.keyboard.press("PageDown");
    await expect.poll(() => screen.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await second.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    expect(await second.evaluate((node) => getComputedStyle(node).overscrollBehavior)).toBe("auto");
  });

  test(`images retain ratios, capped widths and contained captions in ${scheme}`, async ({ page }) => {
    await show(page, 'page width=256\n  image A very long caption describing a placeholder whose label must never widen it\n  image.square width=100 Square\n  image.round width=60 Avatar\n  image width=1 Tiny\n  card width=9999\n    image.square Art\n  row\n    image width=200 Row image\n    text Caption\n  row\n    card\n      text One long caption wraps inside its card\n    card\n      text Two long captions wrap inside the second card', { scheme, host: "column" });
    const images = await page.locator(".wf-image").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const caption = node.querySelector<HTMLElement>(".wf-image-caption")!;
      return { width: box.width, height: box.height, caption: getComputedStyle(caption).display, scroll: node.scrollWidth - node.clientWidth };
    }));
    expect(images[0]!.width / images[0]!.height).toBeCloseTo(16 / 9, 1);
    expect(images[0]!.caption).toBe("block");
    expect(images[1]!.width).toBe(100);
    expect(images[1]!.height).toBe(100);
    expect(images[2]!.height).toBe(60);
    expect(images[2]!.caption).toBe("none");
    expect(images[3]!.width).toBe(1);
    expect(images[3]!.caption).toBe("none");
    expect(images[5]!.width).toBe(200);
    expect(images[5]!.caption).toBe("none");
    for (const image of images) expect(image.scroll).toBe(0);
    const cards = await page.locator(".wf-page > .wf-row:last-child > .wf-card").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
    expect(cards[0]).toBeCloseTo(cards[1]!, 1);
    expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
  });

  test(`dock stays full width during native horizontal screen scrolling in ${scheme}`, async ({ page }) => {
    await show(page, `phone\n  row\n${"    button Wide\n".repeat(25)}  dock\n    text Bottom`, { scheme });
    const dock = page.locator(".wf-phone-screen > .wf-dock");
    const before = (await dock.boundingBox())!;
    await page.locator(".wf-phone-screen").evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    expect(await page.locator(".wf-phone-screen").evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    const after = (await dock.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1); // Scroll offsets round to CSS pixels.
    expect(after.width).toBe(before.width);
    expect(after.y).toBe(before.y);
  });

  test(`scroll rows fit narrow hosts and keep their default and extreme pixel widths in ${scheme}`, async ({ page }) => {
    for (const kind of ["page", "frame", "card", "phone"]) {
      await show(page, `${kind}\n  row.scroll\n    card width=1\n    card\n      text A caption that wraps between words inside its card\n    image.square width=9999\n  text End`, { host: "column", width: 200, layout: "flex", scheme });
      const row = page.locator(".wf-row.wf-scroll");
      const widths = await row.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
      expect(widths).toEqual([1, 144, 9999]);
      expect(await row.evaluate((node) => node.scrollWidth)).toBeGreaterThan(9999);
      expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
      if (kind === "phone") expect(await page.locator(".wf-phone-screen").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
      await page.locator(".wf-root").evaluate((node) => (node as HTMLElement).style.setProperty("--wf-text-size", "24px"));
      expect(await row.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))).toEqual(widths);
    }
  });
}
