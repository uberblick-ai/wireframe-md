export const DEVICE_PROFILES = {
  mobile: { name: "mobile", label: "mobile phone", frame: "mobile", width: 390, height: 844 },
  app: { name: "app", label: "desktop app", frame: "app", width: 1280, height: 800 },
  browser: { name: "browser", label: "web browser", frame: "browser", width: 1440, height: 900 },
};

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
  const children = [];

  lines.forEach((rawLine, lineIndex) => {
    if (!rawLine.trim()) return;

    const indent = rawLine.match(/^ */)[0].length;
    if (indent !== 0) {
      throw new Error(`Only top-level screens are supported in v0. Found indentation on line ${lineIndex + 1}.`);
    }

    const node = parseNodeLine(rawLine.trim(), lineIndex + 1);
    if (node.kind !== "screen") {
      throw new Error(`Only "screen" is supported in v0. Found "${node.kind}" on line ${lineIndex + 1}.`);
    }

    children.push(node);
  });

  return { kind: "root", children };
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
  if (attrs.size && /^(\d+)x(\d+)$/.test(String(attrs.size))) {
    const [, width, height] = String(attrs.size).match(/^(\d+)x(\d+)$/);
    return { width: Number(width), height: Number(height) };
  }

  return {
    width: Number(attrs.width || profile.width),
    height: Number(attrs.height || profile.height),
  };
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
