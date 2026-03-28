// @ts-check

import {
  extractWireframeBlocks,
  normalizeRenderBox,
  parseWireframe,
  resolveDeviceProfile,
  resolveScreenSize,
  resolveSplitDefinition,
  resolveSurfaceStyle,
} from "@wireframe-md/core";
import { DEFAULT_STYLES } from "./default_styles.js";

/**
 * @typedef {ReturnType<typeof normalizeRenderBox>} RenderBox
 * @typedef {ReturnType<typeof resolveDeviceProfile>} DeviceProfile
 * @typedef {ReturnType<typeof parseWireframe>} WireframeRoot
 * @typedef {WireframeRoot["children"][number]} WireframeNode
 * @typedef {{ outerWidth: number, outerHeight: number, viewportLeft: number, viewportTop: number, viewportWidth: number, viewportHeight: number, viewportRadius: number }} ScreenMetrics
 * @typedef {{ bodyClassName: string, screenContent: string }} ScreenContent
 * @typedef {{ naturalWidth: number, naturalHeight: number, html: string }} ScreenModel
 */

const DOC_GAP = 20;
const SHELL_PADDING = 16;
const SHELL_GAP = 10;
const SHELL_HEAD_HEIGHT = 28;
const PREVIEW_PADDING = 12;
const FRAME_DEFAULT_WIDTH = 640;
const FRAME_DEFAULT_HEIGHT = 420;

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
  const theme = normalizeThemeOption(options.theme);
  const htmlClass = theme === "auto" ? "" : theme;
  const rootClassName = ["wf-fixture-root", resolveThemeClassName(theme)].filter(Boolean).join(" ");
  const body = renderMarkdownWireframesToHtml(markdownSource) || "<div class=\"wf-empty\">No wireframe blocks found.</div>";

  return [
    "<!doctype html>",
    `<html lang="en"${htmlClass ? ` class="${htmlClass}"` : ""}>`,
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${escapeHtml(title)}</title>`,
    `    <style>${DEFAULT_STYLES}</style>`,
    "  </head>",
    "  <body>",
    `    <main class="${rootClassName}" data-testid="fixture-root">${body}</main>`,
    "  </body>",
    "</html>",
  ].join("\n");
}

export function renderWireframeBlockToHtml(source, options = {}) {
  const ast = parseWireframe(source);
  if (!ast.children.length) {
    return "<div class=\"wf-empty\">Empty wireframe block.</div>";
  }

  const models = ast.children.map(buildTopLevelModel);
  const naturalWidth = Math.max(...models.map((model) => model.naturalWidth));
  const naturalHeight = models.reduce((sum, model) => sum + model.naturalHeight, 0) + (models.length - 1) * DOC_GAP;
  const box = normalizeRenderBox(options);
  const scale = computeScale(naturalWidth, naturalHeight, box);
  const renderedWidth = round(naturalWidth * scale);
  const renderedHeight = round(naturalHeight * scale);
  const hasFixedWidth = box.boxWidth != null;
  const themeClassName = resolveThemeClassName(normalizeThemeOption(options.theme));
  const blockStyles = styleAttr(
    hasFixedWidth
      ? {
          width: px(box.boxWidth ?? renderedWidth),
          height: px(box.boxHeight ?? renderedHeight),
        }
      : {
          width: "100%",
          maxWidth: px(renderedWidth),
          "--wf-natural-width": naturalWidth,
          "--wf-natural-height": naturalHeight,
          "--wf-natural-width-px": px(naturalWidth),
        },
  );
  const docStyles = styleAttr(
    hasFixedWidth
      ? {
          width: px(naturalWidth),
          height: px(naturalHeight),
          transform: `scale(${scale})`,
        }
      : {
          width: px(naturalWidth),
          height: px(naturalHeight),
        },
  );
  const blockClassName = ["wf-block-box", hasFixedWidth ? "is-fixed" : "is-fluid", themeClassName].filter(Boolean).join(" ");

  return [
    `<div class="${blockClassName}" style="${blockStyles}">`,
    `  <div class="wf-doc" style="${docStyles}">`,
    models.map((model) => model.html).join("\n"),
    "  </div>",
    "</div>",
  ].join("\n");
}

function normalizeThemeOption(rawTheme = "auto") {
  const theme = String(rawTheme || "auto").toLowerCase();

  if (theme === "auto" || theme === "light" || theme === "dark") {
    return theme;
  }

  throw new Error(`Unsupported theme "${rawTheme}". Expected "auto", "light", or "dark".`);
}

function resolveThemeClassName(theme) {
  if (theme === "light") return "wf-theme-light";
  if (theme === "dark") return "wf-theme-dark";
  return "";
}

function buildTopLevelModel(node) {
  switch (node.kind) {
    case "screen":
      return buildScreenModel(node);
    case "frame":
      return buildFrameModel(node);
    default:
      return {
        naturalWidth: 480,
        naturalHeight: 160,
        html: `<div class="wf-empty">Unsupported top-level node: ${escapeHtml(node.kind)}</div>`,
      };
  }
}

function buildScreenModel(node) {
  const profile = resolveDeviceProfile(node.attrs.device);
  const surface = resolveSurfaceStyle(node.attrs.surface);
  const { width, height } = resolveScreenSize(node.attrs, profile);
  const title = node.attrs.title || node.texts[0] || node.bare[0] || "Screen";
  const url = node.attrs.url || null;
  const metrics = getFrameMetrics(profile.frame, width, height);
  const naturalWidth = surface === "plain" ? metrics.outerWidth : metrics.outerWidth + PREVIEW_PADDING * 2 + SHELL_PADDING * 2;
  const naturalHeight = surface === "plain"
    ? metrics.outerHeight
    : metrics.outerHeight + PREVIEW_PADDING * 2 + SHELL_PADDING * 2 + SHELL_GAP + SHELL_HEAD_HEIGHT;
  const screenContent = buildScreenContent(node, { profile, title, width, height });

  return {
    naturalWidth,
    naturalHeight,
    html: renderScreenShell({ surface, metrics, profile, title, url, width, height, ...screenContent }),
  };
}

function buildFrameModel(node) {
  const surface = resolveSurfaceStyle(node.attrs.surface);
  const title = node.attrs.title || node.texts[0] || node.bare[0] || "";
  const width = Number(node.attrs.width || FRAME_DEFAULT_WIDTH);
  const height = Number(node.attrs.height || FRAME_DEFAULT_HEIGHT);
  const frameContent = buildFrameContent(node, { title, width, height });

  return {
    naturalWidth: width,
    naturalHeight: height,
    html: renderFrameShell({ surface, title, width, height, ...frameContent }),
  };
}

function renderScreenShell({ surface, metrics, profile, title, url, width, height, bodyClassName, screenContent }) {
  const screenFrameMarkup = renderScreenFrame({ surface, metrics, profile, title, url, width, height, bodyClassName, screenContent });

  if (surface === "plain") {
    return screenFrameMarkup;
  }

  return [
    "<section class=\"wf-screen-shell\">",
    "  <div class=\"wf-shell-head\">",
    `    <div class="wf-shell-title">${escapeHtml(title)}</div>`,
    `    <div class="wf-shell-meta">${escapeHtml(profile.label)} · ${width}x${height}</div>`,
    "  </div>",
    "  <div class=\"wf-preview-box\">",
    screenFrameMarkup,
    "  </div>",
    "</section>",
  ].join("\n");
}

function renderScreenFrame({ surface, metrics, profile, title, url, width, height, bodyClassName, screenContent }) {
  const { frameMarkup, viewportStyle } = renderDeviceFrameMarkup(profile.frame, metrics, title, url);
  const screenMarkup = [
    `<figure class="wf-screen in-device-frame ${escapeHtml(profile.frame)}" style="${styleAttr({ width: px(width), height: px(height) })}">`,
    `  <div class="${escapeHtml(bodyClassName)}">`,
    screenContent,
    "  </div>",
    "</figure>",
  ].join("\n");

  return [
    `    <div class="wf-screen-frame frame-${escapeHtml(profile.frame)} surface-${escapeHtml(surface)}" style="${styleAttr({ width: px(metrics.outerWidth), height: px(metrics.outerHeight) })}">`,
    frameMarkup,
    `      <div class="wf-device-viewport" style="${viewportStyle}">`,
    screenMarkup,
    "      </div>",
    "    </div>",
  ].join("\n");
}

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

function buildScreenContent(node, { profile, title, width, height }) {
  if (!node.children.length) {
    return {
      bodyClassName: "wf-screen-body",
      screenContent: renderScreenPlaceholder({ profile, title, width, height }),
    };
  }

  return {
    bodyClassName: "wf-screen-body has-layout",
    screenContent: [
      "    <div class=\"wf-layout-root\">",
      renderLayoutNode(node.children[0], 0),
      "    </div>",
    ].join("\n"),
  };
}

function buildFrameContent(node, { title, width, height }) {
  if (!node.children.length) {
    return {
      bodyClassName: "wf-frame-body",
      frameContent: renderFramePlaceholder({ title, width, height }),
    };
  }

  return {
    bodyClassName: "wf-frame-body has-layout",
    frameContent: [
      "    <div class=\"wf-layout-root\">",
      renderLayoutNode(node.children[0], 0),
      "    </div>",
    ].join("\n"),
  };
}

function renderScreenPlaceholder({ profile, title, width, height }) {
  return [
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
  ].join("\n");
}

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

function renderLayoutNode(node, depth) {
  switch (node.kind) {
    case "split":
      return renderSplitNode(node, depth);
    case "region":
      return renderRegionNode(node, depth);
    default:
      return `<div class="wf-empty">Unsupported node: ${escapeHtml(node.kind)}</div>`;
  }
}

function renderSplitNode(node, depth) {
  const split = resolveSplitDefinition(node.attrs, node.children.length);

  return [
    `      <section class="wf-split axis-${escapeHtml(split.axis)} surface-${escapeHtml(split.surface)} depth-${depth}">`,
    ...node.children.map((child, index) => {
      const paneStyle = styleAttr(buildSplitPaneStyles(split.axis, split.sizes[index]));

      return [
        `        <div class="wf-split-pane" style="${paneStyle}">`,
        renderLayoutNode(child, depth + 1),
        "        </div>",
      ].join("\n");
    }),
    "      </section>",
  ].join("\n");
}

function renderRegionNode(node, depth) {
  const surface = resolveSurfaceStyle(node.attrs.surface);
  const label = node.attrs.label || node.texts[0] || node.bare[0] || "Region";
  const showPlaceholder = node.attrs.placeholder !== false;

  return [
    `          <section class="wf-region surface-${escapeHtml(surface)} ${showPlaceholder ? "has-placeholder" : "no-placeholder"} depth-${depth}">`,
    "            <div class=\"wf-region-chip\">region</div>",
    `            <div class="wf-region-label">${escapeHtml(label)}</div>`,
    ...(
      showPlaceholder
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

function renderDeviceFrameMarkup(frameKind, metrics, title, url) {
  const viewportStyle = styleAttr({
    left: px(metrics.viewportLeft),
    top: px(metrics.viewportTop),
    width: px(metrics.viewportWidth),
    height: px(metrics.viewportHeight),
    ...getViewportRadiusStyles(frameKind, metrics),
  });

  return {
    viewportStyle,
    frameMarkup: buildFrameSvg(frameKind, metrics, title, url),
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
        outerHeight: height + 48,
        viewportLeft: 2,
        viewportTop: 46,
        viewportWidth: width,
        viewportHeight: height,
        viewportRadius: 18,
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

function buildFrameSvg(frameKind, metrics, title, url) {
  if (frameKind === "mobile") {
    return [
      `<svg class="wf-device-svg" viewBox="0 0 ${metrics.outerWidth} ${metrics.outerHeight}" width="${metrics.outerWidth}" height="${metrics.outerHeight}" aria-hidden="true">`,
      `  <rect x="3" y="3" width="${metrics.outerWidth - 6}" height="${metrics.outerHeight - 6}" rx="42" fill="var(--wf-device-mobile-fill)" stroke="var(--wf-device-mobile-stroke)" stroke-width="2" />`,
      `  <rect x="${round(metrics.outerWidth / 2 - 42)}" y="10" width="84" height="8" rx="4" fill="var(--wf-device-mobile-cutout)" />`,
      `  <circle cx="${round(metrics.outerWidth / 2 + 56)}" cy="14" r="3.5" fill="var(--wf-device-mobile-cutout)" />`,
      `  <rect x="${round(metrics.outerWidth / 2 - 44)}" y="${metrics.outerHeight - 14}" width="88" height="5" rx="2.5" fill="var(--wf-device-mobile-home)" opacity="0.72" />`,
      "</svg>",
    ].join("\n");
  }

  const outerRadius = frameKind === "browser" ? 18 : 20;
  const chromeRadius = frameKind === "browser" ? 16 : 18;
  const chromeFill = frameKind === "browser" ? "var(--wf-device-browser-chrome)" : "var(--wf-device-app-chrome)";
  const trafficLightY = frameKind === "browser" ? 17 : 20;
  const shared = [
    `<svg class="wf-device-svg" viewBox="0 0 ${metrics.outerWidth} ${metrics.outerHeight}" width="${metrics.outerWidth}" height="${metrics.outerHeight}" aria-hidden="true">`,
    `  <rect x="1" y="1" width="${metrics.outerWidth - 2}" height="${metrics.outerHeight - 2}" rx="${outerRadius}" fill="var(--wf-device-outer-fill)" stroke="var(--wf-device-outer-stroke)" stroke-width="2" />`,
    buildTopRoundedChrome(metrics, chromeRadius, chromeFill),
    `  <line x1="2" y1="${metrics.viewportTop}" x2="${metrics.outerWidth - 2}" y2="${metrics.viewportTop}" stroke="var(--wf-device-divider)" stroke-width="1.5" />`,
    `  <circle cx="18" cy="${trafficLightY}" r="5" fill="var(--wf-device-traffic-red)" opacity="0.92" />`,
    `  <circle cx="32" cy="${trafficLightY}" r="5" fill="var(--wf-device-traffic-yellow)" opacity="0.92" />`,
    `  <circle cx="46" cy="${trafficLightY}" r="5" fill="var(--wf-device-traffic-green)" opacity="0.92" />`,
  ];

  if (frameKind === "app") {
    shared.push(`  <text x="${round(metrics.outerWidth / 2)}" y="25" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="var(--wf-device-title)">${escapeHtml(title)}</text>`);
    shared.push("</svg>");
    return shared.join("\n");
  }

  shared.push(buildBrowserToolbarIcon("back", 78, 21));
  shared.push(buildBrowserToolbarIcon("forward", 98, 21));
  shared.push(`  <rect x="118" y="8" width="${Math.max(220, metrics.outerWidth - 134)}" height="24" rx="12" fill="var(--wf-device-url-fill)" stroke="var(--wf-device-url-stroke)" stroke-width="1" />`);
  shared.push(`  <text x="136" y="23" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="var(--wf-device-url-text)">${escapeHtml(url || "https://wireframe.local")}</text>`);
  shared.push("</svg>");
  return shared.join("\n");
}

function getViewportRadiusStyles(frameKind, metrics) {
  if (frameKind === "mobile") {
    return {
      borderRadius: px(metrics.viewportRadius),
    };
  }

  return {
    borderTopLeftRadius: "0",
    borderTopRightRadius: "0",
    borderBottomRightRadius: px(metrics.viewportRadius),
    borderBottomLeftRadius: px(metrics.viewportRadius),
  };
}

function buildTopRoundedChrome(metrics, radius, fill) {
  const width = metrics.outerWidth - 4;
  const height = metrics.viewportTop - 2;
  const squareFillTop = 2 + radius;
  const squareFillHeight = Math.max(0, height - radius);

  return [
    `  <rect x="2" y="2" width="${width}" height="${height}" rx="${radius}" fill="${fill}" />`,
    `  <rect x="2" y="${squareFillTop}" width="${width}" height="${squareFillHeight}" fill="${fill}" />`,
  ].join("\n");
}

function buildBrowserToolbarIcon(kind, cx, cy) {
  const stroke = "var(--wf-device-toolbar)";

  if (kind === "back") {
    return `  <path d="M ${cx + 4} ${cy - 6} L ${cx - 2} ${cy} L ${cx + 4} ${cy + 6}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  if (kind === "forward") {
    return `  <path d="M ${cx - 4} ${cy - 6} L ${cx + 2} ${cy} L ${cx - 4} ${cy + 6}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  return "";
}

function computeScale(naturalWidth, naturalHeight, box) {
  let scale = 1;

  if (box.boxWidth != null) {
    scale = box.boxWidth / naturalWidth;
  }

  if (box.boxHeight != null) {
    scale = Math.min(scale, box.boxHeight / naturalHeight);
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }

  return round(scale);
}

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
