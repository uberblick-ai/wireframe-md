import type { WireframeNode, WireframeParseResult } from "./model.js";
import { paddingPixels, widthPixels } from "./attributes.js";
import { type IconStyle, resolveIcon } from "./icons.js";
import { textRuns } from "./text.js";
import { CELL_SORT_VARIANTS, colourVariants, IMAGE_SHAPE_VARIANTS, KINDS, PAGE_CHROME_VARIANTS, ROW_LAYOUT_VARIANTS, ROW_VARIANT_CONFLICTS, TEXT_BACKGROUND_VARIANTS } from "./vocabulary.js";

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
    // Share sizing only with the nearest boundary. A content boundary shares
    // with its affected direct children. A card stops sharing, so its inner
    // rows keep their own caps even when the card is itself inside a sized row.
    for (const wrap of root.querySelectorAll(".wf-banner-wrap, .wf-row-wrap, .wf-content-wrap, .wf-row-cap")) {
      if (wrap.closest('[aria-hidden="true"]') !== null) continue;
      const boundary = wrap.parentElement?.closest(".wf-banner-size, .wf-row-size, .wf-content-size, .wf-row-cap, .wf-card");
      if (boundary && !boundary.classList.contains("wf-card") &&
        (!boundary.classList.contains("wf-content-size") || wrap.classList.contains("wf-content-item"))) {
        wrap.classList.add("wf-shared");
      }
    }
    return root;
  } catch {
    // Only a result that did not come from parseWireframe, or a missing
    // document, gets here. Drawing nothing keeps the host's last good render.
    return null;
  }
}

function draw(document: Document, node: WireframeNode, parent?: WireframeNode, grandparent?: WireframeNode): HTMLElement {
  const rule = KINDS.get(node.kind);
  if (rule === undefined) return unknown(document, node);
  const rowGroup = node.kind === "row" && parent?.kind === "row" && grandparent?.kind !== "table";
  const sortIndex = node.kind === "cell"
    ? node.variants.findIndex((variant) => CELL_SORT_VARIANTS.includes(variant))
    : -1;
  const sort = node.variants[sortIndex];
  const colours = colourVariants(node.kind);
  const colourIndex = node.variants.findIndex((variant) => colours.includes(variant));
  const conflicts = node.kind === "row" ? ROW_VARIANT_CONFLICTS : [node.kind === "image" ? IMAGE_SHAPE_VARIANTS : node.kind === "page" ? PAGE_CHROME_VARIANTS : node.kind === "text" ? TEXT_BACKGROUND_VARIANTS : []];
  // Compare against source order, including variants ignored by another conflict.
  const firstIndices = conflicts.map((exclusive) => node.variants.findIndex((variant) => exclusive.includes(variant)));
  // Only variants the kind knows become classes, so an unknown one adds no styling.
  const variants = node.variants
    .filter((variant, index) => rule.variants.includes(variant) &&
      (!rowGroup || !ROW_LAYOUT_VARIANTS.includes(variant)) &&
      (node.kind !== "row" || parent?.kind !== "table" || variant !== "stretch") &&
      (!colours.includes(variant) || index === colourIndex) &&
      conflicts.every((exclusive, group) => !exclusive.includes(variant) || index === firstIndices[group]) &&
      (node.kind !== "option" || parent?.kind !== "tabs" || variant !== "current" ||
        node === parent.children.find((child) => child.kind === "option" && child.variants.includes("current"))) &&
      (node.kind !== "cell" || !SORT_PATHS.has(variant) || index === sortIndex))
    .map((variant) => `wf-${variant}`);
  const element = create(document, INLINE.includes(node.kind) ? "span" : "div", [`wf-${node.kind}`, ...variants]);
  if (rowGroup) element.classList.add("wf-row-group");
  element.dataset.line = String(node.line);
  if (node.kind === "divider") element.setAttribute("role", "separator");
  if (["page", "card", "image"].includes(node.kind)) {
    const width = widthPixels(node.attributes.find((attribute) => attribute.key === "width")?.value);
    // Border-box sizing includes padding; min-content still widens a page for
    // content that cannot wrap. The root owns that overflow, as for fluid pages.
    if (width !== undefined) {
      if (node.kind === "page") element.style.width = `min(${width}px, 100%)`;
      else {
        element.classList.add("wf-sized");
        element.style.setProperty("--_wf-width", `${width}px`);
      }
    }
  }

  if (node.kind === "card") {
    const padding = paddingPixels(node.attributes.find((attribute) => attribute.key === "padding")?.value);
    if (padding !== undefined) {
      element.classList.add("wf-padded");
      element.style.setProperty("--_wf-card-padding", `${padding}px`);
    }
  }

  let body: HTMLElement = element;
  let actions: HTMLElement | undefined;
  let phoneViewport: HTMLElement | undefined;
  switch (node.kind) {
    case "page": {
      const chrome = node.variants[firstIndices[0] ?? -1];
      if (chrome === undefined) {
        // An unsupported plain-page label still draws as before.
        if (node.label !== "") element.append(text(document, "span", ["wf-text"], node.label));
        break;
      }
      const strip = create(document, "div", ["wf-page-chrome"]);
      const marks = create(document, "div", ["wf-page-marks"]);
      marks.setAttribute("aria-hidden", "true");
      if (chrome === "browser") {
        // Fixed drawings, never source URLs or interactive controls.
        for (const path of ["M13 8H3m5-5L3 8l5 5", "M3 8h10M8 3l5 5-5 5", "M13 6a5 5 0 1 0 0 4M13 2v4H9"]) {
          marks.append(glyph(document, "wf-browser-mark", path));
        }
      } else {
        for (const tone of ["danger", "warning", "success"]) {
          marks.append(create(document, "span", ["wf-window-light", `wf-${tone}`]));
        }
      }
      strip.append(marks, text(document, "div", [chrome === "browser" ? "wf-browser-address" : "wf-window-title"], node.label));
      body = create(document, "div", ["wf-page-content"]);
      element.append(strip, body);
      break;
    }
    case "phone": {
      // Device decoration stays outside the native scrolling viewport.
      const screen = create(document, "div", ["wf-phone-screen"]);
      const status = create(document, "div", ["wf-phone-status"]);
      status.setAttribute("aria-hidden", "true");
      const time = create(document, "div", ["wf-phone-time"]);
      time.append(text(document, "span", ["wf-phone-time-text"], "9:41"));
      const island = create(document, "div", ["wf-phone-island"]);
      const indicators = create(document, "div", ["wf-phone-indicators"]);
      for (const name of ["antenna-bars-5", "wifi", "battery-4"]) {
        indicators.append(icon(document, name, "outline"));
      }
      status.append(time, island, indicators);
      const viewport = create(document, "div", ["wf-phone-viewport"]);
      phoneViewport = viewport;
      body = create(document, "div", ["wf-phone-content"]);
      viewport.append(body);
      const home = create(document, "div", ["wf-phone-home"]);
      home.setAttribute("aria-hidden", "true");
      home.append(create(document, "div", ["wf-phone-home-indicator"]));
      screen.append(status, viewport, home);
      element.append(screen);
      // Unsupported labels still draw, inside the screen with all other source.
      if (node.label !== "") body.append(text(document, "span", ["wf-text"], node.label));
      break;
    }
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
    case "image": {
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", node.label || "image");
      const placeholder = create(document, "div", ["wf-image-placeholder"]);
      const mark = icon(document, "photo", "outline") as SVGElement;
      mark.removeAttribute("role");
      mark.removeAttribute("aria-label");
      mark.setAttribute("aria-hidden", "true");
      placeholder.append(mark);
      if (node.label !== "") placeholder.append(text(document, "span", ["wf-image-caption"], node.label));
      element.append(placeholder);
      break;
    }
    case "text":
      for (const run of textRuns(node.label)) {
        element.append(run.mono
          ? text(document, "span", ["wf-mono"], run.text)
          : document.createTextNode(run.text));
      }
      break;
    case "switch": {
      const track = create(document, "span", ["wf-switch-track"]);
      track.setAttribute("aria-hidden", "true");
      track.append(create(document, "span", ["wf-switch-thumb"]));
      element.append(track);
      // Plain text provides one reading without giving an inert mock control
      // an interactive role. Only the state (and a bare switch's name) is hidden.
      const state = node.variants.includes("on") ? "on" : "off";
      const alternative = text(document, "span", ["wf-switch-state"], `${node.label === "" ? "switch" : ""}, ${state}`);
      if (node.label === "") element.append(alternative);
      else {
        if (parent?.kind === "row" && grandparent?.kind !== "table") element.classList.add("wf-switch-row");
        const caption = text(document, "span", ["wf-switch-caption"], node.label);
        caption.append(alternative);
        element.append(caption);
      }
      break;
    }
    case "button":
    case "option": {
      // Icons precede the caption; every child still draws, including misplaced ones.
      const icons = node.children.filter((child) => child.kind === "icon");
      if (icons.length > 0) {
        element.classList.add("wf-has-icon");
        if (node.kind === "button" && node.label === "") element.classList.add("wf-icon-only");
      }
      for (const child of icons) element.append(draw(document, child, node, parent));
      if (node.label !== "") {
        element.append((node.kind === "option" && icons.length > 0) || node.variants.includes("link")
          // A separate caption permits a dock's tab bar to stack icon and text.
          ? text(document, "span", [node.kind === "option" ? "wf-option-caption" : "wf-button-caption"], node.label)
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
      // A kind that takes no label still draws one written anyway as text.
      if (node.label !== "") {
        if (rule.label) element.textContent = node.label;
        else element.append(text(document, "span", ["wf-text"], node.label));
      }
  }
  // Children of any kind draw inside it, even where they are misplaced.
  for (const child of node.children) {
    if ((node.kind === "button" || node.kind === "option") && child.kind === "icon") continue;
    // Only the valid final dock gets a sticky track. Misplaced docks retain
    // their source position in the content, including the first of two docks.
    const target = phoneViewport !== undefined && child.kind === "dock" && child === node.children.at(-1)
      ? phoneViewport : child.kind === "button" && actions !== undefined ? actions : body;
    target.append(draw(document, child, node, parent));
  }
  if (["dialog", "page", "frame", "phone"].includes(node.kind) && body.querySelector(":scope > .wf-row-wrap, :scope > .wf-content-wrap") !== null) {
    // Keep wrapped rows and misplaced content boxes in the intrinsic sizing
    // path at every level. The boundary sits outside the enclosing box, so
    // unfitting content widens its borders instead of escaping them.
    const children = [...body.querySelectorAll(":scope > .wf-row-wrap, :scope > .wf-content-wrap")];
    if (phoneViewport !== undefined) {
      const next = body.nextSibling;
      phoneViewport.insertBefore(sizingBoundary(document, body, "content"), next);
      for (const child of children) child.classList.add("wf-content-item");
    } else {
      const wrap = sizingBoundary(document, element, "content");
      for (const child of children) child.classList.add("wf-content-item");
      if (node.kind === "page" && element.style.width !== "") {
        wrap.style.width = element.style.width;
        const width = widthPixels(node.attributes.find((attribute) => attribute.key === "width")?.value);
        if (width !== undefined) wrap.style.setProperty("--_wf-content-limit", `${width}px`);
        element.style.width = "100%";
      }
      return wrap;
    }
  }
  if (node.kind === "banner") {
    // Each strip or tinted text gets its own line. Keep intervening source in the banner's
    // usual nowrap flex line. Use the same layout without strips, so adding
    // tabs cannot change percentage media's intrinsic sizing pass.
    let line: HTMLElement | undefined;
    for (const child of [...element.children]) {
      if (child.matches(`.wf-tabs, .wf-text:is(${TEXT_BACKGROUND_VARIANTS.map((variant) => `.wf-${variant}`).join(", ")})`)) line = undefined;
      else {
        if (line === undefined) {
          line = create(document, "div", ["wf-banner-line"]);
          element.insertBefore(line, child);
        }
        line.append(child);
      }
    }
    if (element.querySelector(":scope > .wf-banner-line > .wf-image.wf-sized, :scope > .wf-banner-line .wf-banner-wrap, :scope > .wf-banner-line > .wf-row-wrap .wf-switch-row") !== null) {
      // Measure image and row-caption caps against available space, independently
      // of the banner expanding to enclose them and their neighbouring content.
      // Nested sized banners need the outer boundary even without a direct image.
      // A size container cannot supply an intrinsic width. Keep a hidden sizing
      // copy beside it so shrink-to-fit hosts can still measure the content.
      return sizingBoundary(document, element, "banner");
    }
  }
  if (node.kind === "row" && parent?.kind !== "table" && element.querySelector(":scope > .wf-banner-wrap, :scope > .wf-row-wrap, :scope > .wf-content-wrap, :scope > .wf-switch-row") !== null) {
    // Measure image and switch-caption caps against the row's available width
    // before siblings widen it, rather than against their remaining slice of
    // that line. Compact groups share the enclosing row's available width.
    // Scroll rows already have inline-size containment and need no wrapper.
    if (!element.classList.contains("wf-scroll")) return sizingBoundary(document, element, "row");
    element.classList.add("wf-row-cap");
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

/** Keep available-width caps independent of intrinsic content sizing. */
function sizingBoundary(document: Document, element: HTMLElement, kind: "banner" | "row" | "content"): HTMLElement {
  const intrinsic = create(document, "div", [`wf-${kind}-intrinsic`]);
  intrinsic.setAttribute("aria-hidden", "true");
  if (kind !== "banner") intrinsic.append(element.cloneNode(true));
  else for (const child of element.children) {
    if (!child.classList.contains("wf-tabs")) intrinsic.append(child.cloneNode(true));
  }
  // Nested boundaries contribute through their sizing copies. Drop contained
  // real boxes so each nested banner or row is measured only once.
  for (const child of intrinsic.querySelectorAll(".wf-banner-size, .wf-row-size, .wf-content-size")) child.remove();
  for (const child of intrinsic.querySelectorAll(".wf-content-item")) child.classList.remove("wf-content-item");
  for (const child of intrinsic.querySelectorAll("[data-line]")) child.removeAttribute("data-line");
  const size = create(document, "div", [`wf-${kind}-size`]);
  size.append(element);
  const wrap = create(document, "div", [`wf-${kind}-wrap`]);
  if (kind === "row") {
    for (const variant of ["wf-row-group", "wf-end"]) {
      if (element.classList.contains(variant)) wrap.classList.add(variant);
    }
  }
  wrap.append(size, intrinsic);
  return wrap;
}

/** A dashed box showing the kind as written, the label and the children. */
function unknown(document: Document, node: WireframeNode): HTMLElement {
  const element = create(document, "div", ["wf-unknown"]);
  element.dataset.line = String(node.line);
  const head = create(document, "div", ["wf-unknown-head"]);
  if (node.kind !== "") head.append(text(document, "span", ["wf-unknown-kind"], node.kind));
  if (node.label !== "") head.append(text(document, "span", ["wf-unknown-label"], node.label));
  if (head.hasChildNodes()) element.append(head);
  for (const child of node.children) element.append(draw(document, child, node));
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
