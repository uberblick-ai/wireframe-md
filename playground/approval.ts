// What an approval records and how an example compares with it. The page runs
// this in the browser on the render a person sees; the tests run it in jsdom.

/** One entry in examples/approvals.json. Only the human Approve control writes it. */
export interface Approval {
  approved: boolean;
  /** Covers the saved source, stylesheet fingerprint and formatted markup. */
  fingerprint: string;
  /** Optional review snapshot: a digest alone cannot show the previous markup. */
  markup?: string;
  stylesheet?: string;
}

/**
 * Where an example stands against its approval. Scheme and host change neither
 * the markup nor the stylesheet, so one approval covers every toggle.
 */
export type Status =
  /** The saved source has an error, so there is no render to approve. */
  | { state: "error" }
  | { state: "unapproved" }
  | { state: "approved" }
  | { state: "changed" };

/**
 * The rendered markup as an approval records it: one element or text per line,
 * indented by depth, so a person can read it and its differences. An element
 * holding only text stays on one line.
 */
export function formatMarkup(element: Element): string {
  return lines(element, 0).join("\n");
}

function lines(node: Node, depth: number): string[] {
  const indent = "  ".repeat(depth);
  if (node.nodeType === node.TEXT_NODE) return [`${indent}${escapeMarkup(node.textContent ?? "")}`];
  if (node.nodeType !== node.ELEMENT_NODE) return [];
  const element = node as Element;
  const attributes = [...element.attributes].map(({ name, value }) => ` ${name}="${escapeMarkup(value)}"`).join("");
  const open = `<${element.localName}${attributes}>`;
  const close = `</${element.localName}>`;
  const [only, ...rest] = element.childNodes;
  if (only === undefined) return [`${indent}${open}${close}`];
  if (rest.length === 0 && only.nodeType === only.TEXT_NODE) {
    return [`${indent}${open}${escapeMarkup(only.textContent ?? "")}${close}`];
  }
  return [`${indent}${open}`, ...[...element.childNodes].flatMap((child) => lines(child, depth + 1)), `${indent}${close}`];
}

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/**
 * Markup characters as entities, and control characters, line and paragraph
 * separators and no-break spaces as character references, so nothing breaks or
 * hides a line.
 */
function escapeMarkup(text: string): string {
  return text.replace(
    /[&<>"\p{Cc}\p{Zl}\p{Zp}\u{a0}]/gu,
    (char) => ENTITIES[char] ?? `&#x${char.charCodeAt(0).toString(16)};`,
  );
}

/** `sha256:` and the hex digest of the text. */
export async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Compare an example's current fingerprint with its approval. It is null when
 * the saved source has an error.
 */
export function statusOf(currentFingerprint: string | null, approval: Approval | null): Status {
  if (currentFingerprint === null) return { state: "error" };
  if (approval === null || !approval.approved) return { state: "unapproved" };
  return currentFingerprint !== approval.fingerprint ? { state: "changed" } : { state: "approved" };
}

/** A length-safe encoding shared by the browser and server. */
export function approvalFingerprint(source: string, stylesheet: string, markup: string): Promise<string> {
  return fingerprint(JSON.stringify([source, stylesheet, markup]));
}

/** A status in a few words, for the gallery. */
export function describeStatus(status: Status): string {
  switch (status.state) {
    case "error":
      return "Has errors";
    case "unapproved":
      return "Not yet approved";
    case "approved":
      return "Approved";
    case "changed":
      return "Changed since approval";
  }
}

export interface DiffLine {
  text: string;
  /** Whether only this side has the line. */
  changed: boolean;
}

/**
 * Mark the lines of two texts that the other lacks, by a longest common
 * subsequence of lines, to show them side by side.
 */
export function diffLines(before: string, after: string): { before: DiffLine[]; after: DiffLine[] } {
  const a = before.split("\n");
  const b = after.split("\n");
  // common[i][j]: the length of the longest common subsequence of a from i and b from j.
  const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const at = (i: number, j: number): number => common[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = common[i] ?? [];
    for (let j = b.length - 1; j >= 0; j -= 1) {
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const left = a.map((text) => ({ text, changed: true }));
  const right = b.map((text) => ({ text, changed: true }));
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const [l, r] = [left[i], right[j]];
    if (l !== undefined && r !== undefined && l.text === r.text) {
      l.changed = false;
      r.changed = false;
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) i += 1;
    else j += 1;
  }
  return { before: left, after: right };
}
