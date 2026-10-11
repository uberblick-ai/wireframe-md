// Format v0.1's closed lists and limits. The parser warns about anything outside
// them; the renderer reads the same lists.

export const LIMITS = {
  /** UTF-16 code units, as JavaScript counts a string's length. */
  characters: 64_000,
  lines: 200,
  /** A root is level 1. */
  levels: 8,
} as const;

export interface KindRule {
  /** Where the kind may stand: at the top level, directly inside a root, or directly inside a row. */
  place: "top" | "root" | "row";
  variants: readonly string[];
  /** Whether the line may carry a label. */
  label: boolean;
}

// A Map, so a kind such as `constructor` cannot find an Object.prototype member.
export const KINDS: ReadonlyMap<string, KindRule> = new Map<string, KindRule>([
  ["dialog", { place: "top", variants: [], label: true }],
  ["banner", { place: "top", variants: ["neutral", "info", "warning", "danger"], label: false }],
  ["text", { place: "root", variants: ["muted", "strong"], label: true }],
  ["row", { place: "root", variants: ["end"], label: false }],
  ["button", { place: "row", variants: ["primary", "danger", "link", "focus"], label: true }],
  // The label is the icon's name.
  ["icon", { place: "root", variants: [], label: true }],
]);

export const ROOTS: readonly string[] = [...KINDS].filter(([, rule]) => rule.place === "top").map(([kind]) => kind);

export const ICONS: readonly string[] = ["archive"];
