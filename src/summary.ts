import type { WireframeNode, WireframeParseResult } from "./model.js";

// Strongest first, as the stylesheet's later tone rules win.
const TONES: readonly string[] = ["danger", "warning", "info"];

/**
 * One line of plain text for the host's accessible label. It names each root
 * with its title or text, for example
 * `Wireframe: dialog “Delete “Q3 launch draft”?”; warning banner “Archived.”`.
 */
export function summarizeWireframe(result: WireframeParseResult): string {
  if (!result.renderable) return "Wireframe with errors";
  if (result.nodes.length === 0) return "Empty wireframe";
  // Labels hold no line breaks, but may hold other vertical space such as U+2028.
  return `Wireframe: ${result.nodes.map(describe).join("; ")}`.replace(/[\s\u0085]+/g, " ");
}

function describe(node: WireframeNode): string {
  const text = node.label || node.children.find((child) => child.kind === "text" && child.label !== "")?.label;
  return text ? `${name(node)} “${text}”` : name(node);
}

function name(node: WireframeNode): string {
  if (node.kind === "") return "unnamed node";
  if (node.kind !== "banner") return node.kind;
  const tone = TONES.find((variant) => node.variants.includes(variant));
  return tone === undefined ? "banner" : `${tone} banner`;
}
