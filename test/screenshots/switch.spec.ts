import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const example = (name: string) => readFileSync(new URL(`../../examples/forms/4-switches/${name}.wireframe`, import.meta.url), "utf8");

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const host of ["standalone", "column"] as const) {
    test(`switch thumbs show on/off and bare switches trail rows in ${scheme}, ${host}`, async ({ page }) => {
      await show(page, `${example("settings")}\n${example("bare")}`, { scheme, host });
      const tracks = await page.locator(".wf-switch-track").evaluateAll((nodes) => nodes.map((node) => {
        const track = node.getBoundingClientRect();
        const thumb = node.firstElementChild!;
        const box = thumb.getBoundingClientRect();
        return {
          start: box.left - track.left, end: track.right - box.right,
          thumbWidth: box.width, thumbHeight: box.height,
          trackColour: getComputedStyle(node).backgroundColor,
          thumbColour: getComputedStyle(thumb).backgroundColor,
        };
      }));
      const on = scheme === "light" ? ["oklch(0.205 0 0)", "oklch(0.985 0 0)"] : ["oklch(0.922 0 0)", "oklch(0.205 0 0)"];
      const off = scheme === "light" ? ["oklch(0.86 0.004 75)", "oklch(1 0 0)"] : ["oklch(1 0 0 / 0.2)", "oklch(0.215 0 0)"];
      for (const [index, track] of tracks.entries()) {
        expect(track.thumbWidth).toBeCloseTo(track.thumbHeight, 1);
        expect([track.trackColour, track.thumbColour]).toEqual(index === 1 ? off : on);
        expect(index === 1 ? track.end : track.start).toBeGreaterThan(10);
        expect(index === 1 ? track.start : track.end).toBeCloseTo(2.1, 1);
      }
      const row = (await page.locator(".wf-row").boundingBox())!;
      const bare = (await page.locator(".wf-switch").last().boundingBox())!;
      expect(bare.x + bare.width).toBeCloseTo(row.x + row.width, 1);
      expect(await page.locator(".wf-switch").last().locator(".wf-switch-caption").count()).toBe(0);
      await expect(page.locator(".wf-switch").nth(0)).toMatchAriaSnapshot('- text: Collapse unchanged , on');
      await expect(page.locator(".wf-switch").nth(1)).toMatchAriaSnapshot('- text: Show whitespace changes , off');
      await expect(page.locator(".wf-switch").nth(2)).toMatchAriaSnapshot('- text: switch, on');
      await page.keyboard.press("Tab");
      expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
    });

    test(`long switch captions wrap beside their first-line track in ${scheme}, ${host}`, async ({ page }) => {
      await show(page, example("long-caption"), { scheme, host });
      const geometry = await page.locator(".wf-switch").evaluate((node) => {
        const track = node.querySelector(".wf-switch-track")!.getBoundingClientRect();
        const caption = node.querySelector(".wf-switch-caption")!;
        const range = document.createRange();
        range.selectNode(caption.firstChild!);
        const lines = [...range.getClientRects()].map((box) => ({ left: box.left, top: box.top, bottom: box.bottom }));
        const top = caption.getBoundingClientRect().top;
        const bottom = top + Number.parseFloat(getComputedStyle(caption).lineHeight);
        return { track: { top: track.top, right: track.right, bottom: track.bottom }, lines, firstLine: { top, bottom } };
      });
      expect(geometry.lines.length).toBeGreaterThan(1);
      for (const line of geometry.lines) {
        expect(line.left).toBeGreaterThan(geometry.track.right);
        expect(line.left).toBeCloseTo(geometry.lines[0]!.left, 1);
      }
      expect(geometry.track.top).toBeGreaterThanOrEqual(geometry.firstLine.top);
      expect(geometry.track.bottom).toBeLessThanOrEqual(geometry.firstLine.bottom);
      expect(geometry.track.bottom).toBeLessThan(geometry.lines[1]!.top);
      expect(await page.locator(".wf-card").evaluate((node) => node.getBoundingClientRect().width)).toBe(240);
      const overflow = await page.locator(".wf-root, .wf-card, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
      expect(overflow).toEqual(overflow.map(() => 0));
    });
  }

  test(`switch captions fit every container and host layout in ${scheme}`, async ({ page }) => {
    for (const layout of ["block", "flex", "grid", "fit-content"] as const) {
      for (const kind of ["dialog", "banner", "page", "page.window Settings", "frame", "phone", "phone\n  dock", "card", "card width=160", "card\n  row.between"]) {
        const indent = "  ".repeat(kind.split("\n").length);
        await show(page, `${kind}\n${indent}switch.on ${"LongUnbrokenCaption".repeat(20)}`, { scheme, host: "column", width: 240, layout });
        const overflow = await page.locator(".wf-root, .wf-card, .wf-switch, .wf-phone-viewport, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
        expect(overflow, `${kind}, ${layout}`).toEqual(overflow.map(() => 0));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  });

  test(`switches scale with text size and reuse host colours in ${scheme}`, async ({ page }) => {
    const host = await show(page, example("settings"), { scheme });
    const dimensions = () => page.locator(".wf-switch-track, .wf-switch-thumb").evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    const before = await dimensions();
    await host.evaluate((node) => {
      node.style.setProperty("--wf-text-size", "28px");
      node.style.setProperty("--wf-primary", "rgb(10, 20, 30)");
      node.style.setProperty("--wf-primary-ink", "rgb(240, 245, 250)");
      node.style.setProperty("--wf-line", "rgb(40, 50, 60)");
      node.style.setProperty("--wf-paper", "rgb(210, 220, 230)");
    });
    const after = await dimensions();
    for (const [index, box] of after.entries()) {
      expect(box.width).toBeCloseTo(before[index]!.width * 2, 1);
      expect(box.height).toBeCloseTo(before[index]!.height * 2, 1);
    }
    expect(await page.locator(".wf-switch-track, .wf-switch-thumb").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor)))
      .toEqual(["rgb(10, 20, 30)", "rgb(240, 245, 250)", "rgb(40, 50, 60)", "rgb(210, 220, 230)"]);
  });
}
