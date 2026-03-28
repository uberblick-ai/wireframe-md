// @ts-check

const FENCE_START_REGEX = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/;
const FENCE_CLOSE_REGEX = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

/**
 * @typedef {{ boxWidth: number | null, boxHeight: number | null }} RenderBox
 * @typedef {{ language: string, options: RenderBox }} FenceInfo
 * @typedef {{ code: string, info: FenceInfo }} WireframeBlock
 * @typedef {{ indent: number, marker: string, markerLength: number, info: FenceInfo }} FenceStart
 */

/**
 * @param {{ boxWidth?: number | null, boxHeight?: number | null, width?: number | null, height?: number | null }} [options]
 * @returns {RenderBox}
 */
export function normalizeRenderBox(options = {}) {
  return {
    boxWidth: options.boxWidth ?? options.width ?? null,
    boxHeight: options.boxHeight ?? options.height ?? null,
  };
}

/**
 * @param {string} [rawSpec]
 * @returns {RenderBox}
 */
export function parseWireframeFenceOptions(rawSpec = "") {
  const spec = rawSpec.trim();
  if (!spec) return normalizeRenderBox();

  const sizeMatch = spec.match(/^(\d+)?x(\d+)?$/);
  if (!sizeMatch) {
    throw new Error(`Invalid wireframe fence options "${spec}". Use [x400], [960x], or [1280x800].`);
  }

  const [, width, height] = sizeMatch;

  return {
    boxWidth: width ? Number(width) : null,
    boxHeight: height ? Number(height) : null,
  };
}

/**
 * @param {string} [rawInfo]
 * @returns {FenceInfo}
 */
export function parseFenceInfo(rawInfo = "") {
  const info = rawInfo.trim();

  if (!info) {
    return { language: "", options: normalizeRenderBox() };
  }

  const language = info.match(/^[^\s\[]+/)?.[0] || "";
  const bracketSpec = info.match(/\[(.*?)\]/)?.[1] || "";

  return {
    language,
    options: language === "wireframe" ? parseWireframeFenceOptions(bracketSpec) : normalizeRenderBox(),
  };
}

/**
 * @param {{ boxWidth?: number | null, boxHeight?: number | null, width?: number | null, height?: number | null }} [options]
 * @returns {string}
 */
export function formatWireframeFenceInfo(options = {}) {
  const box = normalizeRenderBox(options);

  if (box.boxWidth == null && box.boxHeight == null) {
    return "wireframe";
  }

  const width = box.boxWidth == null ? "" : Number(box.boxWidth);
  const height = box.boxHeight == null ? "" : Number(box.boxHeight);

  if ((box.boxWidth != null && !Number.isFinite(width)) || (box.boxHeight != null && !Number.isFinite(height))) {
    throw new Error("Wireframe fence dimensions must be numbers when provided.");
  }

  return `wireframe[${width === "" ? "" : width}x${height === "" ? "" : height}]`;
}

/**
 * @param {string} [rawLine]
 * @returns {FenceStart | null}
 */
export function parseFenceStartLine(rawLine = "") {
  const match = String(rawLine).match(FENCE_START_REGEX);
  if (!match) return null;

  const [, indent, markerText, rawInfo] = match;

  return {
    indent: indent.length,
    marker: markerText[0],
    markerLength: markerText.length,
    info: parseFenceInfo((rawInfo || "").trim()),
  };
}

/**
 * @param {string} [rawLine]
 * @param {FenceStart | null} [opener]
 */
export function isMatchingFenceCloseLine(rawLine = "", opener = null) {
  if (!opener) return false;

  const match = String(rawLine).match(FENCE_CLOSE_REGEX);
  if (!match) return false;

  const markerText = match[2];
  return markerText[0] === opener.marker && markerText.length >= opener.markerLength;
}

/**
 * @param {string} markdownSource
 * @returns {WireframeBlock[]}
 */
export function extractWireframeBlocks(markdownSource) {
  /** @type {WireframeBlock[]} */
  const blocks = [];
  const lines = String(markdownSource || "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const opener = parseFenceStartLine(lines[lineIndex]);
    if (!opener || opener.info.language !== "wireframe") continue;

    const codeLines = [];
    let closingLineIndex = lineIndex + 1;

    while (closingLineIndex < lines.length && !isMatchingFenceCloseLine(lines[closingLineIndex], opener)) {
      codeLines.push(lines[closingLineIndex]);
      closingLineIndex += 1;
    }

    if (closingLineIndex >= lines.length) {
      continue;
    }

    blocks.push({
      code: codeLines.join("\n"),
      info: opener.info,
    });
    lineIndex = closingLineIndex;
  }

  return blocks;
}
