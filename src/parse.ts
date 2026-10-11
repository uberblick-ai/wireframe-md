import type { WireframeDiagnostic, WireframeNode, WireframeParseResult } from "./model.js";
import { CELL_SORT_VARIANTS, ICONS, KINDS, LIMITS, type Place, ROOTS } from "./vocabulary.js";

// An attribute is a token that starts with `word=`.
const ATTRIBUTE = /[A-Za-z][A-Za-z0-9_-]*=/y;
const ID = /^[A-Za-z0-9_-]+$/;

/**
 * Parse the body of a ```wireframe block, without its fences, into a tree of
 * nodes and line-numbered diagnostics. Line 1 is the body's first line. Never
 * throws: every string gives a result.
 */
export function parseWireframe(source: string): WireframeParseResult {
  // Limits come first, so an oversized block costs no parsing.
  if (source.length > LIMITS.characters) {
    const message = `too long: expected at most ${LIMITS.characters.toLocaleString("en")} characters`;
    return stopped(error(lineAt(source, LIMITS.characters), message));
  }
  const lines = splitLines(source);
  if (lines.length > LIMITS.lines) {
    return stopped(error(LIMITS.lines + 1, `too many lines: expected at most ${LIMITS.lines}`));
  }

  const nodes: WireframeNode[] = [];
  const diagnostics: WireframeDiagnostic[] = [];
  // open[d] is the latest node at depth d; a root is depth 0 (level 1).
  const open: WireframeNode[] = [];
  lines.forEach((text, index) => {
    const line = index + 1;
    const indent = skipBlanks(text, 0);
    if (indent === text.length) return;
    const depth = depthOf(text.slice(0, indent), line, open, diagnostics);
    if (depth >= LIMITS.levels) {
      diagnostics.push(error(line, `nested too deep: expected at most ${LIMITS.levels} levels`));
    }
    const node = parseLine(text.slice(indent), line, diagnostics);
    open.length = depth;
    const parent = open[depth - 1];
    (parent === undefined ? nodes : parent.children).push(node);
    open.push(node);
    checkNode(node, parent, open[depth - 2], diagnostics);
  });
  return { nodes, diagnostics, renderable: diagnostics.every((d) => d.severity === "warning") };
}

function stopped(diagnostic: WireframeDiagnostic): WireframeParseResult {
  return { nodes: [], diagnostics: [diagnostic], renderable: false };
}

// A final line break ends the last line rather than starting an empty one.
function splitLines(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines;
}

/** The line holding `source[index]`, with the line breaks splitLines uses. */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) {
    const char = source[at];
    if (char === "\n" || (char === "\r" && source[at + 1] !== "\n")) line += 1;
  }
  return line;
}

/**
 * The depth a line's indentation gives it. A bad indent is an error; the line
 * still joins the tree at the nearest depth it can take.
 */
function depthOf(
  indent: string,
  line: number,
  open: readonly WireframeNode[],
  diagnostics: WireframeDiagnostic[],
): number {
  const width = indent.replaceAll("\t", "  ").length;
  const depth = Math.floor(width / 2);
  // One level below the line above.
  const deepest = open.length;
  if (indent.includes("\t")) {
    diagnostics.push(error(line, "indentation must be spaces, not tabs"));
  } else if (width % 2 !== 0) {
    diagnostics.push(error(line, `indentation must be a multiple of two spaces, found ${width}`));
  } else if (depth > deepest) {
    const above = open[deepest - 1];
    const message =
      above === undefined
        ? "expected no indentation on the first line"
        : `indented ${width} spaces: expected at most ${deepest * 2}, one level below line ${above.line}`;
    diagnostics.push(error(line, message));
  }
  return Math.min(depth, deepest);
}

/** Split `kind.variant#id key=value Label` into a node. `content` starts with a non-blank. */
function parseLine(content: string, line: number, diagnostics: WireframeDiagnostic[]): WireframeNode {
  let at = nextBlank(content, 0);
  const head = content.slice(0, at);
  const hash = head.indexOf("#");
  const [kind = "", ...variants] = (hash === -1 ? head : head.slice(0, hash)).split(".");
  const node: WireframeNode = { kind, variants, attributes: [], label: "", line, children: [] };
  if (hash !== -1) node.id = head.slice(hash + 1);

  for (;;) {
    at = skipBlanks(content, at);
    ATTRIBUTE.lastIndex = at;
    if (!ATTRIBUTE.test(content)) break;
    const key = content.slice(at, ATTRIBUTE.lastIndex - 1);
    at = ATTRIBUTE.lastIndex;
    let value: string;
    if (content[at] === '"') {
      const quoted = readQuoted(content, at);
      value = quoted.text;
      at = quoted.end;
      if (!quoted.closed) diagnostics.push(unterminated(line));
      else if (at < content.length && !isBlank(content[at])) {
        diagnostics.push(error(line, "expected a space after the closing quote"));
      }
    } else {
      const end = nextBlank(content, at);
      value = content.slice(at, end);
      at = end;
    }
    node.attributes.push({ key, value });
  }

  if (content[at] === '"') {
    const quoted = readQuoted(content, at);
    node.label = quoted.text;
    if (!quoted.closed) diagnostics.push(unterminated(line));
    else if (skipBlanks(content, quoted.end) < content.length) {
      diagnostics.push(error(line, "expected the line to end after the closing quote"));
    }
  } else {
    let end = content.length;
    while (end > at && isBlank(content[end - 1])) end -= 1;
    node.label = content.slice(at, end);
  }
  return node;
}

/** Read a quoted string starting at the `"` at `start`. `\"` and `\\` are the only escapes. */
function readQuoted(content: string, start: number): { text: string; end: number; closed: boolean } {
  let text = "";
  let from = start + 1;
  for (let at = from; at < content.length; at += 1) {
    const char = content[at];
    if (char === '"') return { text: text + content.slice(from, at), end: at + 1, closed: true };
    const next = content[at + 1];
    if (char === "\\" && (next === '"' || next === "\\")) {
      text += content.slice(from, at) + next;
      at += 1;
      from = at + 1;
    }
  }
  return { text: text + content.slice(from), end: content.length, closed: false };
}

/** Warn about anything outside the vocabulary, or in the wrong place. */
function checkNode(
  node: WireframeNode,
  parent: WireframeNode | undefined,
  grandparent: WireframeNode | undefined,
  diagnostics: WireframeDiagnostic[],
): void {
  const warn = (message: string): void => {
    diagnostics.push({ line: node.line, severity: "warning", message });
  };
  const { kind } = node;
  const rule = KINDS.get(kind);
  if (rule === undefined) {
    warn(`${kind === "" ? "missing kind" : `unknown kind ${quote(kind)}`}: expected ${list([...KINDS.keys()])}`);
  } else {
    for (const variant of node.variants) {
      if (variant === "") warn('empty variant: expected a name after "."');
      else if (rule.variants.length === 0) warn(`unknown variant ${quote(`.${variant}`)}: ${kind} takes no variants`);
      else if (!rule.variants.includes(variant)) {
        warn(`unknown variant ${quote(`.${variant}`)} on ${kind}: expected ${list(rule.variants.map((v) => `.${v}`))}`);
      }
    }
  }
  if (node.id === "") warn('missing id: expected a name after "#"');
  else if (node.id !== undefined && !ID.test(node.id)) {
    warn(`invalid id ${quote(`#${node.id}`)}: expected letters, digits, - or _`);
  }
  let hasFieldLabel = false;
  for (const { key } of node.attributes) {
    if (key !== "label") {
      warn(`unknown attribute ${quote(key)}: expected label on input or select (quote a label that starts with word=)`);
      continue;
    }
    if (hasFieldLabel) warn('repeated attribute "label": the first value is used');
    hasFieldLabel = true;
    if (kind !== "input" && kind !== "select") warn('attribute "label" is only allowed on input or select');
  }
  if (rule === undefined) return;

  if (!rule.label && node.label !== "") warn(`${kind} takes no label`);
  if (kind === "icon" && !ICONS.includes(node.label)) {
    warn(`${node.label === "" ? "icon needs a name" : `unknown icon ${quote(node.label)}`}: expected ${list(ICONS)}`);
  }
  if (ROOTS.includes(kind)) {
    if (parent !== undefined) warn(`${kind} must be at the top level`);
    return;
  }
  const place = placeOf(parent, grandparent);
  if (kind === "cell") {
    const sorts = node.variants.filter((variant) => CELL_SORT_VARIANTS.includes(variant));
    if (sorts.length > 0 && !(place === "table row" && parent?.variants.includes("head"))) {
      warn(`cell.${sorts[0]} must be directly inside a header row`);
    }
    if (sorts.length > 1) warn("cell takes one of .sortable, .ascending or .descending: the first is used");
  }
  if (place === "table row" && kind !== "cell") warn(`${kind} in a table row: expected cell`);
  else if (place === undefined || !(rule.place.includes(place) || (place === "frame" && rule.place.includes("root")))) {
    const top = rule.place.includes("top") ? "at the top level or " : "";
    warn(`${kind} must be ${top}directly inside ${inside(rule.place.filter((place) => place !== "top"))}`);
  }
  else if (kind === "row") {
    // A table row takes .head, and a row anywhere else .end.
    const [variant, expected] = place === "table" ? ["end", inside(["root"])] : ["head", inside(["table"])];
    if (node.variants.includes(variant)) warn(`row.${variant} must be directly inside ${expected}`);
  }
}

/** Where a node with this parent stands; undefined inside a kind that holds no known ones. */
function placeOf(parent: WireframeNode | undefined, grandparent: WireframeNode | undefined): Place | undefined {
  if (parent === undefined) return "top";
  if (parent.kind === "frame") return "frame";
  if (ROOTS.includes(parent.kind)) return "root";
  if (parent.kind === "row") return grandparent?.kind === "table" ? "table row" : "row";
  if (parent.kind === "table" || parent.kind === "toggle" || parent.kind === "cell" || parent.kind === "card") return parent.kind;
  return undefined;
}

/** Places as a message names them: `dialog, banner, page or row`. */
function inside(places: readonly Place[]): string {
  return list(places.flatMap((place) => (place === "root" ? ROOTS : place === "table row" ? ["a table row"] : [place])));
}

function error(line: number, message: string): WireframeDiagnostic {
  return { line, severity: "error", message };
}

function unterminated(line: number): WireframeDiagnostic {
  return error(line, 'unterminated quote: expected a closing "');
}

function isBlank(char: string | undefined): boolean {
  return char === " " || char === "\t";
}

function skipBlanks(text: string, from: number): number {
  let at = from;
  while (at < text.length && isBlank(text[at])) at += 1;
  return at;
}

function nextBlank(text: string, from: number): number {
  let at = from;
  while (at < text.length && !isBlank(text[at])) at += 1;
  return at;
}

/** Source text inside a message, quoted and cut short. */
function quote(text: string): string {
  return `"${text.length > 40 ? `${text.slice(0, 40)}…` : text}"`;
}

function list(items: readonly string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}
