// @ts-check

import { escapeHtml, px, round, styleAttr } from "./utils.js";

/**
 * @typedef {{ outerWidth: number, outerHeight: number, viewportLeft: number, viewportTop: number, viewportWidth: number, viewportHeight: number, viewportRadius: number }} ScreenMetrics
 */

/**
 * @param {"mobile" | "app" | "browser"} frameKind
 * @param {number} width
 * @param {number} height
 * @returns {ScreenMetrics}
 */
export function getFrameMetrics(frameKind, width, height) {
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

/**
 * @param {"mobile" | "app" | "browser"} frameKind
 * @param {ScreenMetrics} metrics
 * @param {string} title
 * @param {string | null} url
 */
export function renderDeviceFrameMarkup(frameKind, metrics, title, url) {
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

/**
 * @param {"mobile" | "app" | "browser"} frameKind
 * @param {ScreenMetrics} metrics
 * @param {string} title
 * @param {string | null} url
 */
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

/**
 * @param {"mobile" | "app" | "browser"} frameKind
 * @param {ScreenMetrics} metrics
 */
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

/**
 * @param {ScreenMetrics} metrics
 * @param {number} radius
 * @param {string} fill
 */
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

/**
 * @param {"back" | "forward"} kind
 * @param {number} cx
 * @param {number} cy
 */
function buildBrowserToolbarIcon(kind, cx, cy) {
  const stroke = "var(--wf-device-toolbar)";

  if (kind === "back") {
    return `  <path d="M ${cx + 4} ${cy - 6} L ${cx - 2} ${cy} L ${cx + 4} ${cy + 6}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  return `  <path d="M ${cx - 4} ${cy - 6} L ${cx + 2} ${cy} L ${cx - 4} ${cy + 6}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
}

