// @ts-check

import { getFrameMetrics, renderDeviceFrameMarkup } from "./device.js";
import { renderLayoutNode } from "./layout.js";
import { escapeHtml, px, styleAttr } from "./utils.js";

const SHELL_PADDING = 16;
const SHELL_GAP = 10;
const SHELL_HEAD_HEIGHT = 28;
const PREVIEW_PADDING = 12;

/**
 * @typedef {{ kind: "region", label: string, surface: "card" | "plain", placeholder: boolean }} CompiledRegionNode
 * @typedef {{ kind: "split", axis: "horizontal" | "vertical", surface: "card" | "plain", sizes: Array<{ kind: "rest" } | { kind: "auto" } | { kind: "fixed", value: number }>, children: CompiledLayoutNode[] }} CompiledSplitNode
 * @typedef {CompiledSplitNode | CompiledRegionNode} CompiledLayoutNode
 * @typedef {{ kind: "screen", title: string, surface: "card" | "plain", deviceProfile: { label: string, frame: "mobile" | "app" | "browser" }, width: number, height: number, url: string | null, child: CompiledLayoutNode | null }} CompiledScreenNode
 * @typedef {{ kind: "frame", title: string, surface: "card" | "plain", width: number, height: number, child: CompiledLayoutNode | null }} CompiledFrameNode
 * @typedef {CompiledScreenNode | CompiledFrameNode} CompiledTopLevelNode
 * @typedef {{ naturalWidth: number, naturalHeight: number, html: string }} RenderModel
 */

/**
 * @param {CompiledTopLevelNode} node
 * @returns {RenderModel}
 */
export function buildTopLevelModel(node) {
  switch (node.kind) {
    case "screen":
      return buildScreenModel(node);
    case "frame":
      return buildFrameModel(node);
    default:
      return {
        naturalWidth: 480,
        naturalHeight: 160,
        html: "<div class=\"wf-empty\">Unsupported top-level node.</div>",
      };
  }
}

/**
 * @param {CompiledScreenNode} node
 * @returns {RenderModel}
 */
function buildScreenModel(node) {
  const metrics = getFrameMetrics(node.deviceProfile.frame, node.width, node.height);
  const naturalWidth = node.surface === "plain" ? metrics.outerWidth : metrics.outerWidth + PREVIEW_PADDING * 2 + SHELL_PADDING * 2;
  const naturalHeight = node.surface === "plain"
    ? metrics.outerHeight
    : metrics.outerHeight + PREVIEW_PADDING * 2 + SHELL_PADDING * 2 + SHELL_GAP + SHELL_HEAD_HEIGHT;
  const screenContent = buildScreenContent(node);

  return {
    naturalWidth,
    naturalHeight,
    html: renderScreenShell({
      surface: node.surface,
      metrics,
      frameKind: node.deviceProfile.frame,
      profileLabel: node.deviceProfile.label,
      title: node.title,
      url: node.url,
      width: node.width,
      height: node.height,
      ...screenContent,
    }),
  };
}

/**
 * @param {CompiledFrameNode} node
 * @returns {RenderModel}
 */
function buildFrameModel(node) {
  const frameContent = buildFrameContent(node);

  return {
    naturalWidth: node.width,
    naturalHeight: node.height,
    html: renderFrameShell({ surface: node.surface, title: node.title, width: node.width, height: node.height, ...frameContent }),
  };
}

/**
 * @param {{ surface: "card" | "plain", metrics: import("./device.js").ScreenMetrics, frameKind: "mobile" | "app" | "browser", profileLabel: string, title: string, url: string | null, width: number, height: number, bodyClassName: string, screenContent: string }} options
 */
function renderScreenShell({ surface, metrics, frameKind, profileLabel, title, url, width, height, bodyClassName, screenContent }) {
  const screenFrameMarkup = renderScreenFrame({ surface, metrics, frameKind, title, url, width, height, bodyClassName, screenContent });

  if (surface === "plain") {
    return screenFrameMarkup;
  }

  return [
    "<section class=\"wf-screen-shell\">",
    "  <div class=\"wf-shell-head\">",
    `    <div class="wf-shell-title">${escapeHtml(title)}</div>`,
    `    <div class="wf-shell-meta">${escapeHtml(profileLabel)} · ${width}x${height}</div>`,
    "  </div>",
    "  <div class=\"wf-preview-box\">",
    screenFrameMarkup,
    "  </div>",
    "</section>",
  ].join("\n");
}

/**
 * @param {{ surface: "card" | "plain", metrics: import("./device.js").ScreenMetrics, frameKind: "mobile" | "app" | "browser", title: string, url: string | null, width: number, height: number, bodyClassName: string, screenContent: string }} options
 */
function renderScreenFrame({ surface, metrics, frameKind, title, url, width, height, bodyClassName, screenContent }) {
  const { frameMarkup, viewportStyle } = renderDeviceFrameMarkup(frameKind, metrics, title, url);
  const screenMarkup = [
    `<figure class="wf-screen in-device-frame ${escapeHtml(frameKind)}" style="${styleAttr({ width: px(width), height: px(height) })}">`,
    `  <div class="${escapeHtml(bodyClassName)}">`,
    screenContent,
    "  </div>",
    "</figure>",
  ].join("\n");

  return [
    `    <div class="wf-screen-frame frame-${escapeHtml(frameKind)} surface-${escapeHtml(surface)}" style="${styleAttr({ width: px(metrics.outerWidth), height: px(metrics.outerHeight) })}">`,
    frameMarkup,
    `      <div class="wf-device-viewport" style="${viewportStyle}">`,
    screenMarkup,
    "      </div>",
    "    </div>",
  ].join("\n");
}

/**
 * @param {{ surface: "card" | "plain", title: string, width: number, height: number, bodyClassName: string, frameContent: string }} options
 */
function renderFrameShell({ surface, title, width, height, bodyClassName, frameContent }) {
  return [
    `<section class="wf-frame surface-${escapeHtml(surface)}" style="${styleAttr({ width: px(width), height: px(height) })}">`,
    title ? `  <div class="wf-frame-head"><div class="wf-frame-title">${escapeHtml(title)}</div></div>` : "",
    `  <div class="${escapeHtml(bodyClassName)}">`,
    frameContent,
    "  </div>",
    "</section>",
  ].filter(Boolean).join("\n");
}

/**
 * @param {CompiledScreenNode} node
 */
function buildScreenContent(node) {
  if (!node.child) {
    return {
      bodyClassName: "wf-screen-body",
      screenContent: renderScreenPlaceholder({ profileLabel: node.deviceProfile.label, title: node.title, width: node.width, height: node.height }),
    };
  }

  return {
    bodyClassName: "wf-screen-body has-layout",
    screenContent: [
      "    <div class=\"wf-layout-root\">",
      renderLayoutNode(node.child, 0),
      "    </div>",
    ].join("\n"),
  };
}

/**
 * @param {CompiledFrameNode} node
 */
function buildFrameContent(node) {
  if (!node.child) {
    return {
      bodyClassName: "wf-frame-body",
      frameContent: renderFramePlaceholder({ title: node.title, width: node.width, height: node.height }),
    };
  }

  return {
    bodyClassName: "wf-frame-body has-layout",
    frameContent: [
      "    <div class=\"wf-layout-root\">",
      renderLayoutNode(node.child, 0),
      "    </div>",
    ].join("\n"),
  };
}

/**
 * @param {{ profileLabel: string, title: string, width: number, height: number }} options
 */
function renderScreenPlaceholder({ profileLabel, title, width, height }) {
  return [
    "    <div class=\"wf-screen-placeholder\">",
    `      <div class="wf-screen-device">${escapeHtml(profileLabel)}</div>`,
    `      <div class="wf-screen-name">${escapeHtml(title)}</div>`,
    `      <div class="wf-screen-size">${width}x${height}</div>`,
    "      <div class=\"wf-screen-lines\" aria-hidden=\"true\">",
    "        <span class=\"long\"></span>",
    "        <span class=\"medium\"></span>",
    "        <span class=\"short\"></span>",
    "      </div>",
    "    </div>",
  ].join("\n");
}

/**
 * @param {{ title: string, width: number, height: number }} options
 */
function renderFramePlaceholder({ title, width, height }) {
  return [
    "    <div class=\"wf-frame-placeholder\">",
    "      <div class=\"wf-frame-chip\">frame</div>",
    title ? `      <div class="wf-frame-name">${escapeHtml(title)}</div>` : "",
    `      <div class="wf-frame-size">${width}x${height}</div>`,
    "      <div class=\"wf-screen-lines\" aria-hidden=\"true\">",
    "        <span class=\"long\"></span>",
    "        <span class=\"medium\"></span>",
    "        <span class=\"short\"></span>",
    "      </div>",
    "    </div>",
  ].join("\n");
}
