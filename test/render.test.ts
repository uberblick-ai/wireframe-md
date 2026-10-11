import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, type WireframeNode, type WireframeParseResult } from "../src/index.js";
import { archivedBanner, deleteConfirmation, vocabulary } from "./samples.js";

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
      "    svg.wf-icon-glyph",
      "      path",
      "  div.wf-text Archived. Read-only and hidden from the document list.",
      "  div.wf-row.wf-end",
      "    span.wf-button Restore",
      "    span.wf-button.wf-link.wf-danger Delete…",
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
  it("draws a dialog's label as its title, and none without one", () => {
    expect(drawn("dialog Title")).toEqual(["div.wf-dialog", "  div.wf-dialog-card", "    div.wf-dialog-title Title"]);
    expect(drawn("dialog\n  text Body")).toEqual(["div.wf-dialog", "  div.wf-dialog-card", "    div.wf-text Body"]);
  });

  it("draws a banner in its tone, neutral by default", () => {
    expect(drawn("banner")).toEqual(["div.wf-banner"]);
    for (const tone of ["neutral", "info", "warning", "danger"]) {
      expect(drawn(`banner.${tone}`)).toEqual([`div.wf-banner.wf-${tone}`]);
    }
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

  it("draws buttons as secondary by default, and with each variant", () => {
    const buttons = ["button", "button.primary", "button.danger", "button.link", "button.focus", "button.primary.danger"];
    expect(drawn(`dialog\n  row\n${buttons.map((b) => `    ${b} Go`).join("\n")}`).slice(3)).toEqual([
      "      span.wf-button Go",
      "      span.wf-button.wf-primary Go",
      "      span.wf-button.wf-danger Go",
      "      span.wf-button.wf-link Go",
      "      span.wf-button.wf-focus Go",
      "      span.wf-button.wf-primary.wf-danger Go",
    ]);
  });

  it("draws the archive icon as an SVG path from the allowlist", () => {
    const icon = render("banner\n  icon archive").querySelector(".wf-icon")!;
    const svg = icon.querySelector("svg")!;
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M2 3h12v3H2zM3 6v7h10V6M6.5 9h3");
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
  it("draws an unknown kind as a box with its kind, label and children", () => {
    expect(drawn("card Settings\n  text Body\n  row\n    button Save")).toEqual([
      "div.wf-unknown",
      "  div.wf-unknown-head",
      "    span.wf-unknown-kind card",
      "    span.wf-unknown-label Settings",
      "  div.wf-text Body",
      "  div.wf-row",
      "    span.wf-button Save",
    ]);
    expect(drawn("card")).toEqual(["div.wf-unknown", "  div.wf-unknown-head", "    span.wf-unknown-kind card"]);
    // A line with no kind, such as `.muted Hi`.
    expect(drawn(".muted Hi")).toEqual(["div.wf-unknown", "  div.wf-unknown-head", "    span.wf-unknown-label Hi"]);
  });

  it("draws a kind outside a known one inside an unknown one where it was written", () => {
    expect(drawn("dialog\n  card\n    text Hi")).toEqual([
      "div.wf-dialog",
      "  div.wf-dialog-card",
      "    div.wf-unknown",
      "      div.wf-unknown-head",
      "        span.wf-unknown-kind card",
      "      div.wf-text Hi",
    ]);
  });

  it("draws a misplaced node as its kind, where it was written", () => {
    expect(drawn("button Go\ntext Hi\nrow.end\nicon archive")).toEqual([
      "span.wf-button Go",
      "div.wf-text Hi",
      "div.wf-row.wf-end",
      "span.wf-icon",
      "  svg.wf-icon-glyph",
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
      "      svg.wf-icon-glyph",
      "        path",
      "  span.wf-button Loose",
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
    expect(drawn("banner\n  icon trash\n  icon")).toEqual([
      "div.wf-banner",
      "  span.wf-icon",
      "    span.wf-icon-unknown trash",
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
  });

  it("emits only its own elements and attributes", () => {
    const root = render(hostile);
    const elements = [root, ...root.querySelectorAll("*")];
    expect(new Set(elements.map((element) => element.localName))).toEqual(new Set(["div", "span", "svg", "path"]));
    const attributes = new Set(elements.flatMap((element) => element.getAttributeNames()));
    expect(attributes).toEqual(new Set(["class", "data-line", "viewBox", "aria-hidden", "d"]));
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
