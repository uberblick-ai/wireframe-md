// The parsed form of a wireframe block. Plain data only, so a result survives
// JSON.stringify and can cross a worker or process boundary unchanged.

/** One non-blank line: `kind.variant#id key=value Label`. */
export interface WireframeNode {
  /** The first word up to any `.` or `#`, as written, known or not. */
  kind: string;
  /** Dot classes after the kind, in source order. */
  variants: string[];
  /** The `#id`, present only when the line has one. */
  id?: string;
  /** `key=value` pairs in source order. v0.1 defines none, so each one is warned about. */
  attributes: WireframeAttribute[];
  /** The rest of the line as plain text, without its quotes. Empty when there is none. */
  label: string;
  /** 1-based line in the block body; blank lines count. */
  line: number;
  /** Lines indented one level below this one, in source order. */
  children: WireframeNode[];
}

export interface WireframeAttribute {
  key: string;
  value: string;
}

export interface WireframeDiagnostic {
  /** 1-based line in the block body. */
  line: number;
  /** A warning still renders; an error means the source must not be rendered. */
  severity: "error" | "warning";
  /** What was wrong and what was expected, e.g. `button must be directly inside row or cell`. */
  message: string;
}

export interface WireframeParseResult {
  /** Top-level nodes in source order, unknown and misplaced ones included. */
  nodes: WireframeNode[];
  /** Every problem found, in line order. */
  diagnostics: WireframeDiagnostic[];
  /** False when any diagnostic is an error. */
  renderable: boolean;
}
