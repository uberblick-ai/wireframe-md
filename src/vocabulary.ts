// Format v0.1's closed lists and limits. The parser warns about anything outside
// them; the renderer reads the same lists.

export const LIMITS = {
  /** UTF-16 code units, as JavaScript counts a string's length. */
  characters: 64_000,
  lines: 200,
  /** A root is level 1. */
  levels: 8,
} as const;

/**
 * Where a node stands, named by its parent: at the top level, or directly inside
 * a root, a row, a table, a table row (a row directly inside a table), a toggle
 * or a cell. A dock holds the phone vocabulary; a card holds text, images and rows.
 */
export type Place = "top" | "root" | "dialog" | "page" | "frame" | "phone" | "dock" | "card" | "row" | "table" | "table row" | "toggle" | "option" | "cell" | "button";

export interface KindRule {
  /** Where the kind may stand. */
  place: readonly Place[];
  variants: readonly string[];
  /** Whether the line may carry a label. */
  label: boolean;
}

export const CELL_SORT_VARIANTS: readonly string[] = ["sortable", "ascending", "descending"];
export const ROW_LAYOUT_VARIANTS: readonly string[] = ["end", "between", "scroll"];
export const IMAGE_SHAPE_VARIANTS: readonly string[] = ["square", "round"];
export const PAGE_CHROME_VARIANTS: readonly string[] = ["browser", "window"];
export const HUE_VARIANTS: readonly string[] = ["red", "amber", "green", "blue"];
const TEXT_COLOURS: readonly string[] = ["muted", ...HUE_VARIANTS];

/** Muted competes with hues on text; other kinds keep their semantic variants. */
export function colourVariants(kind: string): readonly string[] {
  return kind === "icon" ? HUE_VARIANTS : kind === "text" ? TEXT_COLOURS : [];
}

// A Map, so a kind such as `constructor` cannot find an Object.prototype member.
export const KINDS: ReadonlyMap<string, KindRule> = new Map<string, KindRule>([
  ["dialog", { place: ["top"], variants: [], label: true }],
  ["banner", { place: ["top"], variants: ["neutral", "info", "warning", "danger", "success"], label: false }],
  // Only chrome variants take a label; the content title is a text.title line.
  ["page", { place: ["top"], variants: PAGE_CHROME_VARIANTS, label: true }],
  ["frame", { place: ["top"], variants: [], label: true }],
  ["phone", { place: ["top"], variants: [], label: false }],
  ["dock", { place: ["phone"], variants: [], label: false }],
  ["card", { place: ["top", "root", "dock", "row"], variants: [], label: false }],
  ["image", { place: ["root", "dock", "card", "row"], variants: IMAGE_SHAPE_VARIANTS, label: true }],
  ["text", { place: ["root", "dock", "card", "row"], variants: ["muted", "strong", "title", "small", ...HUE_VARIANTS], label: true }],
  // Inside a table, a row is a table row of cells: .head there, .end outside one.
  ["row", { place: ["root", "dock", "card", "table"], variants: ["end", "between", "scroll", "head"], label: false }],
  ["divider", { place: ["dialog", "page", "frame", "phone", "dock"], variants: [], label: false }],
  ["button", { place: ["row", "cell", "frame"], variants: ["primary", "danger", "link", "focus"], label: true }],
  // The label is the icon's name.
  ["icon", { place: ["root", "dock", "cell", "button", "option"], variants: ["filled", ...HUE_VARIANTS], label: true }],
  // The label is the placeholder.
  ["input", { place: ["root", "dock", "row"], variants: [], label: true }],
  // The label is the chosen value.
  ["select", { place: ["root", "dock", "row"], variants: [], label: true }],
  ["toggle", { place: ["root", "dock", "row"], variants: [], label: false }],
  ["option", { place: ["toggle"], variants: ["current"], label: true }],
  ["table", { place: ["root", "dock"], variants: [], label: false }],
  ["cell", { place: ["table row"], variants: ["end", ...CELL_SORT_VARIANTS], label: true }],
  ["chip", { place: ["row", "cell"], variants: ["more"], label: true }],
]);

// Placement roots hold the general vocabulary. A card may also stand at the
// top level, but it is not a placement root.
export const ROOTS: readonly string[] = [...KINDS]
  .filter(([, rule]) => rule.place.length === 1 && rule.place.includes("top"))
  .map(([kind]) => kind);

export { ICONS } from "./icons.js";
