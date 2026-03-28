// @ts-check

import { formatWireframeFenceInfo, isMatchingFenceCloseLine, normalizeRenderBox, parseFenceStartLine } from "@wireframe-md/core";

/**
 * @typedef {ReturnType<typeof normalizeRenderBox>} RenderBox
 * @typedef {{ tagName?: string, sourceAttribute?: string, optionsAttribute?: string }} WireframeBlockElementConfig
 * @typedef {{ source: string, options: RenderBox }} WireframeMarkdownTokenMeta
 */

export const WIREFRAME_BLOCK_TAG = "wireframe-md-block";
export const WIREFRAME_SOURCE_ATTRIBUTE = "data-source";
export const WIREFRAME_OPTIONS_ATTRIBUTE = "data-options";

export function serializeWireframeMarkdown(source = "", options = {}) {
  return `\`\`\`${formatWireframeFenceInfo(options)}\n${source}\n\`\`\``;
}

export function encodeWireframeBlockOptions(options = {}) {
  return encodeURIComponent(JSON.stringify(normalizeRenderBox(options)));
}

export function decodeWireframeBlockOptions(rawValue = "") {
  if (!rawValue) return {};

  try {
    return normalizeRenderBox(JSON.parse(decodeURIComponent(rawValue)));
  } catch (_error) {
    return {};
  }
}

export function renderWireframeBlockElement(source = "", options = {}, config = {}) {
  const tagName = config.tagName || WIREFRAME_BLOCK_TAG;
  const sourceAttribute = config.sourceAttribute || WIREFRAME_SOURCE_ATTRIBUTE;
  const optionsAttribute = config.optionsAttribute || WIREFRAME_OPTIONS_ATTRIBUTE;

  return `<${tagName} ${sourceAttribute}="${encodeURIComponent(source)}" ${optionsAttribute}="${encodeWireframeBlockOptions(options)}"></${tagName}>`;
}

export function installWireframeMarkdownParser(markdownit, config = {}) {
  if (markdownit.__wireframeBlockInstalled) return;

  const parseWireframeFence = (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const opener = parseFenceStartLine(state.src.slice(start, max));
    if (!opener || opener.info.language !== "wireframe") return false;

    if (silent) return true;

    const lines = [];
    let nextLine = startLine + 1;
    let found = false;

    while (nextLine < endLine) {
      const linePos = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineMax = state.eMarks[nextLine];
      if (isMatchingFenceCloseLine(state.src.slice(linePos, lineMax), opener)) {
        found = true;
        break;
      }

      lines.push(state.src.slice(state.bMarks[nextLine], state.eMarks[nextLine]));
      nextLine++;
    }

    if (!found) return false;

    const token = state.push("wireframe_block", WIREFRAME_BLOCK_TAG, 0);
    token.block = true;
    token.map = [startLine, nextLine + 1];
    token.meta = { source: lines.join("\n"), options: opener.info.options };
    state.line = nextLine + 1;
    return true;
  };

  markdownit.block.ruler.before("fence", "wireframe_block", parseWireframeFence);
  markdownit.renderer.rules.wireframe_block = (tokens, idx) => {
    const source = tokens[idx]?.meta?.source || "";
    const options = tokens[idx]?.meta?.options || {};
    return `${renderWireframeBlockElement(source, options, config)}\n`;
  };
  markdownit.__wireframeBlockInstalled = true;
}
