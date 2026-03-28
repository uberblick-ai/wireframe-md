// @ts-check

/**
 * @typedef {"mobile" | "app" | "browser"} DeviceName
 * @typedef {"screen" | "frame" | "split" | "region" | "tree" | "group" | "item" | "stack" | "props" | "prop" | "code_block" | "code_line" | "select" | "input"} WireframeNodeKind
 * @typedef {"horizontal" | "vertical"} SplitAxis
 * @typedef {"card" | "plain"} SurfaceStyle
 * @typedef {{ name: DeviceName, label: string, frame: DeviceName, width: number, height: number }} DeviceProfile
 * @typedef {{ type: "string" | "number" | "boolean" | "enum", defaultValue?: string | number | boolean, values?: string[] }} AttributeDefinition
 * @typedef {{ kind: WireframeNodeKind, placement: "top-level" | "layout", maxChildren: number | null, allowedChildren: WireframeNodeKind[], attributes: Record<string, AttributeDefinition> }} ElementDefinition
 */

/** @type {Record<DeviceName, DeviceProfile>} */
export const DEVICE_PROFILES = {
  mobile: { name: "mobile", label: "mobile phone", frame: "mobile", width: 390, height: 844 },
  app: { name: "app", label: "desktop app", frame: "app", width: 1280, height: 800 },
  browser: { name: "browser", label: "web browser", frame: "browser", width: 1440, height: 900 },
};

/** @type {WireframeNodeKind[]} */
export const SUPPORTED_NODE_KINDS = ["screen", "frame", "split", "region", "tree", "group", "item", "stack", "props", "prop", "code_block", "code_line", "select", "input"];

/** @type {Record<WireframeNodeKind, ElementDefinition>} */
export const ELEMENT_DEFINITIONS = {
  screen: {
    kind: "screen",
    placement: "top-level",
    maxChildren: 1,
    allowedChildren: ["split", "region"],
    attributes: {
      title: { type: "string" },
      device: { type: "enum", defaultValue: "app", values: ["mobile", "app", "browser"] },
      width: { type: "number" },
      height: { type: "number" },
      url: { type: "string" },
      surface: { type: "enum", defaultValue: "card", values: ["card", "plain"] },
    },
  },
  frame: {
    kind: "frame",
    placement: "top-level",
    maxChildren: 1,
    allowedChildren: ["split", "region"],
    attributes: {
      title: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      surface: { type: "enum", defaultValue: "card", values: ["card", "plain"] },
    },
  },
  split: {
    kind: "split",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["split", "region"],
    attributes: {
      axis: { type: "enum", defaultValue: "horizontal", values: ["horizontal", "vertical"] },
      sizes: { type: "string" },
      surface: { type: "enum", defaultValue: "card", values: ["card", "plain"] },
    },
  },
  region: {
    kind: "region",
    placement: "layout",
    maxChildren: 1,
    allowedChildren: ["split", "tree", "stack", "props", "code_block", "select", "input"],
    attributes: {
      label: { type: "string" },
      surface: { type: "enum", defaultValue: "card", values: ["card", "plain"] },
      placeholder: { type: "boolean", defaultValue: true },
      show_label: { type: "boolean", defaultValue: true },
    },
  },
  tree: {
    kind: "tree",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["group", "item"],
    attributes: {},
  },
  group: {
    kind: "group",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["group", "item"],
    attributes: {
      label: { type: "string" },
      expanded: { type: "boolean", defaultValue: true },
    },
  },
  item: {
    kind: "item",
    placement: "layout",
    maxChildren: 0,
    allowedChildren: [],
    attributes: {
      label: { type: "string" },
      selected: { type: "boolean", defaultValue: false },
    },
  },
  stack: {
    kind: "stack",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["tree", "stack", "props", "code_block", "select", "input"],
    attributes: {
      gap: { type: "number", defaultValue: 12 },
    },
  },
  props: {
    kind: "props",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["prop"],
    attributes: {},
  },
  prop: {
    kind: "prop",
    placement: "layout",
    maxChildren: 0,
    allowedChildren: [],
    attributes: {
      key: { type: "string" },
      value: { type: "string" },
    },
  },
  code_block: {
    kind: "code_block",
    placement: "layout",
    maxChildren: null,
    allowedChildren: ["code_line"],
    attributes: {
      language: { type: "string" },
    },
  },
  code_line: {
    kind: "code_line",
    placement: "layout",
    maxChildren: 0,
    allowedChildren: [],
    attributes: {
      value: { type: "string" },
    },
  },
  select: {
    kind: "select",
    placement: "layout",
    maxChildren: 0,
    allowedChildren: [],
    attributes: {
      label: { type: "string" },
      value: { type: "string" },
      options: { type: "string" },
    },
  },
  input: {
    kind: "input",
    placement: "layout",
    maxChildren: 0,
    allowedChildren: [],
    attributes: {
      label: { type: "string" },
      value: { type: "string" },
      type: { type: "string" },
    },
  },
};

/**
 * @param {string} rawKind
 * @returns {rawKind is WireframeNodeKind}
 */
export function isSupportedNodeKind(rawKind) {
  return SUPPORTED_NODE_KINDS.includes(/** @type {WireframeNodeKind} */ (rawKind));
}

/**
 * @param {string} rawKind
 * @returns {ElementDefinition | null}
 */
export function getElementDefinition(rawKind) {
  return ELEMENT_DEFINITIONS[/** @type {WireframeNodeKind} */ (rawKind)] || null;
}

/**
 * @param {WireframeNodeKind} parentKind
 * @param {WireframeNodeKind} childKind
 */
export function canContainChild(parentKind, childKind) {
  const parent = getElementDefinition(parentKind);
  return parent ? parent.allowedChildren.includes(childKind) : false;
}
