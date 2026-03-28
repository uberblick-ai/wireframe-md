// @ts-check

import { escapeHtml, px, styleAttr } from "./utils.js";

/**
 * @typedef {{ kind: "rest" } | { kind: "auto" } | { kind: "fixed", value: number }} SplitSize
 * @typedef {{ kind: "split", axis: "horizontal" | "vertical", surface: "card" | "plain", sizes: SplitSize[], children: CompiledLayoutNode[] }} CompiledSplitNode
 * @typedef {{ kind: "item", label: string, selected: boolean }} CompiledItemNode
 * @typedef {{ kind: "group", label: string, expanded: boolean, children: CompiledTreeChildNode[] }} CompiledGroupNode
 * @typedef {{ kind: "tree", children: CompiledTreeChildNode[] }} CompiledTreeNode
 * @typedef {CompiledGroupNode | CompiledItemNode} CompiledTreeChildNode
 * @typedef {{ kind: "stack", gap: number, children: CompiledContentNode[] }} CompiledStackNode
 * @typedef {{ kind: "prop", key: string, value: string }} CompiledPropNode
 * @typedef {{ kind: "props", children: CompiledPropNode[] }} CompiledPropsNode
 * @typedef {{ kind: "code_line", value: string }} CompiledCodeLineNode
 * @typedef {{ kind: "code_block", language: string | null, children: CompiledCodeLineNode[] }} CompiledCodeBlockNode
 * @typedef {CompiledTreeNode | CompiledStackNode | CompiledPropsNode | CompiledCodeBlockNode} CompiledContentNode
 * @typedef {{ kind: "region", label: string, surface: "card" | "plain", placeholder: boolean, showLabel: boolean, child: CompiledRegionChildNode | null }} CompiledRegionNode
 * @typedef {CompiledSplitNode | CompiledContentNode} CompiledRegionChildNode
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
  const placeholderClass = !node.child && node.placeholder ? "has-placeholder" : "no-placeholder";
  const labelClass = node.showLabel ? "show-label" : "hide-label";

  return [
    `          <section class="wf-region surface-${escapeHtml(node.surface)} ${placeholderClass} ${labelClass} depth-${depth}">`,
    ...(node.showLabel ? [
      "            <div class=\"wf-region-chip\">region</div>",
      `            <div class="wf-region-label">${escapeHtml(node.label)}</div>`,
    ] : []),
    ...(node.child ? [
      "            <div class=\"wf-region-content\">",
      renderRegionChildNode(node.child, depth + 1),
      "            </div>",
    ] : []),
    ...(
      node.child || !node.placeholder
        ? []
        : [
            "            <div class=\"wf-region-lines\" aria-hidden=\"true\">",
            "              <span class=\"long\"></span>",
            "              <span class=\"medium\"></span>",
            "              <span class=\"short\"></span>",
            "            </div>",
          ]
    ),
    "          </section>",
  ].join("\n");
}

/**
 * @param {CompiledRegionChildNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderRegionChildNode(node, depth) {
  switch (node.kind) {
    case "split":
      return renderSplitNode(node, depth);
    case "tree":
    case "stack":
    case "props":
    case "code_block":
      return renderContentNode(node, depth);
    default:
      return "<div class=\"wf-empty\">Unsupported region content.</div>";
  }
}

/**
 * @param {CompiledContentNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderContentNode(node, depth) {
  switch (node.kind) {
    case "tree":
      return renderTreeNode(node, depth);
    case "stack":
      return renderStackNode(node, depth);
    case "props":
      return renderPropsNode(node, depth);
    case "code_block":
      return renderCodeBlockNode(node, depth);
    default:
      return "<div class=\"wf-empty\">Unsupported content node.</div>";
  }
}

/**
 * @param {CompiledTreeNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderTreeNode(node, depth) {
  return [
    `              <div class="wf-tree depth-${depth}">`,
    ...node.children.map((child) => renderTreeChildNode(child, depth + 1)),
    "              </div>",
  ].join("\n");
}

/**
 * @param {CompiledTreeChildNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderTreeChildNode(node, depth) {
  switch (node.kind) {
    case "group":
      return renderGroupNode(node, depth);
    case "item":
      return renderItemNode(node, depth);
    default:
      return "<div class=\"wf-empty\">Unsupported tree item.</div>";
  }
}

/**
 * @param {CompiledGroupNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderGroupNode(node, depth) {
  return [
    `                <section class="wf-tree-group ${node.expanded ? "is-expanded" : "is-collapsed"} depth-${depth}">`,
    "                  <div class=\"wf-tree-row wf-tree-group-row\">",
    `                    <span class="wf-tree-caret" aria-hidden="true">${node.expanded ? "▾" : "▸"}</span>`,
    `                    <span class="wf-tree-group-label">${escapeHtml(node.label)}</span>`,
    "                  </div>",
    ...(node.expanded
        ? [
            "                  <div class=\"wf-tree-group-children\">",
            ...node.children.map((child) => renderTreeChildNode(child, depth + 1)),
            "                  </div>",
          ]
        : []),
    "                </section>",
  ].join("\n");
}

/**
 * @param {CompiledItemNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderItemNode(node, depth) {
  return [
    `                <div class="wf-tree-row wf-tree-item${node.selected ? " is-selected" : ""} depth-${depth}">`,
    "                  <span class=\"wf-tree-bullet\" aria-hidden=\"true\"></span>",
    `                  <span class="wf-tree-item-label">${escapeHtml(node.label)}</span>`,
    "                </div>",
  ].join("\n");
}

/**
 * @param {CompiledStackNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderStackNode(node, depth) {
  return [
    `              <div class="wf-stack depth-${depth}" style="${styleAttr({ "--wf-stack-gap": px(node.gap) })}">`,
    ...node.children.map((child) => renderContentNode(child, depth + 1)),
    "              </div>",
  ].join("\n");
}

/**
 * @param {CompiledPropsNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderPropsNode(node, depth) {
  return [
    `              <dl class="wf-props depth-${depth}">`,
    ...node.children.map((child) => renderPropNode(child, depth + 1)),
    "              </dl>",
  ].join("\n");
}

/**
 * @param {CompiledPropNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderPropNode(node, depth) {
  return [
    `                <div class="wf-prop depth-${depth}">`,
    `                  <dt class="wf-prop-key">${escapeHtml(node.key)}</dt>`,
    `                  <dd class="wf-prop-value">${escapeHtml(node.value)}</dd>`,
    "                </div>",
  ].join("\n");
}

/**
 * @param {CompiledCodeBlockNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderCodeBlockNode(node, depth) {
  return [
    `              <div class="wf-code-block depth-${depth}">`,
    ...(node.language ? [`                <div class="wf-code-block-language">${escapeHtml(node.language)}</div>`] : []),
    "                <pre class=\"wf-code-block-body\"><code>",
    ...node.children.map((child) => renderCodeLineNode(child, depth + 1)),
    "                </code></pre>",
    "              </div>",
  ].join("\n");
}

/**
 * @param {CompiledCodeLineNode} node
 * @param {number} depth
 * @returns {string}
 */
function renderCodeLineNode(node, depth) {
  return `                  <span class="wf-code-line depth-${depth}">${escapeHtml(node.value)}</span>`;
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
