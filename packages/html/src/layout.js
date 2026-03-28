// @ts-check

import { escapeHtml, px, styleAttr } from "./utils.js";

/**
 * @typedef {{ kind: "rest" } | { kind: "auto" } | { kind: "fixed", value: number }} SplitSize
 * @typedef {{ kind: "split", axis: "horizontal" | "vertical", surface: "card" | "plain", sizes: SplitSize[], children: CompiledLayoutNode[] }} CompiledSplitNode
 * @typedef {{ kind: "region", label: string, surface: "card" | "plain", placeholder: boolean }} CompiledRegionNode
 * @typedef {CompiledSplitNode | CompiledRegionNode} CompiledLayoutNode
 */

/**
 * @param {CompiledLayoutNode} node
 * @param {number} depth
 * @returns {string}
 */
export function renderLayoutNode(node, depth) {
  switch (node.kind) {
    case "split":
      return renderSplitNode(node, depth);
    case "region":
      return renderRegionNode(node, depth);
    default:
      return "<div class=\"wf-empty\">Unsupported layout node.</div>";
  }
}

/**
 * @param {CompiledSplitNode} node
 * @param {number} depth
 * @returns {string}
 */
export function renderSplitNode(node, depth) {
  return [
    `      <section class="wf-split axis-${escapeHtml(node.axis)} surface-${escapeHtml(node.surface)} depth-${depth}">`,
    ...node.children.map((child, index) => {
      const paneStyle = styleAttr(buildSplitPaneStyles(node.axis, node.sizes[index]));

      return [
        `        <div class="wf-split-pane" style="${paneStyle}">`,
        renderLayoutNode(child, depth + 1),
        "        </div>",
      ].join("\n");
    }),
    "      </section>",
  ].join("\n");
}

/**
 * @param {CompiledRegionNode} node
 * @param {number} depth
 * @returns {string}
 */
export function renderRegionNode(node, depth) {
  return [
    `          <section class="wf-region surface-${escapeHtml(node.surface)} ${node.placeholder ? "has-placeholder" : "no-placeholder"} depth-${depth}">`,
    "            <div class=\"wf-region-chip\">region</div>",
    `            <div class="wf-region-label">${escapeHtml(node.label)}</div>`,
    ...(
      node.placeholder
        ? [
            "            <div class=\"wf-region-lines\" aria-hidden=\"true\">",
            "              <span class=\"long\"></span>",
            "              <span class=\"medium\"></span>",
            "              <span class=\"short\"></span>",
            "            </div>",
          ]
        : []
    ),
    "          </section>",
  ].join("\n");
}

/**
 * @param {"horizontal" | "vertical"} axis
 * @param {SplitSize} size
 */
function buildSplitPaneStyles(axis, size) {
  const base = {
    minWidth: "0",
    minHeight: "0",
  };

  if (size.kind === "rest") {
    return {
      ...base,
      flex: "1 1 0",
    };
  }

  if (size.kind === "auto") {
    return {
      ...base,
      flex: "0 0 auto",
    };
  }

  if (axis === "horizontal") {
    return {
      ...base,
      flex: `0 0 ${px(size.value)}`,
      width: px(size.value),
    };
  }

  return {
    ...base,
    flex: `0 0 ${px(size.value)}`,
    height: px(size.value),
  };
}
