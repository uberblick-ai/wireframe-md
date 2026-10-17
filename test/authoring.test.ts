import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe } from "../src/index.js";
import { KINDS, type KindRule, type Place } from "../src/vocabulary.js";
import { archivedBanner, cardBlock, deleteConfirmation, documentList } from "./samples.js";

// AUTHORING.md is the primer agents read before writing a block, and the
// package ships it. These tests read the file itself, so its examples, its
// diagnostics and its table of kinds agree with the parser.

interface Block {
  /** The fence's info string. */
  info: string;
  body: string;
  /** The `###` heading the block sits under, or "" before the first one. */
  heading: string;
}

const primer = readFileSync(join(import.meta.dirname, "../AUTHORING.md"), "utf8");

/** The fenced code blocks in Markdown, followed by any fenced inside a ````markdown block. */
function blocks(markdown: string): Block[] {
  const found: Block[] = [];
  let heading = "";
  let open: { fence: string; info: string; body: string[] } | undefined;
  for (const line of markdown.split("\n")) {
    if (open !== undefined) {
      if (line.startsWith(open.fence) && /^`+\s*$/.test(line)) {
        const block = { info: open.info, body: open.body.join("\n"), heading };
        found.push(block);
        if (block.info === "markdown") found.push(...blocks(block.body).map((inner) => ({ ...inner, heading })));
        open = undefined;
      } else open.body.push(line);
      continue;
    }
    const fence = /^(`{3,})(.*)$/.exec(line);
    if (fence !== null) open = { fence: fence[1]!, info: fence[2]!.trim(), body: [] };
    else if (/^#{1,3} /.test(line)) heading = line.startsWith("### ") ? line.slice(4) : "";
  }
  return found;
}

/** The lines between a `## title` heading and the next `## ` heading. */
function section(title: string): string {
  const start = primer.indexOf(`\n## ${title}\n`);
  if (start === -1) throw new Error(`AUTHORING.md has no section "${title}"`);
  const end = primer.indexOf("\n## ", start + 1);
  return primer.slice(start, end === -1 ? undefined : end);
}

/** A source's diagnostics, written as the primer shows them. */
const diagnostics = (source: string): string[] =>
  parseWireframe(source).diagnostics.map(({ line, severity, message }) => `line ${line}: ${severity}: ${message}`);

describe("AUTHORING.md", () => {
  const all = blocks(primer);
  const wireframes = all.filter((block) => block.info === "wireframe");

  it("parses every wireframe block, examples and fixes alike, with no diagnostics", () => {
    for (const { body, heading } of wireframes) {
      expect(diagnostics(body), `the block under "${heading}":\n${body}`).toEqual([]);
    }
  });

  it("shows the block's Markdown form with exactly wireframe on the fence line", () => {
    const markdown = all.find((block) => block.info === "markdown");
    expect(markdown?.body.split("\n")[0]).toBe("```wireframe");
  });

  it("holds both samples exactly as written", () => {
    const bodies = blocks(section("Samples")).map((block) => block.body);
    expect(bodies).toEqual([deleteConfirmation, archivedBanner]);
  });

  it("shows the document list page exactly as written", () => {
    expect(blocks(section("A page")).map((block) => block.body)).toEqual([documentList]);
  });

  it("shows the Card block exactly as written", () => {
    expect(blocks(section("Card block")).map((block) => block.body)).toEqual([cardBlock]);
  });

  describe("common mistakes", () => {
    // The blocks under each mistake's heading.
    const mistakes = new Map<string, Block[]>();
    for (const block of blocks(section("Common mistakes"))) {
      mistakes.set(block.heading, [...(mistakes.get(block.heading) ?? []), block]);
    }

    it("covers the mistakes the primer promises", () => {
      expect([...mistakes.keys()]).toEqual([
        "A tab in the indentation",
        "An odd number of spaces",
        "A jump of more than one level",
        "An indented first line",
        "An unterminated quote",
        "Text after a closing quote",
        "A label that starts with `word=`",
        "A button outside a row",
        "A label on a banner or a row",
        "Anything but a cell in a table row",
        "A root inside another node",
        "An unknown kind, variant or icon",
      ]);
    });

    for (const [heading, [wrong, shown, fixed, ...rest] = []] of mistakes) {
      it(`gives exactly the diagnostics shown for "${heading}", and none for its fix`, () => {
        // Each mistake is the wrong source, its diagnostics, then the fix.
        expect([wrong?.info, shown?.info, fixed?.info, rest.length]).toEqual(["text", "text", "wireframe", 0]);
        const expected = shown!.body.split("\n");
        expect(expected.length).toBeGreaterThan(0);
        expect(diagnostics(wrong!.body)).toEqual(expected);
        expect(diagnostics(fixed!.body)).toEqual([]);
      });
    }
  });

  describe("kinds", () => {
    const PLACES: Record<Place, string> = {
      top: "",
      root: "a root",
      dialog: "a `dialog`",
      page: "a `page`",
      frame: "a `frame`",
      phone: "a `phone`",
      dock: "a `dock`",
      card: "a `card`",
      row: "a `row`",
      table: "a `table`",
      "table row": "a table `row`",
      toggle: "a `toggle`",
      option: "an `option`",
      cell: "a `cell`",
      button: "a `button`",
    };
    const where = (rule: KindRule): string => {
      const inside = rule.place.filter((place) => place !== "top");
      return [
        ...(rule.place.includes("top") ? ["at the top level"] : []),
        ...(inside.length > 0 ? [`directly inside ${inside.map((place) => PLACES[place]).join(" or ")}`] : []),
      ].join(" or ");
    };
    // `| kind | where | variants | label |` rows of the table under "Kinds".
    const rows = new Map(
      section("Kinds")
        .split("\n")
        .map((line) => /^\| `([a-z]+)` \| (.*) \| (.*) \| (.*) \|$/.exec(line))
        .filter((match) => match !== null)
        .map(([, kind, where, variants, label]) => [kind!, { where: where!, variants: variants!, label: label! }]),
    );
    const backticked = (cell: string, pattern: RegExp): string[] => [...cell.matchAll(pattern)].map((match) => match[1]!);

    it("lists every kind the parser knows, and no other", () => {
      expect([...rows.keys()]).toEqual([...KINDS.keys()]);
    });

    for (const [kind, rule] of KINDS) {
      it(`says where ${kind} stands, its variants and its label`, () => {
        const row = rows.get(kind);
        expect(row).toBeDefined();
        expect(row!.where).toBe(kind === "row"
          ? "directly inside a root, a `dock`, a `card` or a non-table `row`; or inside a `table` as a table row"
          : where(rule));
        expect(backticked(row!.variants, /`\.([a-z-]+)`/g)).toEqual(rule.variants);
        if (rule.variants.length === 0) expect(row!.variants).toBe("none");
        expect(row!.label.startsWith("none")).toBe(!rule.label);
      });
    }

    it("names Tabler's catalog and valid example names", () => {
      expect(rows.get("icon")!.label).toContain("Tabler");
      for (const name of backticked(rows.get("icon")!.label, /`([a-z-]+)`/g)) {
        expect(parseWireframe(`page\n  icon ${name}`).diagnostics).toEqual([]);
      }
    });
  });

  it("credits Wireloom's primer with a link", () => {
    const credit = section("Credit").replaceAll(/\s+/g, " ");
    expect(credit).toContain("(https://github.com/StardockCorp/Wireloom/blob/main/AGENTS.md)");
    expect(credit).toContain("(MIT, © 2026 Brad Wardell)");
  });
});
