// @ts-check

import { parseWireframe, resolveDeviceProfile, resolveScreenSize, resolveSplitDefinition, resolveSurfaceStyle } from "./parser.js";

const FRAME_DEFAULT_WIDTH = 640;
const FRAME_DEFAULT_HEIGHT = 420;

/**
 * @typedef {ReturnType<typeof parseWireframe>} RawWireframeRoot
 * @typedef {RawWireframeRoot["children"][number]} RawWireframeNode
 * @typedef {ReturnType<typeof resolveDeviceProfile>} DeviceProfile
 * @typedef {ReturnType<typeof resolveSplitDefinition>} SplitDefinition
 * @typedef {{ kind: "item", lineNumber: number, label: string, selected: boolean }} CompiledItemNode
 * @typedef {{ kind: "group", lineNumber: number, label: string, expanded: boolean, children: CompiledTreeChildNode[] }} CompiledGroupNode
 * @typedef {{ kind: "tree", lineNumber: number, children: CompiledTreeChildNode[] }} CompiledTreeNode
 * @typedef {CompiledGroupNode | CompiledItemNode} CompiledTreeChildNode
 * @typedef {{ kind: "stack", lineNumber: number, gap: number, children: CompiledContentNode[] }} CompiledStackNode
 * @typedef {CompiledSelectNode | CompiledInputNode} CompiledPropControlNode
 * @typedef {{ kind: "prop", lineNumber: number, key: string, value: string | null, control: CompiledPropControlNode | null }} CompiledPropNode
 * @typedef {{ kind: "props", lineNumber: number, children: CompiledPropNode[] }} CompiledPropsNode
 * @typedef {{ kind: "code_line", lineNumber: number, value: string }} CompiledCodeLineNode
 * @typedef {{ kind: "code_block", lineNumber: number, language: string | null, children: CompiledCodeLineNode[] }} CompiledCodeBlockNode
 * @typedef {{ kind: "select", lineNumber: number, label: string, value: string, options: string[] }} CompiledSelectNode
 * @typedef {{ kind: "input", lineNumber: number, label: string, value: string, inputType: string | null }} CompiledInputNode
 * @typedef {CompiledTreeNode | CompiledStackNode | CompiledPropsNode | CompiledCodeBlockNode | CompiledSelectNode | CompiledInputNode} CompiledContentNode
 * @typedef {{ kind: "region", lineNumber: number, label: string, surface: "card" | "plain", placeholder: boolean, showLabel: boolean, child: CompiledRegionChildNode | null }} CompiledRegionNode
 * @typedef {{ kind: "split", lineNumber: number, axis: SplitDefinition["axis"], surface: SplitDefinition["surface"], sizes: SplitDefinition["sizes"], children: CompiledLayoutNode[] }} CompiledSplitNode
 * @typedef {CompiledSplitNode | CompiledRegionNode} CompiledLayoutNode
 * @typedef {CompiledSplitNode | CompiledContentNode} CompiledRegionChildNode
 * @typedef {{ kind: "screen", lineNumber: number, title: string, surface: "card" | "plain", device: DeviceProfile["name"], deviceProfile: DeviceProfile, width: number, height: number, url: string | null, child: CompiledLayoutNode | null }} CompiledScreenNode
 * @typedef {{ kind: "frame", lineNumber: number, title: string, surface: "card" | "plain", width: number, height: number, child: CompiledLayoutNode | null }} CompiledFrameNode
 * @typedef {CompiledScreenNode | CompiledFrameNode} CompiledTopLevelNode
 * @typedef {{ kind: "root", children: CompiledTopLevelNode[] }} CompiledWireframeRoot
 */

/**
 * @param {string} source
 * @returns {CompiledWireframeRoot}
 */
export function compileWireframe(source) {
  return normalizeParsedWireframe(parseWireframe(source));
}

/**
 * @param {RawWireframeRoot} rawRoot
 * @returns {CompiledWireframeRoot}
 */
export function normalizeParsedWireframe(rawRoot) {
  return {
    kind: "root",
    children: rawRoot.children.map(normalizeTopLevelNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledTopLevelNode}
 */
function normalizeTopLevelNode(node) {
  switch (node.kind) {
    case "screen":
      return normalizeScreenNode(node);
    case "frame":
      return normalizeFrameNode(node);
    default:
      throw new Error(`Unsupported top-level node "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledScreenNode}
 */
function normalizeScreenNode(node) {
  const deviceProfile = resolveDeviceProfile(pickStringAttr(node.attrs.device));
  const surface = resolveSurfaceStyle(node.attrs.surface);
  const { width, height } = resolveScreenSize(node.attrs, deviceProfile);

  return {
    kind: "screen",
    lineNumber: node.lineNumber,
    title: pickNodeLabel(node, "Screen"),
    surface,
    device: deviceProfile.name,
    deviceProfile,
    width,
    height,
    url: pickStringAttr(node.attrs.url),
    child: node.children[0] ? normalizeLayoutNode(node.children[0]) : null,
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledFrameNode}
 */
function normalizeFrameNode(node) {
  return {
    kind: "frame",
    lineNumber: node.lineNumber,
    title: pickNodeLabel(node, ""),
    surface: resolveSurfaceStyle(node.attrs.surface),
    width: Number(node.attrs.width || FRAME_DEFAULT_WIDTH),
    height: Number(node.attrs.height || FRAME_DEFAULT_HEIGHT),
    child: node.children[0] ? normalizeLayoutNode(node.children[0]) : null,
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledLayoutNode}
 */
function normalizeLayoutNode(node) {
  switch (node.kind) {
    case "split":
      return normalizeSplitNode(node);
    case "region":
      return normalizeRegionNode(node);
    default:
      throw new Error(`Unsupported layout node "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledSplitNode}
 */
function normalizeSplitNode(node) {
  const split = resolveSplitDefinition(node.attrs, node.children.length);

  return {
    kind: "split",
    lineNumber: node.lineNumber,
    axis: split.axis,
    surface: split.surface,
    sizes: split.sizes,
    children: node.children.map(normalizeLayoutNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledRegionNode}
 */
function normalizeRegionNode(node) {
  return {
    kind: "region",
    lineNumber: node.lineNumber,
    label: pickNodeLabel(node, "Region"),
    surface: resolveSurfaceStyle(node.attrs.surface),
    placeholder: node.attrs.placeholder !== false,
    showLabel: node.attrs.show_label !== false,
    child: node.children[0] ? normalizeRegionChildNode(node.children[0]) : null,
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledRegionChildNode}
 */
function normalizeRegionChildNode(node) {
  switch (node.kind) {
    case "split":
      return normalizeSplitNode(node);
    case "tree":
      return normalizeTreeNode(node);
    case "stack":
      return normalizeStackNode(node);
    case "props":
      return normalizePropsNode(node);
    case "code_block":
      return normalizeCodeBlockNode(node);
    case "select":
      return normalizeSelectNode(node);
    case "input":
      return normalizeInputNode(node);
    default:
      throw new Error(`Unsupported region child "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledContentNode}
 */
function normalizeContentNode(node) {
  switch (node.kind) {
    case "tree":
      return normalizeTreeNode(node);
    case "stack":
      return normalizeStackNode(node);
    case "props":
      return normalizePropsNode(node);
    case "code_block":
      return normalizeCodeBlockNode(node);
    case "select":
      return normalizeSelectNode(node);
    case "input":
      return normalizeInputNode(node);
    default:
      throw new Error(`Unsupported content node "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledTreeNode}
 */
function normalizeTreeNode(node) {
  return {
    kind: "tree",
    lineNumber: node.lineNumber,
    children: node.children.map(normalizeTreeChildNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledTreeChildNode}
 */
function normalizeTreeChildNode(node) {
  switch (node.kind) {
    case "group":
      return normalizeGroupNode(node);
    case "item":
      return normalizeItemNode(node);
    default:
      throw new Error(`Unsupported tree child "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledGroupNode}
 */
function normalizeGroupNode(node) {
  return {
    kind: "group",
    lineNumber: node.lineNumber,
    label: pickNodeLabel(node, "Group"),
    expanded: node.attrs.expanded !== false,
    children: node.children.map(normalizeTreeChildNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledItemNode}
 */
function normalizeItemNode(node) {
  return {
    kind: "item",
    lineNumber: node.lineNumber,
    label: pickNodeLabel(node, "Item"),
    selected: node.attrs.selected === true,
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledStackNode}
 */
function normalizeStackNode(node) {
  return {
    kind: "stack",
    lineNumber: node.lineNumber,
    gap: typeof node.attrs.gap === "number" ? node.attrs.gap : 12,
    children: node.children.map(normalizeContentNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledPropsNode}
 */
function normalizePropsNode(node) {
  return {
    kind: "props",
    lineNumber: node.lineNumber,
    children: node.children.map(normalizePropNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledPropNode}
 */
function normalizePropNode(node) {
  const control = node.children[0] ? normalizePropControlNode(node.children[0]) : null;

  return {
    kind: "prop",
    lineNumber: node.lineNumber,
    key: pickStringAttr(node.attrs.key) || pickNodeLabel(node, "Property"),
    value: control ? null : stringifyAttrValue(node.attrs.value, "Value"),
    control,
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledPropControlNode}
 */
function normalizePropControlNode(node) {
  switch (node.kind) {
    case "select":
      return normalizeSelectNode(node);
    case "input":
      return normalizeInputNode(node);
    default:
      throw new Error(`Unsupported prop control "${node.kind}" on line ${node.lineNumber}.`);
  }
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledCodeBlockNode}
 */
function normalizeCodeBlockNode(node) {
  return {
    kind: "code_block",
    lineNumber: node.lineNumber,
    language: pickStringAttr(node.attrs.language),
    children: node.children.map(normalizeCodeLineNode),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledCodeLineNode}
 */
function normalizeCodeLineNode(node) {
  return {
    kind: "code_line",
    lineNumber: node.lineNumber,
    value: pickStringAttr(node.attrs.value) || pickNodeLabel(node, ""),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledSelectNode}
 */
function normalizeSelectNode(node) {
  return {
    kind: "select",
    lineNumber: node.lineNumber,
    label: pickNodeLabel(node, "Select"),
    value: stringifyAttrValue(node.attrs.value, ""),
    options: splitOptions(node.attrs.options),
  };
}

/**
 * @param {RawWireframeNode} node
 * @returns {CompiledInputNode}
 */
function normalizeInputNode(node) {
  return {
    kind: "input",
    lineNumber: node.lineNumber,
    label: pickNodeLabel(node, "Input"),
    value: stringifyAttrValue(node.attrs.value, ""),
    inputType: pickStringAttr(node.attrs.type),
  };
}

/**
 * @param {RawWireframeNode} node
 * @param {string} fallback
 */
function pickNodeLabel(node, fallback) {
  if (typeof node.attrs.label === "string") return node.attrs.label;
  if (typeof node.attrs.title === "string") return node.attrs.title;
  if (node.texts[0]) return node.texts[0];
  if (node.bare[0]) return node.bare[0];
  return fallback;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function pickStringAttr(value) {
  return typeof value === "string" ? value : null;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function stringifyAttrValue(value, fallback) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function splitOptions(value) {
  if (typeof value !== "string") return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
