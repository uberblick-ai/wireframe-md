import type { WireframeNode, WireframeParseResult } from "./model.js";
import { type IconStyle, resolveIcon } from "./icons.js";
import { CELL_SORT_VARIANTS, colourVariants, KINDS } from "./vocabulary.js";

// Draws a parse result as static DOM. Structure from the uberblick-2 spike: one
// element per node, a class per kind and per known variant, everything styled
// by getEmbedStyles() under the root class.
//
// The output is inert by construction. Source text only ever becomes a text
// node, element names and attributes come from this file, a node's #id is never
// written, and mock controls are spans, so nothing can be focused or submitted.

/** The class on the element renderWireframe returns. Every rule in getEmbedStyles() sits under it. */
export const ROOT_CLASS = "wf-root";

const SVG = "http://www.w3.org/2000/svg";

// The select's stroked 16×16 chevron-down, separate from the icon catalog.
const CHEVRON_PATH = "M4 6l4 4 4-4";

// Stroked sort arrows belong to cells, not the icon vocabulary.
const SORT_PATHS: ReadonlyMap<string, string> = new Map([
  ["sortable", "M8 13V3M4 7l4-4 4 4M4 9l4 4 4-4"],
  ["ascending", "M8 13V3M4 7l4-4 4 4"],
  ["descending", "M8 3v10M4 9l4 4 4-4"],
]);

// Kinds that sit in a line of text or a row; the rest are blocks.
const INLINE: readonly string[] = ["button", "icon", "select", "option", "chip"];

/**
 * Draw a parse result as static, inert DOM: one `.wf-root` element holding the
 * roots in source order. A node with a warning still draws where it was written.
 *
 * Returns null when the result is not renderable, so the host can keep its last
 * good render; showing the diagnostics is the host's job. An empty block gives
 * an empty root. Never throws.
 */
export function renderWireframe(
  result: WireframeParseResult,
  document: Document = globalThis.document,
): HTMLElement | null {
  try {
    if (!result.renderable) return null;
    const root = document.createElement("div");
    root.className = ROOT_CLASS;
    for (const node of result.nodes) root.append(draw(document, node));
    return root;
  } catch {
    // Only a result that did not come from parseWireframe, or a missing
    // document, gets here. Drawing nothing keeps the host's last good render.
    return null;
  }
}

function draw(document: Document, node: WireframeNode): HTMLElement {
  const rule = KINDS.get(node.kind);
  if (rule === undefined) return unknown(document, node);
  const sortIndex = node.kind === "cell"
    ? node.variants.findIndex((variant) => CELL_SORT_VARIANTS.includes(variant))
    : -1;
  const sort = node.variants[sortIndex];
  const colours = colourVariants(node.kind);
  const colourIndex = node.variants.findIndex((variant) => colours.includes(variant));
  // Only variants the kind knows become classes, so an unknown one adds no styling.
  const variants = node.variants
    .filter((variant, index) => rule.variants.includes(variant) &&
      (!colours.includes(variant) || index === colourIndex) &&
      (node.kind !== "cell" || !SORT_PATHS.has(variant) || index === sortIndex))
    .map((variant) => `wf-${variant}`);
  const element = create(document, INLINE.includes(node.kind) ? "span" : "div", [`wf-${node.kind}`, ...variants]);
  element.dataset.line = String(node.line);

  let body: HTMLElement = element;
  let actions: HTMLElement | undefined;
  switch (node.kind) {
    case "dialog":
      // The node's element is the scrim; the card inside it holds the title and children.
      body = create(document, "div", ["wf-dialog-card"]);
      element.append(body);
      if (node.label !== "") body.append(text(document, "div", ["wf-dialog-title"], node.label));
      break;
    case "frame": {
      if (node.label !== "" || node.children.some((child) => child.kind === "button")) {
        const caption = create(document, "div", ["wf-frame-caption"]);
        if (node.label !== "") caption.append(text(document, "div", ["wf-frame-label"], node.label));
        if (node.children.some((child) => child.kind === "button")) {
          actions = create(document, "div", ["wf-frame-actions"]);
          caption.append(actions);
        }
        element.append(caption);
      }
      break;
    }
    case "icon":
      element.append(icon(document, node.label, node.variants.includes("filled") ? "filled" : "outline", node.variants[colourIndex]));
      break;
    case "button": {
      // Icons precede the caption; every child still draws, including misplaced ones.
      const icons = node.children.filter((child) => child.kind === "icon");
      if (icons.length > 0) {
        element.classList.add("wf-has-icon");
        if (node.label === "") element.classList.add("wf-icon-only");
      }
      for (const child of icons) element.append(draw(document, child));
      if (node.label !== "") {
        element.append(node.variants.includes("link")
          ? text(document, "span", ["wf-button-caption"], node.label)
          : document.createTextNode(node.label));
      }
      break;
    }
    case "select":
      // The chosen value, then the chevron-down.
      element.textContent = node.label;
      element.append(glyph(document, "wf-select-caret", CHEVRON_PATH));
      break;
    case "cell": {
      element.textContent = node.label;
      const path = sort === undefined ? undefined : SORT_PATHS.get(sort);
      if (path !== undefined) element.append(glyph(document, "wf-cell-sort", path));
      break;
    }
    default:
      // A banner, page, card, row, toggle or table takes no label. One written anyway warns and draws as text.
      if (node.label !== "") {
        if (rule.label) element.textContent = node.label;
        else element.append(text(document, "span", ["wf-text"], node.label));
      }
  }
  // Children of any kind draw inside it, even where they are misplaced.
  for (const child of node.children) {
    if (node.kind === "button" && child.kind === "icon") continue;
    (child.kind === "button" && actions !== undefined ? actions : body).append(draw(document, child));
  }
  if (node.kind === "input" || node.kind === "select") {
    const label = node.attributes.find((attribute) => attribute.key === "label");
    if (label !== undefined) {
      const field = create(document, "div", ["wf-field"]);
      // The wrapper represents the source line; the control stays inert.
      field.dataset.line = String(node.line);
      delete element.dataset.line;
      field.append(text(document, "div", ["wf-field-label"], label.value), element);
      return field;
    }
  }
  return element;
}

/** A dashed box showing the kind as written, the label and the children. */
function unknown(document: Document, node: WireframeNode): HTMLElement {
  const element = create(document, "div", ["wf-unknown"]);
  element.dataset.line = String(node.line);
  const head = create(document, "div", ["wf-unknown-head"]);
  if (node.kind !== "") head.append(text(document, "span", ["wf-unknown-kind"], node.kind));
  if (node.label !== "") head.append(text(document, "span", ["wf-unknown-label"], node.label));
  if (head.hasChildNodes()) element.append(head);
  for (const child of node.children) element.append(draw(document, child));
  return element;
}

/** An allowlisted icon as an inline SVG; any other name draws as a dashed box showing it. */
function icon(document: Document, name: string, requested: IconStyle, colour?: string): Node {
  const drawing = resolveIcon(name, requested);
  if (drawing === undefined) return text(document, "span", ["wf-icon-unknown"], name);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", `wf-icon-glyph wf-icon-${drawing.style}`);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${colour === undefined ? "" : `${colour} `}${name.replaceAll("-", " ")}`);
  for (const [d, paint] of drawing.paths) {
    const shape = document.createElementNS(SVG, "path");
    shape.setAttribute("d", d);
    const classes = [
      ...(paint & 1 ? ["wf-path-fill"] : []),
      ...(paint & 2 ? ["wf-path-no-stroke"] : []),
      ...(paint & 4 ? ["wf-path-half-opacity"] : []),
    ];
    if (classes.length > 0) shape.setAttribute("class", classes.join(" "));
    svg.append(shape);
  }
  return svg;
}

/** A 16×16 inline SVG of one path from this file. */
function glyph(document: Document, className: string, path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS(SVG, "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

function create(document: Document, tag: "div" | "span", classes: readonly string[]): HTMLElement {
  const element = document.createElement(tag);
  element.className = classes.join(" ");
  return element;
}

function text(document: Document, tag: "div" | "span", classes: readonly string[], content: string): HTMLElement {
  const element = create(document, tag, classes);
  element.textContent = content;
  return element;
}
