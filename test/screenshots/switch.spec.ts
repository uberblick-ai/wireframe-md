import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const example = (name: string) => readFileSync(new URL(`../../examples/forms/4-switches/${name}.wireframe`, import.meta.url), "utf8");
const rowCaption = `card width=300
  row.between
    switch.on Collapse unchanged
    row
      button.link Previous change
      button.link Next change`;

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const host of ["standalone", "column"] as const) {
    test(`row switch captions keep whole words beside non-shrinking actions in ${scheme}, ${host}`, async ({ page }) => {
      for (const source of [
        rowCaption,
        rowCaption.replace("    switch.on", "    row\n      switch.on"),
        rowCaption.replace("row.between", "row.scroll"),
        rowCaption.replace("card width=300", "phone"),
      ]) {
        const shot = await show(page, source, { scheme, host });
        const geometry = await page.locator(".wf-switch[data-line]").evaluate((node) => {
          const caption = node.querySelector(".wf-switch-caption")!;
          const text = caption.firstChild!;
          const range = document.createRange();
          const words = [...text.textContent!.matchAll(/\S+/g)].map((word) => {
            range.setStart(text, word.index);
            range.setEnd(text, word.index + word[0].length);
            return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right }));
          });
          range.selectNode(text);
          const lines = range.getClientRects().length;
          const box = node.getBoundingClientRect();
          const track = node.querySelector(".wf-switch-track")!.getBoundingClientRect();
          const action = node.closest(".wf-card, .wf-phone-content")!.querySelector(".wf-button[data-line]")!.getBoundingClientRect();
          return { words, lines, switchRight: box.right, trackRight: track.right, actionLeft: action.left };
        });
        expect(geometry.lines, source).toBeGreaterThanOrEqual(1);
        expect(geometry.lines, source).toBeLessThanOrEqual(2);
        for (const word of geometry.words) {
          expect(word, source).toHaveLength(1);
          expect(word[0]!.left, source).toBeGreaterThan(geometry.trackRight);
          expect(word[0]!.right, source).toBeLessThanOrEqual(geometry.switchRight);
        }
        expect(geometry.actionLeft, source).toBeGreaterThan(geometry.switchRight);
        await expect(page.locator(".wf-switch[data-line]")).toMatchAriaSnapshot('- text: Collapse unchanged , on');
        if (source === rowCaption) await expect(shot).toHaveScreenshot(`switch-row-caption-${scheme}-${host}.png`);
        // A narrow host makes the unfitting row reach the wireframe's edge.
        await page.locator(host === "column" ? ".column" : ".standalone").evaluate((node) => { node.style.width = "240px"; });
        expect(await page.locator(".column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth)), source)
          .toEqual(host === "column" ? [0] : []);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), source).toBe(0);
        const scroller = page.locator(source.startsWith("phone") ? ".wf-phone-viewport" : source.includes("row.scroll") ? ".wf-row.wf-scroll" : ".wf-root");
        expect(await scroller.evaluate((node) => node.scrollWidth - node.clientWidth), source).toBeGreaterThan(0);
        expect(await scroller.evaluate((node) => { node.scrollLeft = 10000; return node.scrollLeft; }), source).toBeGreaterThan(0);
      }
    });

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
      const bare = (await page.locator(".wf-switch-track").last().boundingBox())!;
      expect(bare.x + bare.width).toBeCloseTo(row.x + row.width, 1);
      expect(await page.locator(".wf-switch").last().locator(".wf-switch-caption").count()).toBe(0);
      await expect(page.locator(".wf-switch").nth(0)).toMatchAriaSnapshot('- text: Collapse unchanged , on');
      await expect(page.locator(".wf-switch").nth(1)).toMatchAriaSnapshot('- text: Show whitespace changes , off');
      await expect(page.locator(".wf-switch").nth(2)).toMatchAriaSnapshot('- text: switch, on');
      await page.keyboard.press("Tab");
      expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
    });

    test(`bare switch tracks stay inside rows beside wrapping text in ${scheme}, ${host}`, async ({ page }) => {
      const caption = "Email me about mentions and replies from every workspace and followed document";
      for (const source of [
        `card width=300\n  row.between\n    text ${caption}\n    switch.on`,
        `card width=300\n  row.between\n    row\n      text.strong Notifications\n      text.muted ${caption}\n    switch.on`,
        `phone\n  row.between\n    text ${caption}\n    switch`,
      ]) {
        await show(page, source, { scheme, host });
        const geometry = await page.locator(".wf-switch").evaluate((node) => {
          const box = node.getBoundingClientRect();
          const track = node.querySelector(".wf-switch-track")!.getBoundingClientRect();
          const row = node.parentElement!;
          const rowBox = row.getBoundingClientRect();
          const text = row.querySelectorAll(".wf-text");
          const range = document.createRange();
          range.selectNodeContents(text[text.length - 1]!);
          return {
            switchWidth: box.width, trackWidth: track.width,
            trackLeft: track.left, trackRight: track.right,
            rowLeft: rowBox.left, rowRight: rowBox.right,
            textLines: range.getClientRects().length,
            overflow: row.scrollWidth - row.clientWidth,
          };
        });
        expect(geometry.textLines, source).toBeGreaterThan(1);
        expect(geometry.trackRight, source).toBeCloseTo(geometry.rowRight, 1);
        expect(geometry.trackLeft, source).toBeGreaterThanOrEqual(geometry.rowLeft);
        expect(geometry.switchWidth, source).toBeGreaterThanOrEqual(geometry.trackWidth);
        expect(geometry.overflow, source).toBe(0);
      }
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

  test(`unbroken row captions keep their available-width cap when siblings overflow in ${scheme}`, async ({ page }) => {
    for (const layout of ["block", "flex", "grid", "fit-content"] as const) {
      for (const kind of [
        "card\n  row.between", "card width=160\n  row.between\n    row",
        "page width=220\n  row", "page.window Settings\n  row",
        "dialog\n  row", "banner\n  row", "banner\n  row\n    row", "frame\n  row", "phone\n  row",
        "phone\n  dock\n    row", "card width=220\n  row.scroll",
      ]) {
        const indent = "  ".repeat(kind.split("\n").length);
        const source = `${kind}\n${indent}switch.on ${"LongUnbrokenCaption".repeat(20)}`;
        const dimensions = () => page.locator(".wf-switch[data-line]").evaluate((node) => {
          const caption = node.querySelector(".wf-switch-caption")!;
          const range = document.createRange();
          range.selectNode(caption.firstChild!);
          return { width: node.getBoundingClientRect().width, lines: range.getClientRects().length, overflow: node.scrollWidth - node.clientWidth };
        });
        await show(page, source, { scheme, host: "column", width: 240, layout });
        const before = await dimensions();
        const overflow = await page.locator(".wf-root, .wf-card, .wf-phone-viewport, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
        expect(overflow, `${kind}, ${layout}`).toEqual(overflow.map(() => 0));
        await show(page, `${source}\n${indent}button.link Previous change\n${indent}button.link Next change`, { scheme, host: "column", width: 240, layout });
        const after = await dimensions();
        expect(after.width, `${kind}, ${layout}`).toBeCloseTo(before.width, 1);
        expect(after.lines, `${kind}, ${layout}`).toBeGreaterThan(1);
        expect(after.overflow, `${kind}, ${layout}`).toBe(0);
        expect(await page.locator(".column").evaluate((node) => node.scrollWidth - node.clientWidth), `${kind}, ${layout}`).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${kind}, ${layout}`).toBe(0);
      }
    }
  });

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
