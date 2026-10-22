import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

describe("tabs", () => {
  it.each([
    ["settings", "Wireframe: window “Settings”"],
    ["activity", "Wireframe: card “No activity in the last 7 days.”"],
    ["overflow", "Wireframe: card “Scroll the tabs to see more sections.”"],
  ])("parses and draws the %s example without diagnostics", (name, summary) => {
    const source = readFileSync(join(import.meta.dirname, `../examples/navigation/4-tab-bars/${name}.wireframe`), "utf8");
    const parsed = parseWireframe(source);
    expect(parsed.diagnostics).toEqual([]);
    expect(summarizeWireframe(parsed)).toBe(summary);
    const root = renderWireframe(parsed)!;
    expect(root.querySelectorAll(".wf-tabs")).toHaveLength(1);
    expect(root.querySelectorAll(".wf-tabs > .wf-option.wf-current")).toHaveLength(1);
    expect(root.querySelector("[tabindex], [onclick], a, button, input, select, script, [role=tab]")).toBeNull();
    if (name === "activity") {
      const option = root.querySelector(".wf-current")!;
      expect(option.children[0]!.classList.contains("wf-icon")).toBe(true);
      expect(option.children[1]!.textContent).toBe("Activity");
    }
  });

  it.each(["dialog", "banner", "page", "page.browser", "page.window", "frame", "phone", "card"])(
    "accepts a strip with an id directly in %s without naming its root", (kind) => {
      const parsed = parseWireframe(`${kind}\n  tabs#sections\n    option.current General\n    option Accounts`);
      expect(parsed.diagnostics).toEqual([]);
      expect(summarizeWireframe(parsed)).toBe(summarizeWireframe(parseWireframe(kind)));
      const tabs = renderWireframe(parsed)!.querySelector(".wf-tabs")!;
      expect(tabs.getAttribute("data-line")).toBe("2");
      expect(tabs.querySelectorAll(".wf-option")).toHaveLength(2);
      expect(tabs.querySelector("#sections")).toBeNull();
    },
  );

  it("accepts empty strips and strips without a current tab", () => {
    const parsed = parseWireframe("card\n  tabs\n  tabs\n    option First\n    option Second");
    expect(parsed.diagnostics).toEqual([]);
    expect(renderWireframe(parsed)!.querySelectorAll(".wf-current")).toHaveLength(0);
  });

  it("keeps banner content, unsupported labels and multiple strips in source order", () => {
    const parsed = parseWireframe("banner Unexpected\n  tabs\n    option.current First\n  text Between\n  row.end\n    button Go\n  tabs\n  tabs\n    option.current Last\n  text After");
    const banner = renderWireframe(parsed)!.querySelector(".wf-banner")!;
    expect(banner.textContent).toBe("UnexpectedFirstBetweenGoLastAfter");
    expect([...banner.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(["2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(banner.querySelectorAll(":scope > .wf-tabs")).toHaveLength(3);
    expect(banner.querySelectorAll(".wf-tabs > .wf-option")).toHaveLength(2);
  });

  it("warns at each later current option and renders only the first current in each strip", () => {
    const parsed = parseWireframe("page\n  tabs\n    option Before\n    option.current First\n    option.current Second\n    option.current Third\n  tabs\n    option.current Independent");
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics).toEqual([5, 6].map((line) => ({
      line, severity: "warning", message: "tabs takes one current option: the first is used",
    })));
    expect(parsed.nodes[0]!.children[0]!.children[2]!.variants).toEqual(["current"]);
    const root = renderWireframe(parsed)!;
    expect([...root.querySelectorAll(".wf-current")].map((node) => node.textContent)).toEqual(["First", "Independent"]);
    expect([...root.querySelectorAll(".wf-option")].map((node) => node.textContent)).toEqual(["Before", "First", "Second", "Third", "Independent"]);
  });

  it("keeps sized banner images and strips in source order inside their sizing boundary", () => {
    const parsed = parseWireframe("banner.warning\n  image width=9999 Preview\n  tabs\n    option.current First\n  text After\nbanner\n  image width=invalid Preview");
    const root = renderWireframe(parsed)!;
    const banners = root.querySelectorAll(".wf-banner");
    expect(root.querySelectorAll(".wf-banner-size")).toHaveLength(1);
    expect(banners[0]!.parentElement!.className).toBe("wf-banner-size");
    expect(banners[1]!.parentElement).toBe(root);
    expect([...banners[0]!.children].map((node) => node.className)).toEqual(["wf-banner-line", "wf-tabs", "wf-banner-line"]);
    expect([...root.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(banners[0]!.querySelector<HTMLElement>(".wf-image")!.style.getPropertyValue("--_wf-width")).toBe("9999px");
    const intrinsic = root.querySelector(".wf-banner-intrinsic")!;
    expect(intrinsic.getAttribute("aria-hidden")).toBe("true");
    expect(intrinsic.querySelector("[data-line], .wf-tabs, .wf-banner-intrinsic")).toBeNull();
  });

  it("keeps one source annotation per node when an unsized banner inherits a nested sizing boundary", () => {
    const parsed = parseWireframe("banner\n  text Outer\n  banner\n    image width=80 Preview\n    text Draft\n  tabs\n    option.current Overview");
    const root = renderWireframe(parsed)!;
    expect(root.firstElementChild!.className).toBe("wf-banner-wrap");
    expect(root.querySelectorAll(".wf-banner[data-line]")).toHaveLength(2);
    expect([...root.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    const copy = root.querySelector(":scope > .wf-banner-wrap > .wf-banner-intrinsic")!;
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.querySelector("[data-line], .wf-banner-size, .wf-tabs")).toBeNull();
    expect(copy.querySelectorAll(".wf-banner-intrinsic")).toHaveLength(1);
  });

  it("keeps row sizing copies hidden and source annotations unique through nested boundaries", () => {
    const parsed = parseWireframe("row\n  button Back\n  row\n    banner\n      image width=9999 Preview\n      row\n        banner\n          image width=80 Inner\n      tabs\n        option.current Overview\n  button Next");
    const root = renderWireframe(parsed)!;
    expect(root.firstElementChild!.className).toBe("wf-row-wrap");
    expect([...root.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(Array.from({ length: 11 }, (_, index) => String(index + 1)));
    const copy = root.querySelector(":scope > .wf-row-wrap > .wf-row-intrinsic")!;
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.querySelector("[data-line], .wf-banner-size, .wf-row-size, .wf-tabs")).toBeNull();
    expect(copy.querySelectorAll(".wf-image")).toHaveLength(2);
    expect(root.querySelectorAll(".wf-image[data-line]")).toHaveLength(2);
  });

  it("keeps toggle and dock behavior when several options are current", () => {
    for (const prefix of ["page\n  toggle\n", "phone\n  dock\n    toggle\n"]) {
      const indent = prefix.includes("dock") ? "      " : "    ";
      const parsed = parseWireframe(`${prefix}${indent}option.current First\n${indent}option.current Second`);
      expect(parsed.diagnostics).toEqual([]);
      expect(renderWireframe(parsed)!.querySelectorAll(".wf-toggle > .wf-current")).toHaveLength(2);
    }
  });

  it.each(["dialog Confirm", "page", "page.browser", "frame Preview", "phone"])("keeps %s content sizing copies hidden without duplicating source annotations", (kind) => {
    const source = `${kind}\n  row.end\n    button Cancel\n    banner\n      image width=80 Preview\n      text Draft saved\n      tabs\n        option.current Overview\n    button Save\n  card width=240\n    row\n      banner\n        image width=9999 Independent`;
    const root = renderWireframe(parseWireframe(source))!;
    expect([...root.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(Array.from({ length: 13 }, (_, index) => String(index + 1)));
    const scope = root.querySelector(".wf-content-size")!;
    expect(scope.querySelectorAll(".wf-content-row")).toHaveLength(1);
    const copy = root.querySelector(".wf-content-intrinsic")!;
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.querySelector("[data-line], .wf-content-row, .wf-banner-size, .wf-row-size, .wf-content-size")).toBeNull();
    expect(copy.querySelectorAll(".wf-image")).toHaveLength(2);
    expect(root.querySelectorAll(".wf-image[data-line]")).toHaveLength(2);
  });

  it.each([
    ["top level", "\ntabs", 2],
    ...[...KINDS.keys(), "unknown"].filter((kind) => !["dialog", "banner", "page", "frame", "phone", "card"].includes(kind))
      .map((kind) => [kind, `${kind}\n  tabs`, 2]),
    ["table row", "page\n  table\n    row\n      tabs", 4],
  ])("warns about placement in %s and still draws the strip", (_place, source, line) => {
    const parsed = parseWireframe(source as string);
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([{
      line, severity: "warning", message: "tabs must be directly inside dialog, banner, page, frame, phone or card",
    }]);
    expect(renderWireframe(parsed)!.querySelector(`.wf-tabs[data-line="${line}"]`)).not.toBeNull();
  });

  it("warns about unsupported source and retains labels and misplaced children as inert text", () => {
    const parsed = parseWireframe('card\n  tabs.pills#sections label=Hidden width=400 <script>\n    text Child\n    option.current Caption\n      icon activity\n      icon user');
    expect(parsed.diagnostics).toEqual([
      { line: 2, severity: "warning", message: 'unknown variant ".pills": tabs takes no variants' },
      { line: 2, severity: "warning", message: 'attribute "label" is only allowed on input or select' },
      { line: 2, severity: "warning", message: 'attribute "width" is only allowed on page, card or image' },
      { line: 2, severity: "warning", message: "tabs takes no label" },
      { line: 3, severity: "warning", message: "text must be directly inside dialog, banner, page, frame, phone, dock, card or row" },
      { line: 6, severity: "warning", message: "option takes only one icon" },
    ]);
    const tabs = renderWireframe(parsed)!.querySelector(".wf-tabs")!;
    expect(tabs.className).toBe("wf-tabs");
    expect(tabs.getAttribute("style")).toBeNull();
    expect(tabs.textContent).toBe("<script>ChildCaption");
    expect(tabs.querySelectorAll(".wf-icon")).toHaveLength(2);
    expect(tabs.querySelector("script")).toBeNull();
  });

  it("lists tabs among the expected kinds and names both option parents", () => {
    expect(parseWireframe("unknown").diagnostics[0]!.message).toContain("toggle, tabs, option");
    expect(parseWireframe("option Caption").diagnostics).toEqual([{
      line: 1, severity: "warning", message: "option must be directly inside toggle or tabs",
    }]);
  });
});
