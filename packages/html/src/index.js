import { readFileSync } from "node:fs";
import {
  extractWireframeBlocks,
  normalizeRenderBox,
  parseWireframe,
  resolveDeviceProfile,
  resolveScreenSize,
} from "@wireframe-md/core";

const DEFAULT_STYLES = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const DOC_GAP = 20;
const SHELL_PADDING = 16;
const SHELL_GAP = 10;
const SHELL_HEAD_HEIGHT = 28;
const PREVIEW_PADDING = 12;

export function getDefaultStyles() {
  return DEFAULT_STYLES;
}

export function renderMarkdownWireframesToHtml(markdownSource) {
  return extractWireframeBlocks(markdownSource)
    .map(({ code, info }) => renderWireframeBlockToHtml(code, info.options))
    .join("\n");
}

export function renderFixtureDocument(markdownSource, options = {}) {
  const title = options.title || "wireframe-md fixture";
  const body = renderMarkdownWireframesToHtml(markdownSource) || "<div class=\"wf-empty\">No wireframe blocks found.</div>";

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${escapeHtml(title)}</title>`,
    `    <style>${DEFAULT_STYLES}</style>`,
    "  </head>",
    "  <body>",
    `    <main class="wf-fixture-root" data-testid="fixture-root">${body}</main>`,
    "  </body>",
    "</html>",
  ].join("\n");
}

export function renderWireframeBlockToHtml(source, options = {}) {
  const ast = parseWireframe(source);
  if (!ast.children.length) {
    return "<div class=\"wf-empty\">Empty wireframe block.</div>";
  }

  const screens = ast.children.map(buildScreenModel);
  const naturalWidth = Math.max(...screens.map((screen) => screen.naturalWidth));
  const naturalHeight = screens.reduce((sum, screen) => sum + screen.naturalHeight, 0) + (screens.length - 1) * DOC_GAP;
  const box = normalizeRenderBox(options);
  const scale = computeScale(naturalWidth, naturalHeight, box);
  const renderedWidth = round(naturalWidth * scale);
  const renderedHeight = round(naturalHeight * scale);
  const blockStyles = styleAttr({
    width: px(box.width ?? renderedWidth),
    height: px(box.height ?? renderedHeight),
  });
  const docStyles = styleAttr({
    width: px(naturalWidth),
    height: px(naturalHeight),
    transform: `scale(${scale})`,
  });

  return [
    `<div class="wf-block-box" style="${blockStyles}">`,
    `  <div class="wf-doc" style="${docStyles}">`,
    screens.map((screen) => screen.html).join("\n"),
    "  </div>",
    "</div>",
  ].join("\n");
}

function buildScreenModel(node) {
  const profile = resolveDeviceProfile(node.attrs.device);
  const { width, height } = resolveScreenSize(node.attrs, profile);
  const title = node.attrs.title || node.texts[0] || node.bare[0] || "Screen";
  const metrics = getFrameMetrics(profile.frame, width, height);
  const naturalWidth = metrics.outerWidth + PREVIEW_PADDING * 2 + SHELL_PADDING * 2;
  const naturalHeight = metrics.outerHeight + PREVIEW_PADDING * 2 + SHELL_PADDING * 2 + SHELL_GAP + SHELL_HEAD_HEIGHT;

  return {
    naturalWidth,
    naturalHeight,
    html: renderScreenShell({ metrics, profile, title, width, height }),
  };
}

function renderScreenShell({ metrics, profile, title, width, height }) {
  const { frameMarkup, viewportStyle } = renderDeviceFrameMarkup(profile.frame, metrics, title);
  const screenMarkup = [
    `<figure class="wf-screen in-device-frame ${escapeHtml(profile.frame)}" style="${styleAttr({ width: px(width), height: px(height) })}">`,
    "  <div class=\"wf-screen-body\">",
    "    <div class=\"wf-screen-placeholder\">",
    `      <div class="wf-screen-device">${escapeHtml(profile.label)}</div>`,
    `      <div class="wf-screen-name">${escapeHtml(title)}</div>`,
    `      <div class="wf-screen-size">${width}x${height}</div>`,
    "      <div class=\"wf-screen-lines\" aria-hidden=\"true\">",
    "        <span class=\"long\"></span>",
    "        <span class=\"medium\"></span>",
    "        <span class=\"short\"></span>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</figure>",
  ].join("\n");

  return [
    "<section class=\"wf-screen-shell\">",
    "  <div class=\"wf-shell-head\">",
    `    <div class="wf-shell-title">${escapeHtml(title)}</div>`,
    `    <div class="wf-shell-meta">${escapeHtml(profile.label)} · ${width}x${height}</div>`,
    "  </div>",
    "  <div class=\"wf-preview-box\">",
    `    <div class="wf-screen-frame frame-${escapeHtml(profile.frame)}" style="${styleAttr({ width: px(metrics.outerWidth), height: px(metrics.outerHeight) })}">`,
    frameMarkup,
    `      <div class="wf-device-viewport" style="${viewportStyle}">`,
    screenMarkup,
    "      </div>",
    "    </div>",
    "  </div>",
    "</section>",
  ].join("\n");
}

function renderDeviceFrameMarkup(frameKind, metrics, title) {
  const viewportStyle = styleAttr({
    left: px(metrics.viewportLeft),
    top: px(metrics.viewportTop),
    width: px(metrics.viewportWidth),
    height: px(metrics.viewportHeight),
    borderRadius: px(metrics.viewportRadius),
  });

  return {
    viewportStyle,
    frameMarkup: buildFrameSvg(frameKind, metrics, title),
  };
}

function getFrameMetrics(frameKind, width, height) {
  switch (frameKind) {
    case "mobile":
      return {
        outerWidth: width + 36,
        outerHeight: height + 44,
        viewportLeft: 18,
        viewportTop: 22,
        viewportWidth: width,
        viewportHeight: height,
        viewportRadius: 30,
      };
    case "browser":
      return {
        outerWidth: width + 4,
        outerHeight: height + 78,
        viewportLeft: 2,
        viewportTop: 76,
        viewportWidth: width,
        viewportHeight: height,
        viewportRadius: 0,
      };
    case "app":
    default:
      return {
        outerWidth: width + 4,
        outerHeight: height + 44,
        viewportLeft: 2,
        viewportTop: 42,
        viewportWidth: width,
        viewportHeight: height,
        viewportRadius: 18,
      };
  }
}

function buildFrameSvg(frameKind, metrics, title) {
  if (frameKind === "mobile") {
    return [
      `<svg class="wf-device-svg" viewBox="0 0 ${metrics.outerWidth} ${metrics.outerHeight}" width="${metrics.outerWidth}" height="${metrics.outerHeight}" aria-hidden="true">`,
      `  <rect x="3" y="3" width="${metrics.outerWidth - 6}" height="${metrics.outerHeight - 6}" rx="42" fill="#23211d" stroke="#6a6259" stroke-width="2" />`,
      `  <rect x="${round(metrics.outerWidth / 2 - 42)}" y="10" width="84" height="8" rx="4" fill="#141311" />`,
      `  <circle cx="${round(metrics.outerWidth / 2 + 56)}" cy="14" r="3.5" fill="#141311" />`,
      `  <rect x="${round(metrics.outerWidth / 2 - 44)}" y="${metrics.outerHeight - 14}" width="88" height="5" rx="2.5" fill="#c6b9a4" opacity="0.65" />`,
      "</svg>",
    ].join("\n");
  }

  const outerRadius = frameKind === "browser" ? 18 : 20;
  const chromeRadius = frameKind === "browser" ? 16 : 18;
  const chromeFill = frameKind === "browser" ? "#efe3cf" : "#eadfc9";
  const shared = [
    `<svg class="wf-device-svg" viewBox="0 0 ${metrics.outerWidth} ${metrics.outerHeight}" width="${metrics.outerWidth}" height="${metrics.outerHeight}" aria-hidden="true">`,
    `  <rect x="1" y="1" width="${metrics.outerWidth - 2}" height="${metrics.outerHeight - 2}" rx="${outerRadius}" fill="#f4ead7" stroke="#8d8372" stroke-width="2" />`,
    `  <rect x="2" y="2" width="${metrics.outerWidth - 4}" height="${metrics.viewportTop - 2}" rx="${chromeRadius}" fill="${chromeFill}" />`,
    `  <line x1="2" y1="${metrics.viewportTop}" x2="${metrics.outerWidth - 2}" y2="${metrics.viewportTop}" stroke="#a39884" stroke-width="1.5" />`,
    "  <circle cx=\"18\" cy=\"20\" r=\"5\" fill=\"#d98b7b\" opacity=\"0.92\" />",
    "  <circle cx=\"32\" cy=\"20\" r=\"5\" fill=\"#d3b46d\" opacity=\"0.92\" />",
    "  <circle cx=\"46\" cy=\"20\" r=\"5\" fill=\"#8db485\" opacity=\"0.92\" />",
  ];

  if (frameKind === "app") {
    shared.push(`  <text x="${round(metrics.outerWidth / 2)}" y="25" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="#655d52">${escapeHtml(title)}</text>`);
    shared.push("</svg>");
    return shared.join("\n");
  }

  shared.push("  <rect x=\"78\" y=\"12\" width=\"122\" height=\"24\" rx=\"12\" fill=\"#fbf7ef\" stroke=\"#b4a894\" stroke-width=\"1\" />");
  shared.push(`  <text x="98" y="28" font-size="11" font-family="ui-sans-serif, system-ui, sans-serif" fill="#7f7669">${escapeHtml(title || "wireframe.local")}</text>`);
  shared.push(`  <rect x="214" y="12" width="${Math.max(220, metrics.outerWidth - 236)}" height="24" rx="12" fill="#fffdf8" stroke="#b4a894" stroke-width="1" />`);
  shared.push("  <text x=\"232\" y=\"28\" font-size=\"11\" font-family=\"ui-monospace, SFMono-Regular, Menlo, monospace\" fill=\"#7f7669\">https://wireframe.local</text>");
  shared.push("</svg>");
  return shared.join("\n");
}

function computeScale(naturalWidth, naturalHeight, box) {
  let scale = 1;

  if (box.width != null) {
    scale = box.width / naturalWidth;
  }

  if (box.height != null) {
    scale = Math.min(scale, box.height / naturalHeight);
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }

  return round(scale);
}

function styleAttr(styles) {
  return Object.entries(styles)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(";");
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function px(value) {
  if (value == null) return null;
  return `${round(value)}px`;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
