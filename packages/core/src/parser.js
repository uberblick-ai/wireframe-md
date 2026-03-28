// @ts-check

import { DEVICE_PROFILES, canContainChild, getElementDefinition, isSupportedNodeKind } from "./definitions.js";

const INDENT_SIZE = 2;
const TOKEN_REGEX = /[A-Za-z][\w-]*="(?:\\.|[^"])*"|"(?:\\.|[^"])*"|[^\s]+/g;

/**
 * @typedef {"screen" | "frame" | "split" | "region"} WireframeNodeKind
 * @typedef {"horizontal" | "vertical"} SplitAxis
 * @typedef {"card" | "plain"} SurfaceStyle
 * @typedef {string | number | boolean} WireframeAttrValue
 * @typedef {{ kind: "rest" } | { kind: "auto" } | { kind: "fixed", value: number }} SplitSize
 * @typedef {{ axis: SplitAxis, surface: SurfaceStyle, sizes: SplitSize[] }} SplitDefinition
 * @typedef {{ kind: WireframeNodeKind, bare: string[], texts: string[], attrs: Record<string, WireframeAttrValue>, children: RawWireframeNode[], lineNumber: number }} RawWireframeNode
 * @typedef {{ kind: "root", children: RawWireframeNode[] }} RawWireframeRoot
 * @typedef {{ indent: number, node: RawWireframeRoot | RawWireframeNode, lineNumber: number }} StackEntry
 */

/**
 * @param {string} source
 * @returns {RawWireframeRoot}
 */
export function parseWireframe(source) {
  const lines = source.replace(/\t/g, "  ").split("\n");
  /** @type {RawWireframeRoot} */
  const root = {
    kind: "root",
    children: [],
  };
  /** @type {StackEntry[]} */
  const stack = [{ indent: -1, node: root, lineNumber: 0 }];

  lines.forEach((rawLine, lineIndex) => {
    if (!rawLine.trim()) return;

    const lineNumber = lineIndex + 1;
    const indent = normalizeIndent(rawLine.match(/^ */)?.[0]?.length || 0, lineNumber);

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      finalizeNode(stack.pop());
    }

    const parentEntry = stack[stack.length - 1];
    if (indent > parentEntry.indent + 1) {
      throw new Error(`Invalid indentation on line ${lineNumber}. Indentation can only increase by one level at a time.`);
    }

    const node = parseNodeLine(rawLine.trim(), lineNumber);
    validateParentChild(parentEntry.node, node, lineNumber);
    parentEntry.node.children.push(node);
    stack.push({ indent, node, lineNumber });
  });

  while (stack.length > 1) {
    finalizeNode(stack.pop());
  }

  return root;
}

/**
 * @param {string} line
 * @param {number} [lineNumber]
 * @returns {RawWireframeNode}
 */
export function parseNodeLine(line, lineNumber = 1) {
  const tokens = line.match(TOKEN_REGEX) || [];
  if (!tokens.length) {
    throw new Error(`Unable to parse line ${lineNumber}.`);
  }

  const [kindToken, ...rest] = tokens;
  /** @type {RawWireframeNode} */
  const node = {
    kind: /** @type {WireframeNodeKind} */ (kindToken),
    bare: [],
    texts: [],
    attrs: {},
    children: [],
    lineNumber,
  };

  rest.forEach((token) => {
    const attrMatch = token.match(/^([A-Za-z][\w-]*)=(.+)$/);
    if (attrMatch) {
      node.attrs[attrMatch[1]] = parseValue(attrMatch[2]);
      return;
    }

    if (isQuoted(token)) {
      node.texts.push(unquote(token));
      return;
    }

    node.bare.push(token);
  });

  return node;
}

/**
 * @param {string | null | undefined} rawDevice
 */
export function resolveDeviceProfile(rawDevice = "app") {
  const requested = String(rawDevice || "app").toLowerCase();
  const profile = DEVICE_PROFILES[requested];

  if (profile) {
    return profile;
  }

  if (!rawDevice) {
    return DEVICE_PROFILES.app;
  }

  throw new Error(`Unsupported device "${rawDevice}". Expected one of: mobile, app, browser.`);
}

/**
 * @param {Record<string, WireframeAttrValue>} [attrs]
 * @param {typeof DEVICE_PROFILES.app} [profile]
 */
export function resolveScreenSize(attrs = {}, profile = DEVICE_PROFILES.app) {
  return {
    width: Number(attrs.width || profile.width),
    height: Number(attrs.height || profile.height),
  };
}

/**
 * @param {string | number | boolean | undefined | null} rawAxis
 * @returns {SplitAxis}
 */
export function resolveSplitAxis(rawAxis = "horizontal") {
  const axis = String(rawAxis || "horizontal").toLowerCase();

  if (axis === "horizontal" || axis === "vertical") {
    return axis;
  }

  throw new Error(`Unsupported split axis "${rawAxis}". Expected "horizontal" or "vertical".`);
}

/**
 * @param {Record<string, WireframeAttrValue>} [attrs]
 * @param {number} [childCount]
 * @returns {SplitDefinition}
 */
export function resolveSplitDefinition(attrs = {}, childCount = 0) {
  if (childCount < 2) {
    throw new Error(`A "split" must contain at least 2 child nodes. Found ${childCount}.`);
  }

  const axis = resolveSplitAxis(attrs.axis);
  const surface = resolveSurfaceStyle(attrs.surface);
  const sizes = resolveSplitSizes(attrs.sizes, childCount);

  return { axis, surface, sizes };
}

/**
 * @param {string | number | boolean | undefined | null} rawSurface
 * @returns {SurfaceStyle}
 */
export function resolveSurfaceStyle(rawSurface = "card") {
  const surface = String(rawSurface || "card").toLowerCase();

  if (surface === "card" || surface === "plain") {
    return surface;
  }

  throw new Error(`Unsupported surface "${rawSurface}". Expected "card" or "plain".`);
}

/**
 * @param {string | number | boolean | undefined | null} rawSizes
 * @param {number} [childCount]
 * @returns {SplitSize[]}
 */
function resolveSplitSizes(rawSizes = "", childCount = 0) {
  if (rawSizes == null || rawSizes === "") {
    return Array.from({ length: childCount }, () => /** @type {SplitSize} */ ({ kind: "rest" }));
  }

  const tokens = String(rawSizes)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length !== childCount) {
    throw new Error(`Split sizes must provide one entry per child. Expected ${childCount}, received ${tokens.length}.`);
  }

  return tokens.map((token) => {
    if (token.toLowerCase() === "rest") {
      return { kind: "rest" };
    }

    if (token.toLowerCase() === "auto") {
      return { kind: "auto" };
    }

    if (/^\d+$/.test(token)) {
      return { kind: "fixed", value: Number(token) };
    }

    throw new Error(`Unsupported split size "${token}". Use pixels like "260", "auto", or "rest".`);
  });
}

/**
 * @param {string} rawValue
 * @returns {WireframeAttrValue}
 */
function parseValue(rawValue) {
  if (isQuoted(rawValue)) return unquote(rawValue);
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (/^\d+(\.\d+)?$/.test(rawValue)) return Number(rawValue);
  return rawValue;
}

/**
 * @param {string} token
 */
function isQuoted(token) {
  return token.startsWith("\"") && token.endsWith("\"");
}

/**
 * @param {string} token
 */
function unquote(token) {
  return token.slice(1, -1).replace(/\\"/g, "\"");
}

/**
 * @param {number} rawIndent
 * @param {number} lineNumber
 */
function normalizeIndent(rawIndent, lineNumber) {
  if (rawIndent % INDENT_SIZE !== 0) {
    throw new Error(`Invalid indentation on line ${lineNumber}. Use multiples of ${INDENT_SIZE} spaces.`);
  }

  return rawIndent / INDENT_SIZE;
}

/**
 * @param {RawWireframeRoot | RawWireframeNode} parent
 * @param {RawWireframeNode} node
 * @param {number} lineNumber
 */
function validateParentChild(parent, node, lineNumber) {
  if (!isSupportedNodeKind(node.kind)) {
    throw new Error(`Unsupported node "${node.kind}" on line ${lineNumber}. Expected one of: screen, frame, split, region.`);
  }

  if (parent.kind === "root") {
    const definition = getElementDefinition(node.kind);
    if (!definition || definition.placement !== "top-level") {
      throw new Error(`Only "screen" and "frame" are supported at the top level. Found "${node.kind}" on line ${lineNumber}.`);
    }
    return;
  }

  const parentDefinition = getElementDefinition(parent.kind);
  if (!parentDefinition) {
    throw new Error(`Unsupported parent "${parent.kind}" on line ${lineNumber}.`);
  }

  if (parentDefinition.maxChildren != null && parent.children.length >= parentDefinition.maxChildren) {
    if (parentDefinition.maxChildren === 0) {
      throw new Error(`"${parent.kind}" cannot contain nested content. Found "${node.kind}" on line ${lineNumber}.`);
    }

    throw new Error(`A "${parent.kind}" can only contain ${parentDefinition.maxChildren} child layout node. Found "${node.kind}" on line ${lineNumber}.`);
  }

  if (!canContainChild(parent.kind, node.kind)) {
    const allowed = parentDefinition.allowedChildren.map((kind) => `"${kind}"`).join(" and ");
    throw new Error(`Only ${allowed} are supported inside "${parent.kind}". Found "${node.kind}" on line ${lineNumber}.`);
  }
}

/**
 * @param {StackEntry | undefined} entry
 */
function finalizeNode(entry) {
  if (!entry || entry.node.kind !== "split") {
    return;
  }

  try {
    resolveSplitDefinition(entry.node.attrs, entry.node.children.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Split on line ${entry.lineNumber}: ${message}`);
  }
}

