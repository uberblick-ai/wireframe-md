// @ts-check

import { compileWireframe, extractWireframeBlocks, normalizeRenderBox } from "@wireframe-md/core";
import { DEFAULT_STYLES } from "./default_styles.js";
import { buildTopLevelModel } from "./top_level.js";
import { normalizeThemeOption, resolveThemeClassName } from "./theme.js";
import { px, round, styleAttr, escapeHtml } from "./utils.js";

const DOC_GAP = 20;

export function getDefaultStyles() {
  return DEFAULT_STYLES;
}

/**
 * @param {string} markdownSource
 * @returns {string}
 */
export function renderMarkdownWireframesToHtml(markdownSource) {
  return extractWireframeBlocks(markdownSource)
    .map(({ code, info }) => renderWireframeBlockToHtml(code, info.options))
    .join("\n");
}

/**
 * @param {string} markdownSource
 * @param {{ title?: string, theme?: "auto" | "light" | "dark" }} [options]
 * @returns {string}
 */
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

/**
 * @param {string} source
 * @param {{ boxWidth?: number | null, boxHeight?: number | null, width?: number | null, height?: number | null, theme?: "auto" | "light" | "dark" }} [options]
 * @returns {string}
 */
export function renderWireframeBlockToHtml(source, options = {}) {
  const ast = compileWireframe(source);
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

/**
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{ boxWidth: number | null, boxHeight: number | null }} box
 * @returns {number}
 */
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

