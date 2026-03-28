export const DEVICE_PROFILES = {
  mobile: { name: "mobile", label: "mobile phone", frame: "mobile", width: 390, height: 844 },
  app: { name: "app", label: "desktop app", frame: "app", width: 1280, height: 800 },
  browser: { name: "browser", label: "web browser", frame: "browser", width: 1440, height: 900 },
};

const INDENT_SIZE = 2;
const SUPPORTED_NODE_KINDS = new Set(["screen", "split", "region"]);
const FENCE_REGEX = /```([^\n]*)\n([\s\S]*?)```/g;
const TOKEN_REGEX = /[A-Za-z][\w-]*="(?:\\.|[^"])*"|"(?:\\.|[^"])*"|[^\s]+/g;

export function extractWireframeBlocks(markdownSource) {
  const blocks = [];

  for (const match of markdownSource.matchAll(FENCE_REGEX)) {
    const info = parseFenceInfo(match[1] || "");
    if (info.language !== "wireframe") continue;

    blocks.push({
      code: (match[2] || "").replace(/\n$/, ""),
      info,
    });
  }

  return blocks;
}

export function parseFenceInfo(rawInfo = "") {
  const info = rawInfo.trim();

  if (!info) {
    return { language: "", options: {} };
  }

  const language = info.match(/^[^\s\[]+/)?.[0] || "";
  const bracketSpec = info.match(/\[(.*?)\]/)?.[1] || "";

  return {
    language,
    options: language === "wireframe" ? parseWireframeFenceOptions(bracketSpec) : {},
  };
}

export function parseWireframeFenceOptions(rawSpec = "") {
  const spec = rawSpec.trim();
  if (!spec) return {};

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
    width: options.boxWidth ?? null,
    height: options.boxHeight ?? null,
  };
}

export function parseWireframe(source) {
  const lines = source.replace(/\t/g, "  ").split("\n");
  const root = {
    kind: "root",
    children: [],
  };
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
  const node = {
    kind,
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
    return Array.from({ length: childCount }, () => ({ kind: "rest" }));
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
      if (node.kind !== "screen") {
        throw new Error(`Only "screen" is supported at the top level. Found "${node.kind}" on line ${lineNumber}.`);
      }
      return;
    case "screen":
      if (parent.children.length >= 1) {
        throw new Error(`A "screen" can only contain one child layout node. Found "${node.kind}" on line ${lineNumber}.`);
      }
      if (node.kind !== "split" && node.kind !== "region") {
        throw new Error(`Only "split" and "region" are supported inside "screen". Found "${node.kind}" on line ${lineNumber}.`);
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
