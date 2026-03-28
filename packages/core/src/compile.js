// @ts-check

import { parseWireframe, resolveDeviceProfile, resolveScreenSize, resolveSplitDefinition, resolveSurfaceStyle } from "./parser.js";

const FRAME_DEFAULT_WIDTH = 640;
const FRAME_DEFAULT_HEIGHT = 420;

/**
 * @typedef {ReturnType<typeof parseWireframe>} RawWireframeRoot
 * @typedef {RawWireframeRoot["children"][number]} RawWireframeNode
 * @typedef {ReturnType<typeof resolveDeviceProfile>} DeviceProfile
 * @typedef {ReturnType<typeof resolveSplitDefinition>} SplitDefinition
 * @typedef {{ kind: "region", lineNumber: number, label: string, surface: "card" | "plain", placeholder: boolean }} CompiledRegionNode
 * @typedef {{ kind: "split", lineNumber: number, axis: SplitDefinition["axis"], surface: SplitDefinition["surface"], sizes: SplitDefinition["sizes"], children: CompiledLayoutNode[] }} CompiledSplitNode
 * @typedef {CompiledSplitNode | CompiledRegionNode} CompiledLayoutNode
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
