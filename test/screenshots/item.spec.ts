import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const [kind, selector] of [
    ["card", ".wf-card"], ["card width=240", ".wf-card"],
    ["card width=240 padding=0", ".wf-card"], ["card width=240 padding=32", ".wf-card"],
    ["card width=9999 padding=64", ".wf-card"],
    ["dialog", ".wf-dialog-card"], ["banner", ".wf-banner"], ["page", ".wf-page"],
    ["page.window History", ".wf-page-content"], ["frame History", ".wf-frame"],
    ["phone", ".wf-phone-content"],
  ] as const) {
    test(`current item reaches both inner edges of ${kind} with aligned compact lines in ${scheme}`, async ({ page }) => {
      await show(page, `${kind}\n  text Before\n  item Plain\n    text.small.muted First metadata\n  item.current Selected\n    text.small.muted Second metadata\n    text.small.strong More details\n  item.current Later\n    text.small.muted Third metadata\n  text After`, { scheme, host: "column", width: 320 });
      const geometry = await page.locator(selector).evaluate((container) => {
        const style = getComputedStyle(container);
        const box = container.getBoundingClientRect();
        const item = container.querySelector(".wf-item.wf-current")!;
        const rect = item.getBoundingClientRect();
        const tint = getComputedStyle(item, "::before");
        const anchored = getComputedStyle(item).position === "static";
        const origin = anchored ? box : rect;
        const originStyle = getComputedStyle(anchored ? container : item);
        const label = item.querySelector(".wf-item-label")!.getBoundingClientRect();
        const lines = [...item.querySelectorAll(".wf-text")].map((line) => line.getBoundingClientRect());
        const previous = container.querySelector(".wf-item")!;
        const previousLine = previous.querySelector(".wf-text")!.getBoundingClientRect();
        const following = container.querySelectorAll(".wf-item")[2]!;
        const followingLabel = following.querySelector(".wf-item-label")!.getBoundingClientRect();
        const stroke = container.classList.contains("wf-sized") ? Number.parseFloat(style.getPropertyValue("--_wf-stroke")) : 0;
        return {
          innerLeft: box.left + Math.max(stroke, Number.parseFloat(style.borderLeftWidth)),
          innerRight: box.right - Math.max(stroke, Number.parseFloat(style.borderRightWidth)),
          tintLeft: origin.left + Number.parseFloat(originStyle.borderLeftWidth) + Number.parseFloat(tint.left),
          tintRight: origin.right - Number.parseFloat(originStyle.borderRightWidth) - Number.parseFloat(tint.right),
          tintTop: origin.top + Number.parseFloat(originStyle.borderTopWidth) + Number.parseFloat(tint.top),
          tintBottom: origin.bottom - Number.parseFloat(originStyle.borderBottomWidth) - Number.parseFloat(tint.bottom),
          top: rect.top, bottom: rect.bottom, tintBorder: tint.borderStyle, tintRadius: tint.borderRadius,
          tint: tint.backgroundColor, paper: style.backgroundColor,
          labelLeft: label.left,
          otherLeft: container.querySelector('.wf-text[data-line="2"]')!.getBoundingClientRect().left,
          lineLefts: lines.map((line) => line.left),
          innerGaps: [lines[0]!.top - label.bottom, lines[1]!.top - lines[0]!.bottom],
          betweenGaps: [label.top - previousLine.bottom, followingLabel.top - lines[1]!.bottom],
          currentCount: container.querySelectorAll(".wf-item.wf-current").length,
          laterTint: getComputedStyle(following, "::before").content,
        };
      });
      expect(geometry.tintLeft).toBeCloseTo(geometry.innerLeft, 1);
      expect(geometry.tintRight).toBeCloseTo(geometry.innerRight, 1);
      expect(geometry.labelLeft).toBeCloseTo(geometry.otherLeft, 1);
      for (const left of geometry.lineLefts) expect(left).toBeCloseTo(geometry.labelLeft, 1);
      for (const gap of geometry.innerGaps) {
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(Math.min(...geometry.betweenGaps));
      }
      expect(geometry.tint).not.toBe(geometry.paper);
      expect(geometry.tint).not.toBe("rgba(0, 0, 0, 0)");
      expect(geometry.tintTop).toBeCloseTo(geometry.top, 1);
      expect(geometry.tintBottom).toBeCloseTo(geometry.bottom, 1);
      expect(geometry.tintBorder).toBe("none");
      expect(geometry.tintRadius).toBe("0px");
      expect(geometry.currentCount).toBe(1);
      expect(geometry.laterTint).toBe("none");
    });
  }

  test(`selection stays inside capped padding and narrow fractional cards in ${scheme}`, async ({ page }) => {
    for (const source of [
      "card width=9999 padding=64\n  item.current Label",
      "page\n  row\n    card width=1/3 padding=14\n      item.current Label\n    card\n      text Other",
    ]) {
      await show(page, source, { scheme, host: "column", width: 120 });
      const geometry = await page.locator(".wf-card").first().evaluate((card) => {
        const box = card.getBoundingClientRect();
        const tint = getComputedStyle(card.querySelector(".wf-current")!, "::before");
        return { width: box.width, left: Number.parseFloat(tint.left), right: Number.parseFloat(tint.right), tintWidth: Number.parseFloat(tint.width) };
      });
      expect(geometry.left).toBe(1);
      expect(geometry.right).toBe(1);
      expect(geometry.tintWidth).toBeCloseTo(geometry.width - 2, 1);
      const selectedOverflow = await page.locator(".wf-root").evaluate((root) => root.scrollWidth - root.clientWidth);
      await show(page, source.replace("item.current", "item"), { scheme, host: "column", width: 120 });
      // Unfitting row neighbours may already require the root's native scroll.
      expect(await page.locator(".wf-root").evaluate((root) => root.scrollWidth - root.clientWidth)).toBe(selectedOverflow);
    }
  });

  for (const leading of ["", "    icon robot\n", "    image.round width=32 Avatar\n", "    image.round width=9999 Avatar\n"]) {
    test(`long item lines wrap beside ${leading.trim() || "no picture"} without widening their card in ${scheme}`, async ({ page }) => {
      const word = "RevisionMetadata".repeat(10);
      for (const layout of ["block", "flex", "grid", "fit-content"] as const) {
        await show(page, `card width=240\n  text Before\n  item.current ${word}\n${leading}    text.small.muted ${word}\n  item Next\n    text.small.muted Metadata`, { scheme, host: "column", width: 240, layout });
        const geometry = await page.locator(".wf-item.wf-current").evaluate((item) => {
          const rect = (selector: string) => {
            const node = item.querySelector(selector)!;
            const box = node.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, height: box.height, lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight) };
          };
          return {
            label: rect(".wf-item-label"), metadata: rect(".wf-text"),
            picture: item.querySelector(".wf-item-leading") === null ? null : rect(".wf-item-leading"),
            width: item.closest(".wf-card")!.getBoundingClientRect().width,
          };
        });
        expect(geometry.width).toBeLessThanOrEqual(240);
        expect(geometry.label.height).toBeGreaterThan(geometry.label.lineHeight);
        expect(geometry.metadata.height).toBeGreaterThan(geometry.metadata.lineHeight);
        expect(geometry.label.left).toBeCloseTo(geometry.metadata.left, 1);
        if (geometry.picture !== null) {
          expect(geometry.picture.right).toBeLessThan(geometry.label.left);
          expect(geometry.picture.top).toBeCloseTo(geometry.label.top, 1);
        }
        expect(await page.locator(".wf-root, .wf-card, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth)))
          .toEqual([0, 0, 0]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });
  }

  test(`banner entries take their own line while surrounding content keeps its line in ${scheme}`, async ({ page }) => {
    const source = "banner.warning\n  icon alert-triangle\n  text Offline\n  row.end\n    button Retry";
    const measure = () => page.locator(".wf-banner-line").first().evaluate((line) => [...line.querySelectorAll("[data-line]")].map((node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    await show(page, source, { scheme, host: "column", width: 320 });
    const before = await measure();
    await show(page, `${source}\n  item.current Selected\n    text.small.muted Metadata\n  text After`, { scheme, host: "column", width: 320 });
    expect(await measure()).toEqual(before);
    const item = (await page.locator(".wf-item").boundingBox())!;
    const first = (await page.locator(".wf-banner-line").first().boundingBox())!;
    const after = (await page.locator(".wf-banner-line").last().boundingBox())!;
    expect(item.y).toBeGreaterThan(first.y + first.height);
    expect(after.y).toBeGreaterThan(item.y + item.height);
    expect(item.x).toBe(first.x);
    expect(item.width).toBe(first.width);
  });

  test(`current tint follows existing host ink and paper properties in ${scheme}`, async ({ page }) => {
    const host = await show(page, "card\n  item.current Selected\n    text.small.muted Metadata", { scheme });
    await host.evaluate((element) => {
      element.style.setProperty("--wf-ink", "rgb(20, 20, 20)");
      element.style.setProperty("--wf-paper", "rgb(240, 240, 240)");
    });
    const colours = await page.locator(".wf-item").evaluate((node) => {
      const swatch = document.createElement("div");
      swatch.style.backgroundColor = "color-mix(in oklab, rgb(20, 20, 20) 10%, rgb(240, 240, 240))";
      node.append(swatch);
      const expected = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      return { expected, actual: getComputedStyle(node, "::before").backgroundColor };
    });
    expect(colours.actual).toBe(colours.expected);
  });
}
