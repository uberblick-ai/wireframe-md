import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, show } from "./page.js";

const examples = (name: string) => readFileSync(new URL(`../../examples/navigation/4-tab-bars/${name}.wireframe`, import.meta.url), "utf8");
const strip = "  tabs\n    option Overview\n    option.current Activity\n      icon activity\n    option Members";
const overflowing = `  tabs\n    option.current Overview\n${"    option Members and permissions\n".repeat(8).trimEnd()}`;

test.beforeEach(async ({ page }) => open(page));

for (const scheme of ["light", "dark"] as const) {
  for (const [kind, container] of [
    ["dialog", ".wf-dialog-card"], ["banner", ".wf-banner"], ["page", ".wf-page"],
    ["page.window Settings", ".wf-page-content"], ["frame", ".wf-frame"],
    ["phone", ".wf-phone-content"], ["card", ".wf-card"],
  ] as const) {
    test(`tabs span ${kind} content with only the current tab underlined in ${scheme}`, async ({ page }) => {
      await show(page, `${kind}\n  text Before\n${strip}\n  text After`, { scheme, host: "column" });
      const geometry = await page.locator(container).evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const tabs = element.querySelector(".wf-tabs")!;
        const line = tabs.getBoundingClientRect();
        const current = tabs.querySelector(".wf-current")!;
        const icon = current.querySelector(".wf-icon")!.getBoundingClientRect();
        const caption = current.querySelector(".wf-option-caption")!.getBoundingClientRect();
        return {
          contentLeft: box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
          contentRight: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          left: line.left, right: line.right, bottom: line.bottom,
          rule: getComputedStyle(tabs).boxShadow,
          iconBeforeCaption: icon.right < caption.left,
          tabs: [...tabs.children].map((option) => {
            const rect = option.getBoundingClientRect();
            const underline = getComputedStyle(option, "::after");
            return {
              top: rect.top, bottom: rect.bottom, width: rect.width,
              colour: getComputedStyle(option).color,
              separator: getComputedStyle(option, "::before").content,
              underline: underline.content, underlineWidth: Number.parseFloat(underline.width),
              underlineHeight: underline.height, underlineLeft: underline.left, underlineBottom: underline.bottom,
              underlineColour: underline.backgroundColor,
            };
          }),
        };
      });
      const line = scheme === "light" ? "oklch(0.86 0.004 75)" : "oklch(1 0 0 / 0.2)";
      const ink = scheme === "light" ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";
      const muted = scheme === "light" ? "oklch(0.511 0 0)" : "oklch(0.708 0 0)";
      expect(geometry.left).toBeCloseTo(geometry.contentLeft, 1);
      expect(geometry.right).toBeCloseTo(geometry.contentRight, 1);
      expect(geometry.rule).toBe(`${line} 0px -1px 0px 0px inset`);
      expect(geometry.iconBeforeCaption).toBe(true);
      for (const [index, tab] of geometry.tabs.entries()) {
        expect(tab.top).toBe(geometry.tabs[0]!.top);
        expect(tab.bottom).toBe(geometry.bottom);
        expect(tab.separator).toBe("none");
        expect(tab.colour).toBe(index === 1 ? ink : muted);
        expect(tab.underline).toBe(index === 1 ? '""' : "none");
        if (index === 1) {
          expect(tab.underlineWidth).toBeCloseTo(tab.width, 1);
          expect(tab.underlineHeight).toBe("2px");
          expect(tab.underlineLeft).toBe("0px");
          expect(tab.underlineBottom).toBe("0px");
          expect(tab.underlineColour).toBe(ink);
        }
      }
    });
  }

  test(`banner tabs keep long text beside the icon and actions in ${scheme}`, async ({ page }) => {
    const source = "banner.warning\n  icon alert-triangle\n  text You are offline. Your changes will sync when you reconnect to the network, and comments stay drafts until then.\n  row.end\n    button Retry";
    const measure = () => page.locator(".wf-banner").evaluate((banner) => {
      const box = banner.getBoundingClientRect();
      const style = getComputedStyle(banner);
      const rect = (selector: string) => {
        const child = banner.querySelector(selector)!.getBoundingClientRect();
        return { left: child.left, right: child.right, top: child.top - box.top, bottom: child.bottom - box.top, height: child.height };
      };
      return {
        icon: rect('[data-line="2"]'), text: rect('[data-line="3"]'), actions: rect('[data-line="4"]'),
        lineHeight: Number.parseFloat(getComputedStyle(banner.querySelector(".wf-text")!).lineHeight),
        contentLeft: box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
        contentRight: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
        tabs: banner.querySelector(".wf-tabs") === null ? null : rect(".wf-tabs"),
      };
    });
    for (const width of [710, 320]) {
      await show(page, source, { scheme, host: "column", width });
      const before = await measure();
      await show(page, `${source}\n${strip}`, { scheme, host: "column", width });
      const after = await measure();
      // Adding a strip must not reflow the existing banner content onto separate lines.
      expect(after.icon).toEqual(before.icon);
      expect(after.text).toEqual(before.text);
      expect(after.actions).toEqual(before.actions);
      expect(after.text.height).toBeGreaterThan(after.lineHeight);
      expect(after.icon.right).toBeLessThan(after.text.left);
      expect(after.text.right).toBeLessThan(after.actions.left);
      for (const child of [after.icon, after.actions]) {
        expect((child.top + child.bottom) / 2).toBeCloseTo((after.text.top + after.text.bottom) / 2, 1);
      }
      expect(after.tabs!.top).toBeGreaterThan(after.text.bottom);
      expect(after.tabs!.left).toBeCloseTo(after.contentLeft, 1);
      expect(after.tabs!.right).toBeCloseTo(after.contentRight, 1);
      expect(after.actions.right).toBeCloseTo(after.contentRight, 1);
      expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    }
  });

  for (const [name, content] of [
    ["an unbroken word", "  icon alert-triangle\n  text Visit https://example.com/a/very/long/unbreakable/path/segment/that/keeps/going/and/going/forever now\n  row.end\n    button Retry"],
    ["two direct texts", "  icon alert-triangle\n  text.strong Offline\n  text Your changes will sync when you reconnect to the network, and comments stay drafts until then.\n  row.end\n    button Retry"],
    ["a toggle", "  text View\n  toggle\n    option.current List\n    option Grid\n  row.end\n    button Apply"],
    ["an input", "  icon search\n  text Filter\n  input Search\n  row.end\n    button Go"],
    ["labelled fields", "  text Filter\n  input label=Search Search\n  select label=Scope Everything\n  row.end\n    button Go"],
  ]) {
    test(`banner tabs preserve the layout of ${name} in ${scheme}`, async ({ page }) => {
      const source = `banner.warning\n${content}`;
      const measure = () => page.locator(".wf-banner").evaluate((banner) => {
        const box = banner.getBoundingClientRect();
        const style = getComputedStyle(banner);
        const root = banner.closest(".wf-root")!;
        return {
          width: box.width,
          overflow: root.scrollWidth - root.clientWidth,
          contentLeft: box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
          contentRight: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          children: [...banner.querySelectorAll("[data-line]")].filter((node) => !node.closest(".wf-tabs")).map((node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top - box.top, bottom: rect.bottom - box.top, scrollWidth: node.scrollWidth };
          }),
          tabs: [...banner.querySelectorAll(".wf-tabs")].map((node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top - box.top };
          }),
        };
      });
      for (const width of [710, 320]) {
        await show(page, source, { scheme, host: "column", width });
        const before = await measure();
        await show(page, `${source}\n${strip}`, { scheme, host: "column", width });
        const after = await measure();
        expect(after.children).toEqual(before.children);
        expect(after.width).toBe(before.width);
        expect(after.overflow).toBe(before.overflow);
        expect(after.tabs[0]!.top).toBeGreaterThan(Math.max(...after.children.map((child) => child.bottom)));
        expect(after.tabs[0]!.left).toBeCloseTo(after.contentLeft, 1);
        expect(after.tabs[0]!.right).toBeCloseTo(after.contentRight, 1);
        if (name === "an unbroken word") {
          expect(after.overflow).toBeGreaterThan(0);
          expect(after.children[1]!.right).toBeLessThan(after.children[2]!.left);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });
  }

  test(`overflow stays in the tab strip across containers and host layouts in ${scheme}`, async ({ page }) => {
    for (const layout of ["block", "flex", "grid"] as const) {
      for (const kind of ["page", "page.window Settings", "dialog", "banner", "frame", "phone", "card", "card width=240"]) {
        await show(page, `${kind}\n${overflowing}`, { scheme, host: "column", width: 320, layout });
        const tabs = page.locator(".wf-tabs");
        expect(await tabs.evaluate((node) => node.scrollWidth - node.clientWidth), kind).toBeGreaterThan(0);
        const widths = await page.locator(".wf-root, .wf-phone-viewport, .column").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth - node.clientWidth));
        expect(widths, `${kind}, ${layout}`).toEqual(widths.map(() => 0));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const before = (await tabs.boundingBox())!;
        const first = (await tabs.locator(".wf-option").first().boundingBox())!;
        await tabs.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
        const last = (await tabs.locator(".wf-option").last().boundingBox())!;
        expect((await tabs.locator(".wf-option").first().boundingBox())!.x).toBeLessThan(first.x);
        expect(last.x + last.width).toBeCloseTo(before.x + before.width, 0);
        expect(await tabs.boundingBox()).toEqual(before);
        expect(await tabs.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("0px -1px 0px 0px inset");
      }
    }
    // Cards must also contain their strip when sharing a row or inside a scroller.
    for (const row of ["row", "row.scroll"]) {
      await show(page, `page\n  ${row}\n    card\n${overflowing.split("\n").map((line) => `    ${line}`).join("\n")}\n    card\n      text Other`, { scheme, host: "column", width: 320 });
      expect(await page.locator(".wf-tabs").evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      expect(await page.locator(".wf-root").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    }
  });

  test(`only overflowing strips take a native keyboard stop with a themed ring in ${scheme}`, async ({ page }) => {
    await show(page, `${examples("settings")}\n${examples("activity")}\n${examples("overflow")}`, { scheme, host: "column" });
    const tabs = page.locator(".wf-tabs").last();
    await page.keyboard.press("Tab");
    await expect(tabs).toBeFocused();
    const focus = await tabs.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, colour: style.outlineColor };
    });
    expect(focus).toEqual({ style: "solid", width: "2px", offset: "-2px", colour: scheme === "light" ? "oklch(0.72 0.16 65)" : "oklch(0.8 0.18 65)" });
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => tabs.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    expect(await page.locator(".wf-root").evaluate((node) => node.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    await page.keyboard.press("Tab");
    expect(await page.locator(".wf-root").evaluate((root) => root.contains(document.activeElement))).toBe(false);
  });

  test(`a phone tab strip scrolls with content and Page keys reach the viewport in ${scheme}`, async ({ page }) => {
    await show(page, `phone\n${overflowing}\n${"  text More screen content\n".repeat(60)}`, { scheme, host: "column" });
    const tabs = page.locator(".wf-tabs");
    const screen = page.locator(".wf-phone-viewport");
    const before = (await tabs.boundingBox())!.y;
    await page.keyboard.press("Tab");
    await expect(tabs).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect.poll(() => screen.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect((await tabs.boundingBox())!.y).toBeLessThan(before);
    expect(await screen.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    expect(await tabs.evaluate((node) => getComputedStyle(node).overscrollBehavior)).toBe("auto");
  });

  test(`no current tab stays muted and multiple current tabs only underline the first in ${scheme}`, async ({ page }) => {
    for (const current of [false, true]) {
      await show(page, `card\n  tabs\n    option${current ? ".current" : ""} One\n    option${current ? ".current" : ""} Two`, { scheme });
      expect(await page.locator(".wf-option").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node, "::after").content)))
        .toEqual(current ? ['""', "none"] : ["none", "none"]);
      expect(await page.locator(".wf-option").last().evaluate((node) => getComputedStyle(node).color))
        .toBe(scheme === "light" ? "oklch(0.511 0 0)" : "oklch(0.708 0 0)");
    }
  });

  test(`tab rules, underlines and focus use existing host properties in ${scheme}`, async ({ page }) => {
    const host = await show(page, `card width=240\n${overflowing}`, { scheme });
    await host.evaluate((element) => {
      element.style.setProperty("--wf-line", "rgb(10, 20, 30)");
      element.style.setProperty("--wf-ink", "rgb(40, 50, 60)");
      element.style.setProperty("--wf-stroke", "3px");
      element.style.setProperty("--wf-focus", "rgb(70, 80, 90)");
      element.style.setProperty("--wf-focus-width", "4px");
    });
    expect(await page.locator(".wf-tabs").evaluate((node) => getComputedStyle(node).boxShadow)).toBe("rgb(10, 20, 30) 0px -3px 0px 0px inset");
    expect(await page.locator(".wf-current").evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return [style.backgroundColor, style.height];
    })).toEqual(["rgb(40, 50, 60)", "6px"]);
    await page.keyboard.press("Tab");
    expect(await page.locator(".wf-tabs").evaluate((node) => getComputedStyle(node).outline)).toBe("rgb(70, 80, 90) solid 4px");
  });
}
