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
 * or a cell.
 */
export type Place = "top" | "root" | "row" | "table" | "table row" | "toggle" | "cell";

export interface KindRule {
  /** Where the kind may stand. */
  place: readonly Place[];
  variants: readonly string[];
  /** Whether the line may carry a label. */
  label: boolean;
}

// A Map, so a kind such as `constructor` cannot find an Object.prototype member.
export const KINDS: ReadonlyMap<string, KindRule> = new Map<string, KindRule>([
  ["dialog", { place: ["top"], variants: [], label: true }],
  ["banner", { place: ["top"], variants: ["neutral", "info", "warning", "danger"], label: false }],
  // Its title is a text.title line.
  ["page", { place: ["top"], variants: [], label: false }],
  ["text", { place: ["root"], variants: ["muted", "strong", "title"], label: true }],
  // Inside a table, a row is a table row of cells: .head there, .end outside one.
  ["row", { place: ["root", "table"], variants: ["end", "head"], label: false }],
  ["button", { place: ["row", "cell"], variants: ["primary", "danger", "link", "focus"], label: true }],
  // The label is the icon's name.
  ["icon", { place: ["root"], variants: [], label: true }],
  // The label is the placeholder.
  ["input", { place: ["root", "row"], variants: [], label: true }],
  // The label is the chosen value.
  ["select", { place: ["root", "row"], variants: [], label: true }],
  ["toggle", { place: ["root", "row"], variants: [], label: false }],
  ["option", { place: ["toggle"], variants: ["current"], label: true }],
  ["table", { place: ["root"], variants: [], label: false }],
  ["cell", { place: ["table row"], variants: ["end"], label: true }],
  ["chip", { place: ["row", "cell"], variants: ["more"], label: true }],
]);

export const ROOTS: readonly string[] = [...KINDS].filter(([, rule]) => rule.place.includes("top")).map(([kind]) => kind);

export const ICONS: readonly string[] = ["archive"];
