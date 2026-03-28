// @ts-check

/**
 * @typedef {"mobile" | "app" | "browser"} DeviceName
 * @typedef {"screen" | "frame" | "split" | "region"} WireframeNodeKind
 * @typedef {"horizontal" | "vertical"} SplitAxis
 * @typedef {"card" | "plain"} SurfaceStyle
 * @typedef {string | number | boolean} WireframeAttrValue
 * @typedef {{ name: DeviceName, label: string, frame: DeviceName, width: number, height: number }} DeviceProfile
 * @typedef {{ boxWidth: number | null, boxHeight: number | null }} RenderBox
 * @typedef {{ language: string, options: RenderBox }} FenceInfo
 * @typedef {{ code: string, info: FenceInfo }} WireframeBlock
 * @typedef {{ indent: number, marker: string, markerLength: number, info: FenceInfo }} FenceStart
 * @typedef {{ kind: "rest" } | { kind: "fixed", value: number }} SplitSize
 * @typedef {{ axis: SplitAxis, surface: SurfaceStyle, sizes: SplitSize[] }} SplitDefinition
 * @typedef {{ kind: WireframeNodeKind, bare: string[], texts: string[], attrs: Record<string, WireframeAttrValue>, children: WireframeNode[] }} WireframeNode
 * @typedef {{ kind: "root", children: WireframeNode[] }} WireframeRoot
 * @typedef {{ indent: number, node: WireframeRoot | WireframeNode, lineNumber: number }} StackEntry
 */

/** @type {Record<DeviceName, DeviceProfile>} */
export const DEVICE_PROFILES = {
  mobile: { name: "mobile", label: "mobile phone", frame: "mobile", width: 390, height: 844 },
  app: { name: "app", label: "desktop app", frame: "app", width: 1280, height: 800 },
  browser: { name: "browser", label: "web browser", frame: "browser", width: 1440, height: 900 },
};

const INDENT_SIZE = 2;
const SUPPORTED_NODE_KINDS = new Set(["screen", "frame", "split", "region"]);
const FENCE_START_REGEX = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/;
const FENCE_CLOSE_REGEX = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;
const TOKEN_REGEX = /[A-Za-z][\w-]*="(?:\\.|[^"])*"|"(?:\\.|[^"])*"|[^\s]+/g;

export function extractWireframeBlocks(markdownSource) {
  /** @type {WireframeBlock[]} */
  const blocks = [];
  const lines = String(markdownSource || "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const opener = parseFenceStartLine(lines[lineIndex]);
    if (!opener || opener.info.language !== "wireframe") continue;

    const codeLines = [];
    let closingLineIndex = lineIndex + 1;

    while (closingLineIndex < lines.length && !isMatchingFenceCloseLine(lines[closingLineIndex], opener)) {
      codeLines.push(lines[closingLineIndex]);
      closingLineIndex += 1;
    }

    if (closingLineIndex >= lines.length) {
      continue;
    }

    blocks.push({
      code: codeLines.join("\n"),
      info: opener.info,
    });
    lineIndex = closingLineIndex;
  }

  return blocks;
}

export function parseFenceInfo(rawInfo = "") {
  const info = rawInfo.trim();

  if (!info) {
    return { language: "", options: normalizeRenderBox() };
  }

  const language = info.match(/^[^\s\[]+/)?.[0] || "";
  const bracketSpec = info.match(/\[(.*?)\]/)?.[1] || "";

  return {
    language,
    options: language === "wireframe" ? parseWireframeFenceOptions(bracketSpec) : normalizeRenderBox(),
  };
}

export function parseWireframeFenceOptions(rawSpec = "") {
  const spec = rawSpec.trim();
  if (!spec) return normalizeRenderBox();

  const sizeMatch = spec.match(/^(\d+)?x(\d+)?$/);
  if (!sizeMatch) {
    throw new Error(`Invalid wireframe fence options "${spec}". Use [x400], [960x], or [1280x800].`);
  }

  const [, width, height] = sizeMatch;

  return {
    boxWidth: width ? Number(width) : null,
    boxHeight: height ? Number(height) : null,
  };
}

export function normalizeRenderBox(options = {}) {
  return {
    boxWidth: options.boxWidth ?? options.width ?? null,
    boxHeight: options.boxHeight ?? options.height ?? null,
  };
}

export function formatWireframeFenceInfo(options = {}) {
  const box = normalizeRenderBox(options);

  if (box.boxWidth == null && box.boxHeight == null) {
    return "wireframe";
  }

  const width = box.boxWidth == null ? "" : Number(box.boxWidth);
  const height = box.boxHeight == null ? "" : Number(box.boxHeight);

  if ((box.boxWidth != null && !Number.isFinite(width)) || (box.boxHeight != null && !Number.isFinite(height))) {
    throw new Error("Wireframe fence dimensions must be numbers when provided.");
  }

  return `wireframe[${width === "" ? "" : width}x${height === "" ? "" : height}]`;
}

export function parseFenceStartLine(rawLine = "") {
  const match = String(rawLine).match(FENCE_START_REGEX);
  if (!match) return null;

  const [, indent, markerText, rawInfo] = match;

  return {
    indent: indent.length,
    marker: markerText[0],
    markerLength: markerText.length,
    info: parseFenceInfo((rawInfo || "").trim()),
  };
}

export function isMatchingFenceCloseLine(rawLine = "", opener = null) {
  if (!opener) return false;

  const match = String(rawLine).match(FENCE_CLOSE_REGEX);
  if (!match) return false;

  const markerText = match[2];
  return markerText[0] === opener.marker && markerText.length >= opener.markerLength;
}

export function parseWireframe(source) {
  const lines = source.replace(/\t/g, "  ").split("\n");
  /** @type {WireframeRoot} */
  const root = {
    kind: "root",
    children: [],
  };
  /** @type {StackEntry[]} */
  const stack = [{ indent: -1, node: root, lineNumber: 0 }];

  lines.forEach((rawLine, lineIndex) => {
    if (!rawLine.trim()) return;

    const lineNumber = lineIndex + 1;
    const indent = normalizeIndent(rawLine.match(/^ */)[0].length, lineNumber);

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

export function parseNodeLine(line, lineNumber = 1) {
  const tokens = line.match(TOKEN_REGEX) || [];
  if (!tokens.length) {
    throw new Error(`Unable to parse line ${lineNumber}.`);
  }

  const [kind, ...rest] = tokens;
  /** @type {WireframeNode} */
  const node = {
    kind: /** @type {WireframeNodeKind} */ (kind),
    bare: [],
    texts: [],
    attrs: {},
    children: [],
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

export function resolveScreenSize(attrs = {}, profile = DEVICE_PROFILES.app) {
  return {
    width: Number(attrs.width || profile.width),
    height: Number(attrs.height || profile.height),
  };
}

export function resolveSplitAxis(rawAxis = "horizontal") {
  const axis = String(rawAxis || "horizontal").toLowerCase();

  if (axis === "horizontal" || axis === "vertical") {
    return axis;
  }

  throw new Error(`Unsupported split axis "${rawAxis}". Expected "horizontal" or "vertical".`);
}

export function resolveSplitDefinition(attrs = {}, childCount = 0) {
  if (childCount < 2) {
    throw new Error(`A "split" must contain at least 2 child nodes. Found ${childCount}.`);
  }

  const axis = resolveSplitAxis(attrs.axis);
  const surface = resolveSurfaceStyle(attrs.surface);
  const sizes = resolveSplitSizes(attrs.sizes, childCount);

  return { axis, surface, sizes };
}

export function resolveSurfaceStyle(rawSurface = "card") {
  const surface = String(rawSurface || "card").toLowerCase();

  if (surface === "card" || surface === "plain") {
    return surface;
  }

  throw new Error(`Unsupported surface "${rawSurface}". Expected "card" or "plain".`);
}

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

    if (/^\d+$/.test(token)) {
      return { kind: "fixed", value: Number(token) };
    }

    throw new Error(`Unsupported split size "${token}". Use pixels like "260" or "rest".`);
  });
}

function parseValue(rawValue) {
  if (isQuoted(rawValue)) return unquote(rawValue);
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (/^\d+(\.\d+)?$/.test(rawValue)) return Number(rawValue);
  return rawValue;
}

function isQuoted(token) {
  return token.startsWith("\"") && token.endsWith("\"");
}

function unquote(token) {
  return token.slice(1, -1).replace(/\\"/g, "\"");
}

function normalizeIndent(rawIndent, lineNumber) {
  if (rawIndent % INDENT_SIZE !== 0) {
    throw new Error(`Invalid indentation on line ${lineNumber}. Use multiples of ${INDENT_SIZE} spaces.`);
  }

  return rawIndent / INDENT_SIZE;
}

function validateParentChild(parent, node, lineNumber) {
  if (!SUPPORTED_NODE_KINDS.has(node.kind)) {
    throw new Error(`Unsupported node "${node.kind}" on line ${lineNumber}. Expected one of: screen, split, region.`);
  }

  switch (parent.kind) {
    case "root":
      if (node.kind !== "screen" && node.kind !== "frame") {
        throw new Error(`Only "screen" and "frame" are supported at the top level. Found "${node.kind}" on line ${lineNumber}.`);
      }
      return;
    case "screen":
    case "frame":
      if (parent.children.length >= 1) {
        throw new Error(`A "${parent.kind}" can only contain one child layout node. Found "${node.kind}" on line ${lineNumber}.`);
      }
      if (node.kind !== "split" && node.kind !== "region") {
        throw new Error(`Only "split" and "region" are supported inside "${parent.kind}". Found "${node.kind}" on line ${lineNumber}.`);
      }
      return;
    case "split":
      if (node.kind !== "split" && node.kind !== "region") {
        throw new Error(`Only "split" and "region" are supported inside "split". Found "${node.kind}" on line ${lineNumber}.`);
      }
      return;
    case "region":
      throw new Error(`"region" cannot contain nested content. Found "${node.kind}" on line ${lineNumber}.`);
    default:
      throw new Error(`Unsupported parent "${parent.kind}" on line ${lineNumber}.`);
  }
}

function finalizeNode(entry) {
  if (entry.node.kind !== "split") {
    return;
  }

  try {
    resolveSplitDefinition(entry.node.attrs, entry.node.children.length);
  } catch (error) {
    throw new Error(`Split on line ${entry.lineNumber}: ${error.message}`);
  }
}
