import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe, type WireframeNode, type WireframeParseResult } from "../src/index.js";
import { ICONS } from "../src/vocabulary.js";
import { archivedBanner, cardBlock, deleteConfirmation, documentList, figmaPrivate, figmaReading, vocabulary } from "./samples.js";

/** Render a source that must render, with or without warnings. */
const render = (source: string): HTMLElement => {
  const result = parseWireframe(source);
  expect(result.renderable).toBe(true);
  const root = renderWireframe(result);
  expect(root).not.toBeNull();
  return root!;
};

/**
 * The drawn tree, one line per element: its tag, classes and own text, indented
 * by depth. `div.wf-button.wf-danger Delete`.
 */
const outline = (element: Element, depth = 0): string[] => {
  const own = [...element.childNodes]
    .filter((child) => child.nodeType === child.TEXT_NODE)
    .map((child) => child.textContent)
    .join("");
  const head = [element.localName, ...element.classList].join(".");
  return [
    `${"  ".repeat(depth)}${head}${own === "" ? "" : ` ${own}`}`,
    ...[...element.children].flatMap((child) => outline(child, depth + 1)),
  ];
};

/** The outline of the root's content. */
const drawn = (source: string): string[] => outline(render(source)).slice(1).map((line) => line.slice(2));

const count = (nodes: readonly WireframeNode[]): number => nodes.reduce((sum, n) => sum + 1 + count(n.children), 0);

describe("samples", () => {
  it("draws the Card block with its small muted label, title, body and footer", () => {
    expect(drawn(cardBlock)).toEqual([
      "div.wf-card",
      "  div.wf-text.wf-small.wf-muted MORE AUTONOMY",
      "  div.wf-text.wf-title Let the launcher install dependencies",
      "  div.wf-text Add the documented block to ub-agents.yaml: …",
      "  div.wf-text.wf-small.wf-muted UB-AGENTS.YAML · 2 RUNS STARTED WITHOUT THE CORPUS · #1072 #1304",
    ]);
  });

  it("draws the reading frame's label and actions above a text-only card and caption", () => {
    expect(drawn(figmaReading)).toEqual([
      "div.wf-frame",
      "  div.wf-frame-caption",
      "    div.wf-frame-label Figma · Payment, mobile",
      "    div.wf-frame-actions",
      "      span.wf-button.wf-link",
      "        span.wf-button-caption Expand",
      "      span.wf-button.wf-link",
      "        span.wf-button-caption Open in Figma",
      "  div.wf-card",
      "    div.wf-text.wf-muted (the frame, live from Figma)",
      "    div.wf-text Click to interact",
      "  div.wf-text Card form after the address step. Error states are on the next frame.",
    ]);
  });

  it("keeps the private frame's Load button in its body row", () => {
    const root = render(figmaPrivate);
    expect(root.querySelector(".wf-frame-actions")!.textContent).toBe("Open in Figma");
    expect(root.querySelector(".wf-frame > .wf-row > .wf-button")!.textContent).toBe("Load");
    expect(root.querySelectorAll("[data-line]")).toHaveLength(5);
  });

  it("draws the delete confirmation as a card on a scrim, with its title, body and buttons", () => {
    expect(drawn(deleteConfirmation)).toEqual([
      "div.wf-dialog",
      "  div.wf-dialog-card",
      "    div.wf-dialog-title Delete “Q3 launch draft”?",
      "    div.wf-text It will be gone for everyone, with its comments and history. Links to it will show it was deleted. This can't be undone.",
      "    div.wf-row.wf-end",
      "      span.wf-button.wf-focus Cancel",
      "      span.wf-button.wf-danger Delete",
    ]);
  });

  it("draws the archived banner as a warning strip with its icon, text and buttons", () => {
    expect(drawn(archivedBanner)).toEqual([
      "div.wf-banner.wf-warning",
      "  span.wf-icon",
      "    svg.wf-icon-glyph.wf-icon-outline",
      "      path",
      "      path",
      "      path",
      "  div.wf-text Archived. Read-only and hidden from the document list.",
      "  div.wf-row.wf-end",
      "    span.wf-button Restore",
      "    span.wf-button.wf-link.wf-danger",
      "      span.wf-button-caption Delete…",
    ]);
  });

  it("draws the document list as a framed page: title, count, search, filters and a table of cells", () => {
    expect(drawn(documentList)).toEqual([
      "div.wf-page",
      "  div.wf-text.wf-title All documents",
      "  div.wf-text.wf-muted 24 documents",
      "  div.wf-input Search titles",
      "  div.wf-row",
      "    div.wf-toggle",
      "      span.wf-option.wf-current Documents",
      "      span.wf-option Decisions",
      "    span.wf-select Any tag",
      "      svg.wf-select-caret",
      "        path",
      "  div.wf-table",
      "    div.wf-row.wf-head",
      "      div.wf-cell Title",
      "      div.wf-cell Group",
      "      div.wf-cell Tags",
      "      div.wf-cell.wf-end Changed",
      "      div.wf-cell",
      "    div.wf-row",
      "      div.wf-cell Web UI system",
      "      div.wf-cell Getting started",
      "      div.wf-cell",
      "        span.wf-chip web",
      "        span.wf-chip spec",
      "        span.wf-chip.wf-more +2",
      "      div.wf-cell.wf-end 2 hours ago",
      "      div.wf-cell",
      "        span.wf-button.wf-link.wf-has-icon.wf-icon-only",
      "          span.wf-icon",
      "            svg.wf-icon-glyph.wf-icon-outline",
      "              path",
      "              path",
      "              path",
      "    div.wf-row",
      "      div.wf-cell Card blocks",
      "      div.wf-cell",
      "      div.wf-cell",
      "        span.wf-chip markdown",
      "      div.wf-cell.wf-end 3 days ago",
      "      div.wf-cell",
      "        span.wf-button.wf-link.wf-has-icon.wf-icon-only",
      "          span.wf-icon",
      "            svg.wf-icon-glyph.wf-icon-outline",
      "              path",
      "              path",
      "              path",
    ]);
  });

  it("returns one root element with the wireframe's class", () => {
    const root = render(deleteConfirmation);
    expect(root.localName).toBe("div");
    expect(root.className).toBe("wf-root");
    expect(root.isConnected).toBe(false);
  });

  it("marks each node's element with its line", () => {
    const root = render(archivedBanner);
    expect([...root.querySelectorAll("[data-line]")].map((element) => element.getAttribute("data-line"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });

  it("uses the document it is given", () => {
    const other = document.implementation.createHTMLDocument();
    const root = renderWireframe(parseWireframe(deleteConfirmation), other);
    expect(root?.ownerDocument).toBe(other);
  });
});

describe("kinds and variants", () => {
  it.each(["red", "amber", "green", "blue"])("draws %s icons and text without changing their other variants or summary", (hue) => {
    const source = `page\n  icon.${hue} dots-vertical\n  icon.filled.${hue} point\n  text.small.strong.${hue} State`;
    const root = render(source);
    expect(root.querySelector(".wf-icon-outline")?.getAttribute("aria-label")).toBe(`${hue} dots vertical`);
    expect(root.querySelector(".wf-icon-filled")?.getAttribute("aria-label")).toBe(`${hue} point`);
    const text = root.querySelector(".wf-text")!;
    expect(text.className).toBe(`wf-text wf-small wf-strong wf-${hue}`);
    expect(text.hasAttribute("aria-label")).toBe(false);
    expect(summarizeWireframe(parseWireframe(source))).toBe(summarizeWireframe(parseWireframe("page\n  icon dots-vertical\n  icon.filled point\n  text.small.strong State")));
  });

  it("draws only the first colour in source order, keeping non-colour variants", () => {
    for (const hue of ["red", "amber", "green", "blue"]) {
      const root = render(`page\n  icon.${hue}.filled.blue.red.amber.green point\n  text.small.${hue}.strong.muted.blue.red.amber.green State`);
      expect(root.querySelector(".wf-icon")?.className).toBe(`wf-icon wf-${hue} wf-filled`);
      expect(root.querySelector(".wf-icon-glyph")?.getAttribute("aria-label")).toBe(`${hue} point`);
      expect(root.querySelector(".wf-text")?.className).toBe(`wf-text wf-small wf-${hue} wf-strong`);
    }
    expect(render("page\n  text.muted.strong.red State").querySelector(".wf-text")?.className).toBe("wf-text wf-muted wf-strong");
  });

  it("adds no colour for an unknown or misplaced hue", () => {
    const root = render("page\n  icon.purple point\n  text.purple State\n  row\n    chip.red Tag\n    button.green Save");
    expect(root.querySelector(".wf-icon")?.className).toBe("wf-icon");
    expect(root.querySelector(".wf-icon-glyph")?.getAttribute("aria-label")).toBe("point");
    expect(root.querySelector(".wf-text")?.className).toBe("wf-text");
    expect(root.querySelector(".wf-chip")?.className).toBe("wf-chip");
    expect(root.querySelector(".wf-button")?.className).toBe("wf-button");
  });

  it("draws title-only cards at the top level and small text with other variants", () => {
    expect(drawn("card\n  text.title Title\ncard\n  text.small.strong Small bold text")).toEqual([
      "div.wf-card", "  div.wf-text.wf-title Title",
      "div.wf-card", "  div.wf-text.wf-small.wf-strong Small bold text",
    ]);
  });

  it("still draws misplaced card children, nested cards, unknown variants and icons", () => {
    const source = "card.big\n  row\n    card\n      text.title Nested\n  icon unknown\n  text.highlight Body";
    expect(parseWireframe(source).diagnostics).toHaveLength(4);
    expect(drawn(source)).toEqual([
      "div.wf-card", "  div.wf-row", "    div.wf-card", "      div.wf-text.wf-title Nested",
      "  span.wf-icon", "    span.wf-icon-unknown unknown", "  div.wf-text Body",
    ]);
  });

  it("omits an empty frame caption and handles a label or buttons alone", () => {
    expect(drawn("frame\n  text Body")).toEqual(["div.wf-frame", "  div.wf-text Body"]);
    expect(drawn("frame Caption")).toEqual([
      "div.wf-frame", "  div.wf-frame-caption", "    div.wf-frame-label Caption",
    ]);
    expect(drawn("frame\n  button.link Copy")).toEqual([
      "div.wf-frame", "  div.wf-frame-caption", "    div.wf-frame-actions", "      span.wf-button.wf-link", "        span.wf-button-caption Copy",
    ]);
  });

  it("keeps caption buttons in source order even when body nodes occur between them", () => {
    const root = render("frame Caption\n  button.primary First\n  text Body\n  button.link Second\n  row\n    button Third");
    expect([...root.querySelectorAll(".wf-frame-actions > .wf-button")].map((button) => button.textContent)).toEqual(["First", "Second"]);
    expect(root.querySelector(".wf-frame > .wf-row")!.textContent).toBe("Third");
  });

  it("draws an empty card and stacks its text lines without a caption", () => {
    expect(drawn("frame\n  card\n  card\n    text.strong Title\n    text Body")).toEqual([
      "div.wf-frame", "  div.wf-card", "  div.wf-card", "    div.wf-text.wf-strong Title", "    div.wf-text Body",
    ]);
  });

  it("draws field names above their placeholders and values, alone and in a row", () => {
    const source = 'page\n  input label="Email address" name@company.com\n  select label=Role Editor\n  row\n    input label="First name" First\n    select label=Team Engineering';
    expect(drawn(source)).toEqual([
      "div.wf-page",
      "  div.wf-field",
      "    div.wf-field-label Email address",
      "    div.wf-input name@company.com",
      "  div.wf-field",
      "    div.wf-field-label Role",
      "    span.wf-select Editor",
      "      svg.wf-select-caret",
      "        path",
      "  div.wf-row",
      "    div.wf-field",
      "      div.wf-field-label First name",
      "      div.wf-input First",
      "    div.wf-field",
      "      div.wf-field-label Team",
      "      span.wf-select Engineering",
      "        svg.wf-select-caret",
      "          path",
    ]);
    expect([...render(source).querySelectorAll("[data-line]")].map((element) => element.getAttribute("data-line")))
      .toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("draws only the first label, including an empty one", () => {
    const root = render('page\n  input label=Email label=Ignored Hint\n  select label= label=Ignored');
    expect([...root.querySelectorAll(".wf-field-label")].map((label) => label.textContent)).toEqual(["Email", ""]);
    expect(root.querySelector(".wf-input")?.textContent).toBe("Hint");
    expect(root.querySelector(".wf-select-caret")).not.toBeNull();
  });

  it("keeps wrong-kind labels inert and still draws their nodes and children", () => {
    expect(drawn('page label=Ignored\n  text label=Ignored Body')).toEqual(["div.wf-page", "  div.wf-text Body"]);
    const root = render('page\n  input label="<img src=x onerror=alert(1)>" Hint\n    text Child');
    expect(root.querySelector(".wf-field-label")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(root.querySelector(".wf-input > .wf-text")?.textContent).toBe("Child");
    expect(root.querySelector("img, input, select, label, [style], [onclick], [tabindex]")).toBeNull();
  });

  it("draws a dialog's label as its title, and none without one", () => {
    expect(drawn("dialog Title")).toEqual(["div.wf-dialog", "  div.wf-dialog-card", "    div.wf-dialog-title Title"]);
    expect(drawn("dialog\n  text Body")).toEqual(["div.wf-dialog", "  div.wf-dialog-card", "    div.wf-text Body"]);
  });

  it("draws a banner in its tone, neutral by default", () => {
    expect(drawn("banner")).toEqual(["div.wf-banner"]);
    for (const tone of ["neutral", "info", "warning", "danger", "success"]) {
      expect(drawn(`banner.${tone}`)).toEqual([`div.wf-banner.wf-${tone}`]);
    }
  });

  it("draws a success banner with its archive icon and message", () => {
    expect(drawn("banner.success\n  icon archive\n  text Restored")).toEqual([
      "div.wf-banner.wf-success",
      "  span.wf-icon",
      "    svg.wf-icon-glyph.wf-icon-outline",
      "      path",
      "      path",
      "      path",
      "  div.wf-text Restored",
    ]);
  });

  it("draws text plain, muted or strong", () => {
    expect(drawn("dialog\n  text Hi\n  text.muted Hi\n  text.strong Hi").slice(2)).toEqual([
      "    div.wf-text Hi",
      "    div.wf-text.wf-muted Hi",
      "    div.wf-text.wf-strong Hi",
    ]);
  });

  it("draws a row, aligned to the end with .end", () => {
    expect(drawn("dialog\n  row\n  row.end").slice(2)).toEqual(["    div.wf-row", "    div.wf-row.wf-end"]);
  });

  it("draws row text and buttons in source order, retaining text variants", () => {
    expect(drawn("page\n  row.end\n    button Previous\n    text.small.muted 1–10 of 24\n    text.strong Count\n    text.title Title\n    button Next")).toEqual([
      "div.wf-page",
      "  div.wf-row.wf-end",
      "    span.wf-button Previous",
      "    div.wf-text.wf-small.wf-muted 1–10 of 24",
      "    div.wf-text.wf-strong Count",
      "    div.wf-text.wf-title Title",
      "    span.wf-button Next",
    ]);
  });

  it("draws nested rows as one group and preserves its children's text styles", () => {
    expect(drawn("card\n  row.between\n    row\n      text.strong Ana Lopez\n      text.small.muted 2 h ago\n    button.link ✓ Resolve")).toEqual([
      "div.wf-card",
      "  div.wf-row.wf-between",
      "    div.wf-row.wf-row-group",
      "      div.wf-text.wf-strong Ana Lopez",
      "      div.wf-text.wf-small.wf-muted 2 h ago",
      "    span.wf-button.wf-link",
      "      span.wf-button-caption ✓ Resolve",
    ]);
  });

  it.each(["end", "between", "scroll", "end.between.scroll"])("draws a nested row.%s as a plain group", (variants) => {
    const plain = render("card\n  row.between\n    row\n      text Name\n    button Resolve");
    const warned = render(`card\n  row.between\n    row.${variants}\n      text Name\n    button Resolve`);
    expect(warned.outerHTML).toBe(plain.outerHTML);
  });

  it.each([
    ["sortable", "M8 13V3M4 7l4-4 4 4M4 9l4 4 4-4"],
    ["ascending", "M8 13V3M4 7l4-4 4 4"],
    ["descending", "M8 3v10M4 9l4 4 4-4"],
  ])("draws cell.%s after its caption, including with .end and in a warned body cell", (variant, path) => {
    for (const row of ["row", "row.head"]) {
      for (const end of ["", ".end"]) {
        const root = render(`page\n  table\n    ${row}\n      cell${end}.${variant} Caption`);
        const cell = root.querySelector(".wf-cell")!;
        expect(cell.firstChild?.textContent).toBe("Caption");
        expect(cell.classList.contains("wf-end")).toBe(end !== "");
        const svg = cell.lastChild as SVGSVGElement;
        expect(svg.getAttribute("class")).toBe("wf-cell-sort");
        expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.querySelector("path")?.getAttribute("d")).toBe(path);
        expect(root.querySelector(".wf-icon")).toBeNull();
      }
    }
  });

  it("draws only the first sort variant, even when competing variants warn", () => {
    for (const first of ["sortable", "ascending", "descending"]) {
      const single = render(`page\n  table\n    row.head\n      cell.end.${first} Caption`);
      const competing = render(`page\n  table\n    row.head\n      cell.end.${first}.descending.ascending.sortable Caption`);
      expect(competing.outerHTML).toBe(single.outerHTML);
    }
  });

  it("draws buttons as secondary by default, and with each variant", () => {
    const buttons = ["button", "button.primary", "button.danger", "button.link", "button.focus", "button.primary.danger"];
    expect(drawn(`dialog\n  row\n${buttons.map((b) => `    ${b} Go`).join("\n")}`).slice(3)).toEqual([
      "      span.wf-button Go",
      "      span.wf-button.wf-primary Go",
      "      span.wf-button.wf-danger Go",
      "      span.wf-button.wf-link",
      "        span.wf-button-caption Go",
      "      span.wf-button.wf-focus Go",
      "      span.wf-button.wf-primary.wf-danger Go",
    ]);
  });

  it("draws the archive icon as an SVG path from the allowlist", () => {
    const icon = render("banner\n  icon archive").querySelector(".wf-icon")!;
    const svg = icon.querySelector("svg")!;
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe("archive");
    expect(svg.querySelectorAll("path")).toHaveLength(3);
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2");
  });

  it("draws every icon the vocabulary allows as an SVG", () => {
    for (const name of ICONS) {
      const source = `banner\n  icon ${name}`;
      expect(parseWireframe(source).diagnostics).toEqual([]);
      expect(render(source).querySelector(".wf-icon > svg.wf-icon-glyph > path")?.getAttribute("d")).toBeTruthy();
    }
  });

  it("draws a page as a frame holding its children, with text.title as its title", () => {
    expect(drawn("page\n  text.title All documents\n  text Body")).toEqual([
      "div.wf-page",
      "  div.wf-text.wf-title All documents",
      "  div.wf-text Body",
    ]);
    expect(drawn("page")).toEqual(["div.wf-page"]);
  });

  it("draws an input with its placeholder, or empty", () => {
    expect(drawn("page\n  input Search titles\n  input\n  row\n    input Name")).toEqual([
      "div.wf-page",
      "  div.wf-input Search titles",
      "  div.wf-input",
      "  div.wf-row",
      "    div.wf-input Name",
    ]);
  });

  it("draws a select as its value and a chevron-down that is no icon", () => {
    expect(drawn("page\n  select Any tag\n  select")).toEqual([
      "div.wf-page",
      "  span.wf-select Any tag",
      "    svg.wf-select-caret",
      "      path",
      "  span.wf-select",
      "    svg.wf-select-caret",
      "      path",
    ]);
    const svg = render("page\n  select Any tag").querySelector(".wf-select > svg")!;
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M4 6l4 4 4-4");
    expect(render("page\n  select Any tag").querySelector(".wf-icon")).toBeNull();
  });

  it("draws a toggle's options, the current one marked", () => {
    expect(drawn("page\n  toggle\n    option Day\n    option.current Week\n    option Month")).toEqual([
      "div.wf-page",
      "  div.wf-toggle",
      "    span.wf-option Day",
      "    span.wf-option.wf-current Week",
      "    span.wf-option Month",
    ]);
  });

  it("draws a table's rows of cells, a header row, end cells and empty ones", () => {
    expect(drawn("page\n  table\n    row.head\n      cell Name\n      cell.end Size\n    row\n      cell\n      cell.end 18 KB")).toEqual([
      "div.wf-page",
      "  div.wf-table",
      "    div.wf-row.wf-head",
      "      div.wf-cell Name",
      "      div.wf-cell.wf-end Size",
      "    div.wf-row",
      "      div.wf-cell",
      "      div.wf-cell.wf-end 18 KB",
    ]);
  });

  it("draws chips, .more and buttons in a cell, and chips in a row", () => {
    expect(drawn("page\n  row\n    chip web\n    chip.more +1\n  table\n    row\n      cell Tags\n        chip spec\n        button.link pin")).toEqual([
      "div.wf-page",
      "  div.wf-row",
      "    span.wf-chip web",
      "    span.wf-chip.wf-more +1",
      "  div.wf-table",
      "    div.wf-row",
      "      div.wf-cell Tags",
      "        span.wf-chip spec",
      "        span.wf-button.wf-link",
      "          span.wf-button-caption pin",
    ]);
  });

  it("draws several roots one after another", () => {
    const root = render(`${deleteConfirmation}\n\n${archivedBanner}`);
    expect([...root.children].map((child) => child.className)).toEqual(["wf-dialog", "wf-banner wf-warning"]);
  });

  it("draws every kind and variant without diagnostics", () => {
    expect(parseWireframe(vocabulary).diagnostics).toEqual([]);
    const root = render(vocabulary);
    expect(root.querySelectorAll("[data-line]")).toHaveLength(vocabulary.split("\n").length);
  });

  it("draws nothing for an empty block", () => {
    for (const source of ["", "\n", "  \n\n"]) expect(render(source).childNodes).toHaveLength(0);
  });

  it("draws nothing for a result that is not renderable, so the host keeps its last render", () => {
    for (const source of ["dialog\n   text Odd", 'dialog "Open', `dialog\n${"x\n".repeat(200)}`]) {
      const result = parseWireframe(source);
      expect(result.renderable).toBe(false);
      expect(renderWireframe(result)).toBeNull();
    }
  });
});

describe("warnings", () => {
  it("retains misplaced frame and card nodes, labels, children and unknown icons", () => {
    const root = render('page\n  frame.teal <script>caption</script>\n    card.large Unexpected label\n      row\n        button Load\n      icon figma\n  button Outside');
    expect(root.querySelector(".wf-page > .wf-frame > .wf-frame-caption")!.textContent).toBe("<script>caption</script>");
    expect(root.querySelector(".wf-card > .wf-text")!.textContent).toBe("Unexpected label");
    expect(root.querySelector(".wf-card > .wf-row > .wf-button")!.textContent).toBe("Load");
    expect(root.querySelector(".wf-card .wf-icon-unknown")!.textContent).toBe("figma");
    expect(root.querySelector(".wf-page > .wf-button")!.textContent).toBe("Outside");
    expect(root.querySelector(".wf-teal, .wf-large, script, button, a, [tabindex]")).toBeNull();
    expect(root.querySelectorAll("[data-line]")).toHaveLength(7);
  });

  it("draws an unknown kind as a box with its kind, label and children", () => {
    expect(drawn("box Settings\n  text Body\n  row\n    button Save")).toEqual([
      "div.wf-unknown",
      "  div.wf-unknown-head",
      "    span.wf-unknown-kind box",
      "    span.wf-unknown-label Settings",
      "  div.wf-text Body",
      "  div.wf-row",
      "    span.wf-button Save",
    ]);
    expect(drawn("box")).toEqual(["div.wf-unknown", "  div.wf-unknown-head", "    span.wf-unknown-kind box"]);
    // A line with no kind, such as `.muted Hi`.
    expect(drawn(".muted Hi")).toEqual(["div.wf-unknown", "  div.wf-unknown-head", "    span.wf-unknown-label Hi"]);
  });

  it("draws a kind outside a known one inside an unknown one where it was written", () => {
    expect(drawn("dialog\n  box\n    text Hi")).toEqual([
      "div.wf-dialog",
      "  div.wf-dialog-card",
      "    div.wf-unknown",
      "      div.wf-unknown-head",
      "        span.wf-unknown-kind box",
      "      div.wf-text Hi",
    ]);
  });

  it("draws a misplaced node as its kind, where it was written", () => {
    expect(drawn("button Go\ntext Hi\nrow.end\nicon archive")).toEqual([
      "span.wf-button Go",
      "div.wf-text Hi",
      "div.wf-row.wf-end",
      "span.wf-icon",
      "  svg.wf-icon-glyph.wf-icon-outline",
      "    path",
      "    path",
      "    path",
    ]);
    expect(drawn("banner\n  dialog Nested\n  row\n    text In a row\n    icon archive\n  button Loose")).toEqual([
      "div.wf-banner",
      "  div.wf-dialog",
      "    div.wf-dialog-card",
      "      div.wf-dialog-title Nested",
      "  div.wf-row",
      "    div.wf-text In a row",
      "    span.wf-icon",
      "      svg.wf-icon-glyph.wf-icon-outline",
      "        path",
      "        path",
      "        path",
      "  span.wf-button Loose",
    ]);
  });

  it("draws misplaced table kinds as their kind, where they were written", () => {
    const source = "page\n  cell Loose\n  row.head\n    option Day\n  table\n    row.end\n      button Go\n      cell A";
    expect(drawn(source)).toEqual([
      "div.wf-page",
      "  div.wf-cell Loose",
      "  div.wf-row.wf-head",
      "    span.wf-option Day",
      "  div.wf-table",
      "    div.wf-row.wf-end",
      "      span.wf-button Go",
      "      div.wf-cell A",
    ]);
  });

  it("draws a label on a page, toggle or table as text", () => {
    expect(drawn("page Home\n  toggle Period\n  table Files")).toEqual([
      "div.wf-page",
      "  span.wf-text Home",
      "  div.wf-toggle",
      "    span.wf-text Period",
      "  div.wf-table",
      "    span.wf-text Files",
    ]);
  });

  it("draws the children of a kind that takes none inside it", () => {
    expect(drawn("dialog\n  row\n    button Go\n      text Inside")).toEqual([
      "div.wf-dialog",
      "  div.wf-dialog-card",
      "    div.wf-row",
      "      span.wf-button Go",
      "        div.wf-text Inside",
    ]);
  });

  it("adds no class for an unknown variant", () => {
    expect(drawn("dialog\n  text.big.strong.end Hi\n  row.wide\n    button.huge Go").slice(2)).toEqual([
      "    div.wf-text.wf-strong Hi",
      "    div.wf-row",
      "      span.wf-button Go",
    ]);
    expect(drawn("banner.purple.")).toEqual(["div.wf-banner"]);
    expect(drawn("dialog.danger Title")[0]).toBe("div.wf-dialog");
  });

  it("draws an unknown icon as a box showing its name", () => {
    expect(drawn("banner\n  icon pinn\n  icon")).toEqual([
      "div.wf-banner",
      "  span.wf-icon",
      "    span.wf-icon-unknown pinn",
      "  span.wf-icon",
      "    span.wf-icon-unknown",
    ]);
  });

  it("draws a label on a kind that takes none as text", () => {
    expect(drawn("banner Archived\n  row Actions\n    button Go")).toEqual([
      "div.wf-banner",
      "  span.wf-text Archived",
      "  div.wf-row",
      "    span.wf-text Actions",
      "    span.wf-button Go",
    ]);
  });

  it("ignores attributes and ids, which have their own diagnostics", () => {
    const root = render("dialog#confirm tone=warm Title\n  text#body Hi");
    expect(outline(root).slice(1)).toEqual([
      "  div.wf-dialog",
      "    div.wf-dialog-card",
      "      div.wf-dialog-title Title",
      "      div.wf-text Hi",
    ]);
    expect(root.querySelector("[id]")).toBeNull();
  });
});

describe("page widths", () => {
  it("writes only the validated pixel count and keeps the summary and children unchanged", () => {
    const plain = "page#sidebar\n  text Dashboard\n  text All documents";
    const source = plain.replace("page#sidebar", "page#sidebar width=00256");
    const root = render(source);
    const page = root.querySelector<HTMLElement>(".wf-page")!;
    expect(page.style.width).toBe("min(256px, 100%)");
    expect(page.style.length).toBe(1);
    expect(root.querySelector("[id]")).toBeNull();
    expect(drawn(source)).toEqual(drawn(plain));
    expect(summarizeWireframe(parseWireframe(source))).toBe(summarizeWireframe(parseWireframe(plain)));
  });

  it("uses the first width, even when it is invalid", () => {
    expect(render("page width=256 width=400").querySelector<HTMLElement>(".wf-page")!.style.width).toBe("min(256px, 100%)");
    expect(render("page width=0 width=256").outerHTML).toBe(render("page").outerHTML);
  });

  it("leaves invalid or misplaced widths out of the DOM", () => {
    for (const value of ["240px", "50%", "0", "10000", "12.5", "-1", "", "256;position:fixed", "url(https://example.com)"]) {
      expect(render(`page width="${value}"`).outerHTML).toBe(render("page").outerHTML);
    }
    for (const kind of ["dialog", "banner", "frame", "text", "row", "button", "input", "select", "toggle", "option", "table", "cell", "chip", "icon", "box"]) {
      expect(render(`${kind} width=256`).outerHTML).toBe(render(kind).outerHTML);
    }
  });

  it("validates again when given a modified parse result", () => {
    const result = parseWireframe("page width=256");
    result.nodes[0]!.attributes[0]!.value = "256px; background: url(https://example.com)";
    expect(renderWireframe(result)!.querySelector("[style]")).toBeNull();
  });
});

describe("inert output", () => {
  const hostile = [
    "dialog <img src=x onerror=alert(1)>",
    "  text **bold** <script>alert(1)</script> &amp; [link](javascript:alert(1))",
    '  row onclick=alert(1) style="color:red"',
    "    button.primary#evil href=javascript:alert(1) <b>Go</b>",
    "    button.onclick Go",
    "  icon <svg onload=alert(1)>",
    "  icon archive",
    "  img#x src=http://example.com/x.png Picture",
    '  text "javascript:alert(1)"',
    "banner.warning style=position:fixed",
    "  text <%= x %> {{x}} </div><div>",
    "page",
    "  select <img src=x onerror=alert(1)>",
    "  input javascript:alert(1)",
    "  toggle",
    "    option.onclick <b>Day</b>",
    "  table",
    "    row.head",
    "      cell <script>alert(1)</script>",
    "      cell",
    "        chip.more <i>+2</i>",
  ].join("\n");

  it("shows labels exactly as written, as text", () => {
    const root = render(hostile);
    expect(root.querySelector(".wf-dialog-title")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(root.querySelector(".wf-dialog-card > .wf-text")?.textContent).toBe(
      "**bold** <script>alert(1)</script> &amp; [link](javascript:alert(1))",
    );
    expect(root.querySelector(".wf-button.wf-primary")?.textContent).toBe("<b>Go</b>");
    expect(root.querySelector(".wf-icon-unknown")?.textContent).toBe("<svg onload=alert(1)>");
    expect(root.querySelector(".wf-banner > .wf-text")?.textContent).toBe("<%= x %> {{x}} </div><div>");
    expect(root.querySelector(".wf-select")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(root.querySelector(".wf-input")?.textContent).toBe("javascript:alert(1)");
    expect(root.querySelector(".wf-option")?.textContent).toBe("<b>Day</b>");
    expect(root.querySelector(".wf-cell")?.textContent).toBe("<script>alert(1)</script>");
    expect(root.querySelector(".wf-chip.wf-more")?.textContent).toBe("<i>+2</i>");
  });

  it("emits only its own elements and attributes", () => {
    const root = render(hostile);
    const elements = [root, ...root.querySelectorAll("*")];
    expect(new Set(elements.map((element) => element.localName))).toEqual(new Set(["div", "span", "svg", "path"]));
    const attributes = new Set(elements.flatMap((element) => element.getAttributeNames()));
    expect(attributes).toEqual(new Set(["class", "data-line", "viewBox", "aria-hidden", "aria-label", "role", "d"]));
    // No class from the source: `.onclick` and `.primary` on a button only add known ones.
    const classes = new Set(elements.flatMap((element) => [...element.classList]));
    for (const name of classes) expect(name).toMatch(/^wf-[a-z-]+$/);
    expect(classes.has("wf-onclick")).toBe(false);
  });

  it("serialises to HTML that parses back to the same elements", () => {
    const root = render(hostile);
    const html = root.outerHTML;
    expect(new Set([...html.matchAll(/<\/?([^\s>/]+)/g)].map((match) => match[1]))).toEqual(
      new Set(["div", "span", "svg", "path"]),
    );
    const copy = document.createElement("template");
    copy.innerHTML = html;
    expect(outline(copy.content.firstElementChild!)).toEqual(outline(root));
  });
});

describe("robustness", () => {
  const random = (seed: number): (() => number) => {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  };
  const pieces = [
    "dialog", "banner", "text", "row", "button", "icon", "card", ".", "#", "=", "a=", '"', "\\", " ", "  ",
    "\t", "\n", "\r\n", "\n  ", "\n    ", "x", "<b>", "end", "focus", "danger", "link", "archive", "😀",
    "page", "table", "cell", "chip", "toggle", "option", "input", "select", "head", "title", "\n      ",
  ];

  it("never throws, and draws every node of a renderable result", () => {
    const next = random(7);
    for (let run = 0; run < 1_000; run += 1) {
      const source = Array.from({ length: 1 + Math.floor(next() * 60) }, () => pieces[Math.floor(next() * pieces.length)])
        .join("");
      const result = parseWireframe(source);
      const root = renderWireframe(result);
      if (!result.renderable) {
        expect(root).toBeNull();
        continue;
      }
      const lines = (nodes: readonly WireframeNode[]): number[] => nodes.flatMap((n) => [n.line, ...lines(n.children)]);
      const drawnLines = [...root!.querySelectorAll("[data-line]")].map((element) => Number(element.getAttribute("data-line")));
      expect(drawnLines).toEqual(lines(result.nodes));
      expect(drawnLines).toHaveLength(count(result.nodes));
    }
  });

  it("draws nothing, rather than throwing, for a result that parseWireframe could not give", () => {
    const node: WireframeNode = { kind: "dialog", variants: [], attributes: [], label: "", line: 1, children: [] };
    node.children.push(node);
    const broken = [
      { nodes: null, diagnostics: [], renderable: true },
      { nodes: [{ kind: "text" }], diagnostics: [], renderable: true },
      { nodes: [node], diagnostics: [], renderable: true },
    ] as unknown as WireframeParseResult[];
    for (const result of broken) expect(renderWireframe(result)).toBeNull();
    expect(renderWireframe(parseWireframe(deleteConfirmation), null as unknown as Document)).toBeNull();
  });
});
