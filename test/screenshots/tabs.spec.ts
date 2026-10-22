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

  const bannerCases: readonly (readonly [string, string, number?])[] = [
    ["an unbroken word", "  icon alert-triangle\n  text Visit https://example.com/a/very/long/unbreakable/path/segment/that/keeps/going/and/going/forever now\n  row.end\n    button Retry"],
    ["two direct texts", "  icon alert-triangle\n  text.strong Offline\n  text Your changes will sync when you reconnect to the network, and comments stay drafts until then.\n  row.end\n    button Retry"],
    ["a toggle", "  text View\n  toggle\n    option.current List\n    option Grid\n  row.end\n    button Apply"],
    ["an input", "  icon search\n  text Filter\n  input Search\n  row.end\n    button Go"],
    ["labelled fields", "  text Filter\n  input label=Search Search\n  select label=Scope Everything\n  row.end\n    button Go"],
    ...[200, 400, 800, 9999].map((width) => [
      `an image width=${width}`,
      `  image width=${width} Preview\n  text You are offline. Your changes will sync when you reconnect to the network.\n  row.end\n    button Retry`,
      width,
    ] as const),
    ["a default image", "  icon alert-triangle\n  image Preview\n  text You are offline. Your changes will sync when you reconnect to the network.\n  row.end\n    button Retry"],
    ["a sized image beside an unbroken word", "  image width=800 Preview\n  text PneumonoultramicroscopicsilicovolcanoconiosisPneumonoultramicroscopicsilicovolcanoconiosis\n  row.end\n    button Retry", 800],
    ["a large round image", "  image.round width=9999 Ana\n  text Ana joined.", 9999],
  ];
  for (const [name, content, imageWidth] of bannerCases) {
    test(`banner tabs preserve the layout of ${name} in ${scheme}`, async ({ page }) => {
      const source = `banner.warning\n${content}`;
      const measure = () => page.locator(".wf-banner").evaluate((banner) => {
        const box = banner.getBoundingClientRect();
        const style = getComputedStyle(banner);
        const root = banner.closest(".wf-root")!;
        const size = banner.closest(".wf-banner-size");
        return {
          width: box.width,
          overflow: root.scrollWidth - root.clientWidth,
          contentLeft: box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
          contentRight: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          availableWidth: (size?.getBoundingClientRect().width ?? box.width)
            - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth)
            - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
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
      const hosts = [710, 500, 400, 320].flatMap((width) =>
        (["block", "flex", "grid"] as const).map((layout) => ({ width, layout })));
      for (const { width, layout } of hosts) {
        await show(page, source, { scheme, host: "column", width, layout });
        const before = await measure();
        await show(page, `${source}\n${strip}`, { scheme, host: "column", width, layout });
        const after = await measure();
        expect(after.children).toEqual(before.children);
        expect(after.width).toBe(before.width);
        expect(after.overflow).toBe(before.overflow);
        expect(after.tabs[0]!.top).toBeGreaterThan(Math.max(...after.children.map((child) => child.bottom)));
        expect(after.tabs[0]!.left).toBeCloseTo(after.contentLeft, 1);
        expect(after.tabs[0]!.right).toBeCloseTo(after.contentRight, 1);
        for (const child of after.children) {
          expect(child.left).toBeGreaterThanOrEqual(after.contentLeft);
          expect(child.right).toBeLessThanOrEqual(after.contentRight);
        }
        if (imageWidth !== undefined) {
          expect(after.children[0]!.right - after.children[0]!.left)
            .toBeCloseTo(Math.min(imageWidth, after.availableWidth), 1);
          if (imageWidth >= width || name === "a sized image beside an unbroken word") expect(after.overflow).toBeGreaterThan(0);
        }
        if (name === "a default image") {
          expect(after.children[1]!.right - after.children[1]!.left).toBeGreaterThan(0);
        }
        if (name === "an unbroken word") {
          expect(after.overflow).toBeGreaterThan(0);
          expect(after.children[1]!.right).toBeLessThan(after.children[2]!.left);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });
  }

  test(`lone banner images cap declared widths with and without tabs in ${scheme}`, async ({ page }) => {
    for (const [kind, declaredWidth] of [["image", 1], ["image", 300], ["image", 800], ["image", 9999], ["image.round", 9999]] as const) {
      const image = `${kind} width=${declaredWidth}`;
      for (const width of [710, 320]) {
        for (const layout of ["block", "flex", "grid", "fit-content", "flex-content", "grid-content", "inline-block", "float"] as const) {
          for (const tabs of ["", `\n${strip}`]) {
            await show(page, `banner\n  ${image} Preview${tabs}`, { scheme, host: "column", width, layout });
            const geometry = await page.locator(".wf-banner").evaluate((banner) => {
              const box = banner.getBoundingClientRect();
              const style = getComputedStyle(banner);
              const image = banner.querySelector(".wf-image")!.getBoundingClientRect();
              const root = banner.closest(".wf-root")!;
              return {
                contentWidth: box.width - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth)
                  - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
                imageWidth: image.width,
                imageHeight: image.height,
                overflow: root.scrollWidth - root.clientWidth,
              };
            });
            expect(geometry.imageWidth, `${image}, ${width}, ${layout}, tabs=${tabs !== ""}`)
              .toBeCloseTo(Math.min(declaredWidth, geometry.contentWidth), 1);
            expect(geometry.imageHeight).toBeCloseTo(geometry.imageWidth / (kind === "image.round" ? 1 : 16 / 9), 1);
            expect(geometry.overflow).toBe(0);
          }
        }
      }
    }
  });

  for (const [name, content, declaredWidth] of [
    ["a sized preview and actions", "  image width=200 Preview\n  text You are offline.\n  row.end\n    button Retry", 200],
    ["a sized avatar", "  image.round width=48 Ana\n  text Ana joined the workspace.", 48],
  ] as const) {
    test(`banner with ${name} keeps its intrinsic width in ${scheme}`, async ({ page }) => {
      for (const layout of ["fit-content", "flex-content", "grid-content", "inline-block", "float"] as const) {
        for (const width of [710, 320]) {
          const measurements = [];
          for (const tabs of ["", `\n${strip}`]) {
            await show(page, `banner.warning\n${content}${tabs}`, { scheme, host: "column", width, layout });
            const geometry = await page.locator(".wf-banner").evaluate((banner) => {
              const box = banner.getBoundingClientRect();
              const style = getComputedStyle(banner);
              const root = banner.closest(".wf-root")!;
              return {
                rootWidth: root.getBoundingClientRect().width,
                bannerWidth: box.width,
                overflow: root.scrollWidth - root.clientWidth,
                contentRight: box.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth),
                children: [...banner.querySelectorAll(".wf-banner-line > *")].map((node) => {
                  const rect = node.getBoundingClientRect();
                  return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, top: rect.top - box.top };
                }),
              };
            });
            expect(geometry.children[0]!.width, `${layout}, ${width}`).toBe(declaredWidth);
            expect(geometry.rootWidth).toBeGreaterThan(declaredWidth + geometry.children[1]!.width);
            expect(geometry.rootWidth).toBeLessThanOrEqual(width);
            for (const child of geometry.children) expect(child.right).toBeLessThanOrEqual(geometry.contentRight);
            // The preview's image and actions need more than a 320 px column.
            // All other cases fit at their natural width, without root scrolling.
            if (declaredWidth === 48 || width === 710) {
              expect(geometry.overflow).toBe(0);
              expect(geometry.rootWidth).toBeLessThan(width);
            }
            measurements.push(geometry);
          }
          expect(measurements[1]).toEqual(measurements[0]);
        }
      }
    });
  }

  for (const [name, source, declaredWidths] of [
    ["an unsized outer with actions", "banner.warning\n  icon alert-triangle\n  text Sync paused\n  banner\n    image width=80 Preview\n    text Draft\n  row.end\n    button Retry\n    button Dismiss\n    button Details", [80]],
    ["an unsized outer with two texts", "banner.warning\n  text.strong Offline\n  text Your changes will sync when you reconnect to the network.\n  banner\n    image width=80 Preview\n    text Draft", [80]],
    ["two levels", "banner\n  image width=100 Outer\n  text Outer\n  banner\n    image width=200 Inner\n    text Inner banner text that is fairly long", [100, 200]],
    ["three levels", "banner\n  image width=60 A\n  text One\n  banner\n    image width=80 B\n    text Two\n    banner\n      image width=120 C\n      text Three levels deep", [60, 80, 120]],
    ...[3, 4].map((depth) => [
      `${depth} equal-width levels`,
      Array.from({ length: depth }, (_, level) => `${"  ".repeat(level)}banner\n${"  ".repeat(level + 1)}image width=80 Image ${level}\n${"  ".repeat(level + 1)}text Level ${level} note`).join("\n"),
      Array.from({ length: depth }, () => 80),
    ] as const),
  ] as const) {
    test(`nested banners at ${name} keep image widths in ${scheme}`, async ({ page }) => {
      for (const layout of ["block", "fit-content", "flex-content", "grid-content", "inline-block", "float"] as const) {
        for (const width of [710, 400, 320]) {
          const measurements = [];
          for (const tabs of ["", `\n${strip}`]) {
            await show(page, `${source}${tabs}`, { scheme, host: "column", width, layout });
            // Source markers identify real images, excluding hidden sizing copies.
            const geometry = await page.locator(".wf-root").evaluate((root) => ({
              rootWidth: root.getBoundingClientRect().width,
              overflow: root.scrollWidth - root.clientWidth,
              widths: [...root.querySelectorAll(".wf-image[data-line]")].map((image) => image.getBoundingClientRect().width),
              enclosures: [...root.querySelectorAll(".wf-banner[data-line]")].map((banner) => {
                const box = banner.getBoundingClientRect();
                return [...banner.querySelectorAll(":scope > .wf-banner-line > *")].every((child) => {
                  const rect = child.getBoundingClientRect();
                  return rect.left >= box.left && rect.right <= box.right;
                });
              }),
            }));
            expect(geometry.widths, `${layout}, ${width}, tabs=${tabs !== ""}`).toEqual(declaredWidths);
            expect(geometry.rootWidth).toBeLessThanOrEqual(width);
            expect(geometry.enclosures.every(Boolean)).toBe(true);
            if (width === 710) expect(geometry.overflow).toBe(0);
            else if (!name.startsWith("an unsized")) expect(geometry.overflow).toBeGreaterThan(0);
            if (name === "two levels") await expect(page.locator(".wf-root")).toContainText("Inner", { useInnerText: true });
            measurements.push(geometry);
          }
          expect(measurements[1]).toEqual(measurements[0]);
        }
      }
    });
  }

  test(`a sized banner in a crowded row keeps its image beside siblings in ${scheme}`, async ({ page }) => {
    const row = "row\n  button Back\n  button Cancel\n  button Save draft\n  banner\n    image width=80 Inner\n    text Inner note\n  button Next";
    for (const layout of ["block", "fit-content", "grid-content"] as const) {
      for (const width of [710, 400, 320]) {
        for (const phone of [false, true]) {
          const measurements = [];
          for (const tabs of ["", "\n    tabs\n      option.current Overview\n      option Details"]) {
            const source = row.replace("\n  button Next", `${tabs}\n  button Next`);
            await show(page, phone ? `phone\n  dock\n${source.split("\n").map((line) => `    ${line}`).join("\n")}` : source, { scheme, host: "column", width, layout });
            const geometry = await page.locator(".wf-image[data-line]").evaluate((image) => {
              const banner = image.closest(".wf-banner")!;
              const wrap = banner.closest(".wf-banner-wrap")!;
              const previous = wrap.previousElementSibling!.getBoundingClientRect();
              const next = wrap.nextElementSibling!.getBoundingClientRect();
              const box = banner.getBoundingClientRect();
              return { imageWidth: image.getBoundingClientRect().width, left: box.left, right: box.right, previousRight: previous.right, nextLeft: next.left };
            });
            expect(geometry.imageWidth, `${layout}, ${width}, phone=${phone}`).toBe(80);
            expect(geometry.left).toBeGreaterThan(geometry.previousRight);
            expect(geometry.right).toBeLessThan(geometry.nextLeft);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            measurements.push(geometry);
          }
          expect(measurements[1]).toEqual(measurements[0]);
        }
      }
    }
  });

  for (const [name, row, imageWidth] of [
    ["wrapping text", "row\n  button Back\n  banner\n    image width=80 Preview\n    text Your draft is saved on this device and will sync with the workspace as soon as you reconnect to the network.\n  button Next", 80],
    ["fitting text", "row\n  button Back\n  banner\n    image width=48 Preview\n    text Your draft is saved here and will sync as soon as you get back online. Your edits stay here while you are away.\n  button Next", 48],
    ["a lone oversized image", "row\n  banner\n    image width=800 Preview", 800],
    ["an oversized image beside buttons", "row\n  button Back\n  banner\n    image width=9999 Preview\n    text Note\n  button Next", 9999],
    ["an oversized avatar", "row.between\n  banner\n    image.round width=9999 Ana\n    text Ana joined.", 9999],
  ] as const) {
    test(`a row banner preserves ${name} in ${scheme}`, async ({ page }) => {
      for (const layout of ["block", "fit-content", "grid-content"] as const) {
        for (const width of [710, 400, 320]) {
          for (const phone of [false, true]) {
            const measurements = [];
            for (const tabs of [false, true]) {
              const source = tabs ? row.replace(/(\n {2}button Next)?$/, "\n    tabs\n      option.current Overview\n      option Details$1") : row;
              await show(page, phone ? `phone\n  dock\n${source.split("\n").map((line) => `    ${line}`).join("\n")}` : source, { scheme, host: "column", width, layout });
              const geometry = await page.locator(".wf-image[data-line]").evaluate((image) => {
                const banner = image.closest(".wf-banner")!;
                const row = banner.closest(".wf-banner-wrap")!.parentElement!;
                const text = banner.querySelector(".wf-text[data-line]");
                const box = banner.getBoundingClientRect();
                const style = getComputedStyle(banner);
                const root = image.closest(".wf-root")!;
                const viewport = root.querySelector(".wf-phone-viewport") ?? root;
                const previous = banner.closest(".wf-banner-wrap")!.previousElementSibling;
                const next = banner.closest(".wf-banner-wrap")!.nextElementSibling;
                return {
                  imageWidth: image.getBoundingClientRect().width,
                  rowWidth: row.getBoundingClientRect().width,
                  cap: row.closest(".wf-row-size")!.getBoundingClientRect().width - Number.parseFloat(style.paddingLeft)
                    - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
                  left: box.left, right: box.right,
                  previousRight: previous?.getBoundingClientRect().right,
                  nextLeft: next?.getBoundingClientRect().left,
                  textHeight: text?.getBoundingClientRect().height ?? 0,
                  lineHeight: text ? Number.parseFloat(getComputedStyle(text).lineHeight) : 0,
                  rootOverflow: root.scrollWidth - root.clientWidth,
                  viewportOverflow: viewport.scrollWidth - viewport.clientWidth,
                  enclosed: [...banner.querySelectorAll(":scope > .wf-banner-line > *")].every((child) => child.getBoundingClientRect().right <= box.right),
                };
              });
              const context = `${layout}, ${width}, phone=${phone}, tabs=${tabs}`;
              expect(geometry.imageWidth, context).toBeGreaterThan(0);
              expect(geometry.imageWidth, context).toBeLessThanOrEqual(geometry.rowWidth);
              expect(geometry.imageWidth, context).toBeCloseTo(Math.min(imageWidth, geometry.cap), 1);
              expect(geometry.enclosed, context).toBe(true);
              if (geometry.previousRight !== undefined) expect(geometry.left, context).toBeGreaterThan(geometry.previousRight);
              if (geometry.nextLeft !== undefined) expect(geometry.right, context).toBeLessThan(geometry.nextLeft);
              if (name === "wrapping text" || name === "fitting text") {
                expect(geometry.imageWidth, context).toBe(imageWidth);
                expect(geometry.textHeight, context).toBeGreaterThan(geometry.lineHeight);
              }
              if (name === "fitting text" || name === "a lone oversized image" || (name === "wrapping text" && width >= 400)) {
                expect(geometry.rootOverflow, context).toBe(0);
                expect(geometry.viewportOverflow, context).toBe(0);
              }
              expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
              measurements.push(geometry);
            }
            expect(measurements[1]).toEqual(measurements[0]);
          }
        }
      }
    });
  }

  test(`row banner sizing composes with surrounding layouts and resizing in ${scheme}`, async ({ page }) => {
    for (const source of [
      "card width=240\n  row\n    banner\n      image width=9999 Preview\n      text Note",
      "row\n  button Back\n  card width=240\n    banner\n      image width=9999 Preview\n      text Note",
      "row.between\n  row\n    banner\n      image width=9999 Preview\n      text Note\n  button Next",
      // A scroll row contributes no intrinsic width; a sibling supplies the
      // host's natural width when the host itself sizes to content.
      "text Scroll preview\nrow.scroll\n  button Back\n  banner\n    image width=9999 Preview\n    text Note\n  button Next",
      "banner\n  image width=48 Outer\n  text Outer\n  row\n    button Back\n    banner\n      image width=9999 Preview\n      text Note\n    button Next",
      "dialog\n  row.end\n    button Back\n    banner\n      image width=9999 Preview\n      text Note\n    button Next",
      "dialog Confirm\n  text Save your changes before leaving?\n  row.end\n    button Cancel\n    banner\n      image width=80 Preview\n      text Draft saved\n    button Save\n    button Publish now",
      "dialog Invite\n  text Ana will join the workspace.\n  row.end\n    button Cancel\n    banner\n      image.round width=32 Ana\n      text Ana Lopez\n    button Send invite",
      "frame Preview\n  row\n    button Back\n    banner\n      image width=80 Preview\n      text Draft saved\n    button Next\n    button Another action",
      "page.browser\n  text.title Settings\n  row\n    button Back\n    banner\n      image width=80 Preview\n      text Saved\n    button Next\n    button Done",
      "phone\n  text Home\n  row\n    button Back\n    banner\n      image width=80 Preview\n      text Draft saved here\n    button Next\n    button More",
      "page width=256\n  row\n    button Back\n    banner\n      image width=80 Preview\n      text Draft saved\n    button Next",
      "page.window width=320 Settings\n  row\n    button Back\n    banner\n      image width=80 Preview\n      text Draft saved\n    button Next",
      "page\n  row\n    banner\n      image width=80 Preview\n      text Draft saved\n  card width=240\n    row\n      banner\n        image width=9999 Independent\n        text Note",
    ].flatMap((source) => [source, source.replace(/(^|\n)( *)banner(?=\n)/g, "$1$2banner\n$2  tabs\n$2    option.current Overview\n$2    option Details")])) {
      for (const layout of ["block", "fit-content", "grid-content"] as const) {
        await show(page, source, { scheme, host: "column", layout });
        for (const width of [710, 400, 320, 710]) {
          await page.locator(".column").evaluate((column, width) => { (column as HTMLElement).style.width = `${width}px`; }, width);
          const geometry = await page.locator(".wf-image[data-line]").last().evaluate((image) => {
            const banner = image.closest(".wf-banner")!;
            const style = getComputedStyle(banner);
            let boundary = image.parentElement!;
            while (getComputedStyle(boundary).containerType !== "inline-size") boundary = boundary.parentElement!;
            const insets = (style: CSSStyleDeclaration) => Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
              + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth);
            let available = boundary.getBoundingClientRect().width - insets(getComputedStyle(boundary));
            if (boundary.classList.contains("wf-content-size")) {
              const ancestors = [];
              for (let parent = banner.parentElement!; parent !== boundary; parent = parent.parentElement!) ancestors.unshift(parent);
              for (const parent of ancestors) {
                const style = getComputedStyle(parent);
                if (parent.classList.contains("wf-dialog-card")) available = Math.min(available, 32 * Number.parseFloat(style.fontSize));
                available -= insets(style);
              }
            }
            return {
              imageWidth: image.getBoundingClientRect().width,
              declaredWidth: Number.parseFloat((image as HTMLElement).style.getPropertyValue("--_wf-width")),
              cap: available - insets(style),
              enclosures: [...image.closest(".wf-root")!.querySelectorAll(".wf-banner[data-line], .wf-row[data-line], .wf-dialog, .wf-dialog-card, .wf-page, .wf-page-content, .wf-frame, .wf-phone-content")].filter((element) => !element.closest('[aria-hidden="true"]')).map((element) => {
                const box = element.getBoundingClientRect();
                const children = element.classList.contains("wf-banner") ? element.querySelectorAll(":scope > .wf-banner-line > *") : element.children;
                // Scroll rows contain overflow rather than expanding to enclose it.
                return { kind: element.className, enclosed: element.classList.contains("wf-scroll") || [...children].every((child) => {
                  const real = child.matches(".wf-row-wrap, .wf-banner-wrap, .wf-content-wrap") ? child.querySelector(":scope > :is(.wf-row-size, .wf-banner-size, .wf-content-size) > *")! : child;
                  return real.getBoundingClientRect().right <= box.right - Number.parseFloat(getComputedStyle(element).paddingRight) + 0.1;
                }) };
              }),
            };
          });
          expect(geometry.imageWidth, `${source}, ${layout}, ${width}`).toBeCloseTo(Math.min(geometry.declaredWidth, geometry.cap), 1);
          expect(geometry.enclosures, `${source}, ${layout}, ${width}`).toEqual(geometry.enclosures.map(({ kind }) => ({ kind, enclosed: true })));
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
    }
  });

  test(`nested banner image caps follow the outer available width in ${scheme}`, async ({ page }) => {
    for (const kind of ["image", "image.round"]) {
      for (const sizedOuter of [false, true]) {
        for (const layout of ["block", "fit-content", "grid-content"] as const) {
          for (const tabs of ["", `\n${strip}`]) {
            const source = `banner\n${sizedOuter ? "  image width=80 Outer\n" : ""}  text Outer\n  banner\n    text Middle\n    banner\n      ${kind} width=9999 Inner\n      text Inner${tabs}`;
            await show(page, source, { scheme, host: "column", layout });
            for (const width of [710, 400, 320, 710]) {
              await page.locator(".column").evaluate((column, width) => { (column as HTMLElement).style.width = `${width}px`; }, width);
              const geometry = await page.locator(".wf-root").evaluate((root) => {
                const boundary = root.querySelector(".wf-banner-size")!;
                const outer = boundary.querySelector(".wf-banner")!;
                const style = getComputedStyle(outer);
                const images = [...root.querySelectorAll(".wf-image[data-line]")];
                const inner = images.at(-1)!.getBoundingClientRect();
                return {
                  rootWidth: root.getBoundingClientRect().width,
                  overflow: root.scrollWidth - root.clientWidth,
                  cap: boundary.getBoundingClientRect().width - Number.parseFloat(style.paddingLeft)
                    - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
                  widths: images.map((image) => image.getBoundingClientRect().width),
                  height: inner.height,
                };
              });
              expect(geometry.rootWidth).toBeLessThanOrEqual(width);
              expect(geometry.widths.slice(0, -1)).toEqual(sizedOuter ? [80] : []);
              expect(geometry.widths.at(-1)).toBeCloseTo(geometry.cap, 1);
              expect(geometry.widths.at(-1)).toBeGreaterThan(0);
              expect(geometry.height).toBeCloseTo(geometry.cap / (kind === "image.round" ? 1 : 16 / 9), 1);
              expect(geometry.overflow).toBeGreaterThan(0);
              expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            }
          }
        }
      }
    }
  });

  test(`banner image caps follow host resizing and themed insets in ${scheme}`, async ({ page }) => {
    const host = await show(page, `banner\n${strip}\n  image width=800 Preview\n${strip}\n  image.round width=9999 Ana`, { scheme, host: "column" });
    await host.evaluate((host) => {
      host.style.setProperty("--wf-text-size", "20px");
      host.style.setProperty("--wf-stroke", "3px");
    });
    for (const width of [710, 320, 710]) {
      await page.locator(".column").evaluate((column, width) => { (column as HTMLElement).style.width = `${width}px`; }, width);
      const geometry = await page.locator(".wf-banner").evaluate((banner) => {
        const box = banner.getBoundingClientRect();
        const style = getComputedStyle(banner);
        const root = banner.closest(".wf-root")!;
        return {
          contentWidth: box.width - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth)
            - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
          widths: [...banner.querySelectorAll(".wf-image, .wf-tabs")].map((node) => node.getBoundingClientRect().width),
          overflow: root.scrollWidth - root.clientWidth,
        };
      });
      for (const childWidth of geometry.widths) expect(childWidth).toBeCloseTo(geometry.contentWidth, 1);
      expect(geometry.overflow).toBe(0);
    }
  });

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
