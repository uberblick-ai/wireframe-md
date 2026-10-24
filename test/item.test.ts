import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const warning = (line: number, message: string) => ({ line, severity: "warning", message });
const placement = "item must be directly inside dialog, banner, page, frame, phone or card";
const picture = "item takes one icon or image.round as its first child";

describe("list items", () => {
  it("draws the example with compact lines, decorative leading pictures and inert states", () => {
    const source = readFileSync(join(import.meta.dirname, "../examples/navigation/5-list-entries/revision-history.wireframe"), "utf8");
    const parsed = parseWireframe(source);
    expect(parsed.diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    expect(root.querySelectorAll(".wf-item")).toHaveLength(6);
    expect(root.querySelectorAll(".wf-item.wf-current")).toHaveLength(2);
    expect(root.querySelectorAll('.wf-item > .wf-item-leading[aria-hidden="true"]')).toHaveLength(4);
    expect(root.querySelector(".wf-item .wf-mono")!.textContent).toBe("e9faf4df");
    expect(root.querySelector("[tabindex], [onclick], a, button, input, select, script, [aria-selected], [aria-current], [role=listbox]"))
      .toBeNull();
  });

  it.each(["dialog", "banner", "page", "page.browser", "page.window", "frame", "phone", "card"])(
    "accepts entries in %s without naming the container in its summary", (kind) => {
      const parsed = parseWireframe(`${kind}\n  item#first Plain\n    text.small.muted Metadata\n  item.current Current\n    text.strong Details`);
      expect(parsed.diagnostics).toEqual([]);
      expect(summarizeWireframe(parsed)).toBe(summarizeWireframe(parseWireframe(kind)));
      const items = renderWireframe(parsed)!.querySelectorAll(".wf-item");
      expect(items[0]!.textContent).toBe("PlainMetadata");
      expect(items[1]!.textContent).toBe("Current, currentDetails");
      expect(items[1]!.querySelector(".wf-item-label")!.textContent).toBe("Current, current");
      expect(items[1]!.querySelector(".wf-item-state")!.getAttribute("aria-hidden")).toBeNull();
      expect(items[0]!.getAttribute("data-line")).toBe("2");
      expect(items[0]!.id).toBe("");
    },
  );

  it.each(["dialog", "banner", "page", "frame", "phone", "card"])(
    "keeps only the first current entry in a %s and keeps nested cards independent", (kind) => {
      const independent = kind === "card" ? "card\n  item.current Independent" : "  card\n    item.current Independent";
      const parsed = parseWireframe(`${kind}\n  item Before\n  item.current First\n  item.current Second\n  item.current Third\n${independent}`);
      expect(parsed.diagnostics).toEqual([4, 5].map((line) => warning(line, `${kind} takes one current item: the first is used`)));
      expect(parsed.nodes[0]!.children[2]!.variants).toEqual(["current"]);
      const root = renderWireframe(parsed)!;
      expect([...root.querySelectorAll(".wf-item.wf-current")].map((node) => node.textContent))
        .toEqual(["First, current", "Independent, current"]);
      expect(root.querySelectorAll(".wf-item-state")).toHaveLength(2);
      expect(root.querySelector('.wf-item[data-line="4"]')!.textContent).toBe("Second");
    },
  );

  it("keeps banner entries on separate lines in source order, including sizing copies", () => {
    const parsed = parseWireframe("banner\n  image width=9999 Preview\n  text Before\n  item.current First\n    text.small.muted Metadata\n  item Second\n  text After\n  row.end\n    button Go");
    expect(parsed.diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    expect([...root.querySelector(".wf-banner")!.children].map((node) => node.className))
      .toEqual(["wf-banner-line", "wf-item wf-current", "wf-item", "wf-banner-line"]);
    const copy = root.querySelector(".wf-banner-intrinsic")!;
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.querySelector("[data-line], .wf-item")).toBeNull();
    expect([...root.querySelectorAll("[data-line]")].map((node) => node.getAttribute("data-line")))
      .toEqual(Array.from({ length: 9 }, (_, index) => String(index + 1)));
  });

  it.each([
    ["top level", "item Label", 1],
    ...[...KINDS.keys(), "unknown"].filter((kind) => !["dialog", "banner", "page", "frame", "phone", "card"].includes(kind))
      .map((kind) => [kind, `${kind}\n  item Label`, 2]),
    ["table row", "page\n  table\n    row\n      item Label", 4],
  ])("warns about placement in %s and still draws", (_place, source, line) => {
    const parsed = parseWireframe(source as string);
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([warning(line as number, placement)]);
    expect(renderWireframe(parsed)!.querySelector(`.wf-item[data-line="${line}"] .wf-item-label`)!.textContent).toBe("Label");
  });

  it.each(["icon robot", "icon.filled.blue circle", "image.round", "image.round width=32 Avatar"])("accepts %s before every text variant", (leading) => {
    const parsed = parseWireframe(`card\n  item Label\n    ${leading}\n    text.title Heading\n    text.strong.green Strong\n    text.small.muted Small\n    text.bg-red Removed`);
    expect(parsed.diagnostics).toEqual([]);
    const item = renderWireframe(parsed)!.querySelector(".wf-item")!;
    expect(item.children[0]!.classList.contains("wf-item-leading")).toBe(true);
    expect(item.querySelectorAll(".wf-item-lines > .wf-text")).toHaveLength(4);
  });

  it.each([
    ["    image Cover", [3]],
    ["    image.square Cover", [3]],
    ["    icon robot\n    icon user", [4]],
    ["    icon robot\n    image.round Avatar", [4]],
    ["    image.round Avatar\n    icon robot", [4]],
    ["    image.round Avatar\n    image.round Second", [4]],
    ["    text Details\n    icon robot\n    image.round Avatar", [4, 5]],
  ] as const)("warns about unsupported pictures and still draws: %s", (children, lines) => {
    const parsed = parseWireframe(`card\n  item Label\n${children}`);
    expect(parsed.diagnostics).toEqual(lines.map((line) => warning(line, picture)));
    const item = renderWireframe(parsed)!.querySelector(".wf-item")!;
    expect(item.querySelectorAll("[data-line]")).toHaveLength(children.split("\n").length);
  });

  it("uses the first competing image shape for leading-picture validation", () => {
    const parsed = parseWireframe("card\n  item Label\n    image.square.round Wrong\n  item Label\n    image.round.square Right");
    expect(parsed.diagnostics).toEqual([
      warning(3, "image takes one of .square or .round: the first is used"), warning(3, picture),
      warning(5, "image takes one of .square or .round: the first is used"),
    ]);
    const root = renderWireframe(parsed)!;
    expect(root.querySelectorAll(".wf-item-leading")).toHaveLength(1);
    expect(root.querySelector(".wf-item-leading")!.getAttribute("data-line")).toBe("5");
  });

  it.each([...KINDS.keys(), "unknown"].filter((kind) => !["text", "icon", "image", "mark"].includes(kind)))(
    "warns about a child %s and retains its drawing", (kind) => {
      const parsed = parseWireframe(`card\n  item Label\n    ${kind} Unexpected`);
      expect(parsed.renderable).toBe(true);
      expect(parsed.diagnostics.some((diagnostic) => diagnostic.line === 3)).toBe(true);
      expect(renderWireframe(parsed)!.querySelector('.wf-item [data-line="3"]')).not.toBeNull();
    },
  );

  it("escapes labels and keeps unsupported variants and attributes inert", () => {
    const parsed = parseWireframe('card\n  item.selected width=9999 label=Hidden <script>alert(1)</script>\n    text <img src=x onerror=alert(1)>');
    expect(parsed.diagnostics).toEqual([
      warning(2, 'unknown variant ".selected" on item: expected .current'),
      warning(2, 'attribute "width" is only allowed on page, card or image'),
      warning(2, 'attribute "label" is only allowed on input or select'),
    ]);
    const item = renderWireframe(parsed)!.querySelector(".wf-item")!;
    expect(item.className).toBe("wf-item");
    expect(item.getAttribute("style")).toBeNull();
    expect(item.querySelector("script, img, [onerror]")).toBeNull();
    expect(item.textContent).toBe("<script>alert(1)</script><img src=x onerror=alert(1)>");
  });
});
