import type { WireframeNode, WireframeParseResult } from "./model.js";
import { textRuns } from "./text.js";

// Strongest first, as the stylesheet's later tone rules win.
const TONES: readonly string[] = ["danger", "warning", "info", "success"];

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
  const title = node.kind === "card"
    ? node.children.find((child) => child.kind === "text" && child.variants.includes("title"))
    : undefined;
  const named = node.label !== "" ? node : title?.label ? title :
    (node.kind === "frame" ? undefined : node.children.find((child) => child.kind === "text" && child.label !== ""));
  const text = named?.kind === "text" ? [...textRuns(named.label)].map((run) => run.text).join("") : named?.label;
  return text ? `${name(node)} “${text}”` : name(node);
}

function name(node: WireframeNode): string {
  if (node.kind === "") return "unnamed node";
  if (node.kind !== "banner") return node.kind;
  const tone = TONES.find((variant) => node.variants.includes(variant));
  return tone === undefined ? "banner" : `${tone} banner`;
}
