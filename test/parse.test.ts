import { describe, expect, it } from "vitest";
import { parseWireframe, type WireframeDiagnostic, type WireframeNode } from "../src/index.js";

const node = (line: number, kind: string, fields: Partial<WireframeNode> = {}): WireframeNode => ({
  kind,
  variants: [],
  attributes: [],
  label: "",
  line,
  children: [],
  ...fields,
});

const warning = (line: number, message: string): WireframeDiagnostic => ({ line, severity: "warning", message });
const error = (line: number, message: string): WireframeDiagnostic => ({ line, severity: "error", message });

/** The diagnostics for a source, which should still render. */
const warnings = (source: string): WireframeDiagnostic[] => {
  const result = parseWireframe(source);
  expect(result.renderable).toBe(true);
  return result.diagnostics;
};

/** The diagnostics for a source that must not render. */
const errors = (source: string): WireframeDiagnostic[] => {
  const result = parseWireframe(source);
  expect(result.renderable).toBe(false);
  return result.diagnostics;
};

// The two sources on the corpus page "Samples".
const deleteConfirmation = [
  "dialog Delete “Q3 launch draft”?",
  "  text It will be gone for everyone, with its comments and history. Links to it will show it was deleted. This can't be undone.",
  "  row.end",
  "    button.focus Cancel",
  "    button.danger Delete",
].join("\n");

const archivedBanner = [
  "banner.warning",
  "  icon archive",
  "  text Archived. Read-only and hidden from the document list.",
  "  row.end",
  "    button Restore",
  "    button.link.danger Delete…",
].join("\n");

describe("samples", () => {
  it("parses the delete confirmation", () => {
    expect(parseWireframe(deleteConfirmation)).toEqual({
      nodes: [
        node(1, "dialog", {
          label: "Delete “Q3 launch draft”?",
          children: [
            node(2, "text", {
              label:
                "It will be gone for everyone, with its comments and history. Links to it will show it was deleted. This can't be undone.",
            }),
            node(3, "row", {
              variants: ["end"],
              children: [
                node(4, "button", { variants: ["focus"], label: "Cancel" }),
                node(5, "button", { variants: ["danger"], label: "Delete" }),
              ],
            }),
          ],
        }),
      ],
      diagnostics: [],
      renderable: true,
    });
  });

  it("parses the archived banner", () => {
    expect(parseWireframe(archivedBanner)).toEqual({
      nodes: [
        node(1, "banner", {
          variants: ["warning"],
          children: [
            node(2, "icon", { label: "archive" }),
            node(3, "text", { label: "Archived. Read-only and hidden from the document list." }),
            node(4, "row", {
              variants: ["end"],
              children: [
                node(5, "button", { label: "Restore" }),
                node(6, "button", { variants: ["link", "danger"], label: "Delete…" }),
              ],
            }),
          ],
        }),
      ],
      diagnostics: [],
      renderable: true,
    });
  });

  it("gives the same result with a final line break, as Markdown parsers pass the body", () => {
    expect(parseWireframe(`${archivedBanner}\n`)).toEqual(parseWireframe(archivedBanner));
  });

  it("returns plain data that survives JSON", () => {
    for (const source of [deleteConfirmation, archivedBanner, "card#a.b x=1 Hi\n\tbutton"]) {
      const result = parseWireframe(source);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    }
  });
});

describe("lines", () => {
  it("numbers lines from the body's first line and counts blank lines", () => {
    const { nodes } = parseWireframe("\ndialog Title\n\n   \n  text Body\n");
    expect(nodes).toEqual([node(2, "dialog", { label: "Title", children: [node(5, "text", { label: "Body" })] })]);
  });

  it("accepts CRLF and CR line breaks", () => {
    expect(parseWireframe(deleteConfirmation.replaceAll("\n", "\r\n"))).toEqual(parseWireframe(deleteConfirmation));
    expect(parseWireframe(deleteConfirmation.replaceAll("\n", "\r"))).toEqual(parseWireframe(deleteConfirmation));
  });

  it("gives no nodes and no diagnostics for an empty or blank body", () => {
    for (const source of ["", "\n", "  \n\t\n"]) {
      expect(parseWireframe(source)).toEqual({ nodes: [], diagnostics: [], renderable: true });
    }
  });

  it("allows several roots in one block, in source order", () => {
    const result = parseWireframe("banner\n  text One\ndialog Two\n  text Three");
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.map((root) => [root.kind, root.line])).toEqual([
      ["banner", 1],
      ["dialog", 3],
    ]);
  });

  it("closes deeper levels when a line comes back out", () => {
    const { nodes } = parseWireframe("dialog\n  row\n    button A\n  text B\n  row\n    button C");
    expect(nodes[0]?.children.map((child) => [child.kind, child.line, child.children.length])).toEqual([
      ["row", 2, 1],
      ["text", 4, 0],
      ["row", 5, 1],
    ]);
  });
});

describe("line grammar", () => {
  const first = (source: string): WireframeNode => parseWireframe(source).nodes[0]!;

  it("reads variants and an id from the first word", () => {
    expect(first("button.link.danger#remove Delete…")).toEqual(
      node(1, "button", { variants: ["link", "danger"], id: "remove", label: "Delete…" }),
    );
    expect(first("dialog#confirm")).toEqual(node(1, "dialog", { id: "confirm" }));
  });

  it("takes the rest of the line as the label, keeping inner spacing and dropping trailing blanks", () => {
    expect(first("text  Two  spaces\there   \t").label).toBe("Two  spaces\there");
    expect(first("text a #3, 50% off. [x] *y* `z`").label).toBe("a #3, 50% off. [x] *y* `z`");
  });

  it("reads key=value attributes between the first word and the label", () => {
    expect(first('text tone=red size="very big" mode= Hello x=1')).toEqual(
      node(1, "text", {
        attributes: [
          { key: "tone", value: "red" },
          { key: "size", value: "very big" },
          { key: "mode", value: "" },
        ],
        label: "Hello x=1",
      }),
    );
  });

  it("treats a token as an attribute only when it starts with word=", () => {
    expect(first("text 2+2=4").label).toBe("2+2=4");
    expect(first("text =x").label).toBe("=x");
    expect(first("text a-b_c=1").attributes).toEqual([{ key: "a-b_c", value: "1" }]);
  });

  it("lets quotes keep a label that starts with word= from being read as an attribute", () => {
    expect(first('dialog "width=3 is fine"')).toEqual(node(1, "dialog", { label: "width=3 is fine" }));
    expect(warnings('dialog "width=3 is fine"')).toEqual([]);
  });

  it('unescapes \\" and \\\\ inside quotes and nothing else', () => {
    expect(first(String.raw`text "say \"hi\" \\ \n \q"`).label).toBe(String.raw`say "hi" \ \n \q`);
    expect(first(String.raw`button a="\"q\""`).attributes).toEqual([{ key: "a", value: '"q"' }]);
  });

  it("keeps backslashes and typographic quotes in an unquoted label as written", () => {
    expect(first(String.raw`text a \"b\" \\ “c” ‘d’`).label).toBe(String.raw`a \"b\" \\ “c” ‘d’`);
    expect(first("text “x=1”").attributes).toEqual([]);
  });

  it("keeps an empty quoted label and trailing blanks after a closing quote", () => {
    expect(first('dialog "" \t')).toEqual(node(1, "dialog"));
    expect(warnings('dialog "" \t')).toEqual([]);
  });

  it("finds no Object.prototype member when given a kind such as constructor", () => {
    expect(warnings("constructor\ntoString")).toEqual([
      warning(1, 'unknown kind "constructor": expected dialog, banner, text, row, button or icon'),
      warning(2, 'unknown kind "toString": expected dialog, banner, text, row, button or icon'),
    ]);
  });
});

describe("warnings", () => {
  it("keeps an unknown kind with its label and children", () => {
    const result = parseWireframe("dialog\n  card.big#c Hello\n    text Hi");
    expect(result.renderable).toBe(true);
    expect(result.nodes[0]?.children).toEqual([
      node(2, "card", { variants: ["big"], id: "c", label: "Hello", children: [node(3, "text", { label: "Hi" })] }),
    ]);
    expect(result.diagnostics).toEqual([
      warning(2, 'unknown kind "card": expected dialog, banner, text, row, button or icon'),
      warning(3, "text must be directly inside dialog or banner"),
    ]);
  });

  it("warns when a line has no kind", () => {
    expect(warnings("dialog\n  .muted Hi\n  #x")).toEqual([
      warning(2, "missing kind: expected dialog, banner, text, row, button or icon"),
      warning(3, "missing kind: expected dialog, banner, text, row, button or icon"),
    ]);
    expect(parseWireframe("dialog\n  .muted Hi").nodes[0]?.children[0]).toEqual(
      node(2, "", { variants: ["muted"], label: "Hi" }),
    );
  });

  it("warns about unknown variants", () => {
    expect(warnings("banner.alert\n  text.muted.big Hi\n  row.end.start")).toEqual([
      warning(1, 'unknown variant ".alert" on banner: expected .neutral, .info, .warning or .danger'),
      warning(2, 'unknown variant ".big" on text: expected .muted or .strong'),
      warning(3, 'unknown variant ".start" on row: expected .end'),
    ]);
    expect(warnings("dialog.wide\n  icon.big archive\n  row\n    button.ghost Go")).toEqual([
      warning(1, 'unknown variant ".wide": dialog takes no variants'),
      warning(2, 'unknown variant ".big": icon takes no variants'),
      warning(4, 'unknown variant ".ghost" on button: expected .primary, .danger, .link or .focus'),
    ]);
  });

  it("warns about an empty variant", () => {
    expect(warnings("banner..info\nbanner.")).toEqual([
      warning(1, 'empty variant: expected a name after "."'),
      warning(2, 'empty variant: expected a name after "."'),
    ]);
  });

  it("warns about a missing or invalid id and keeps it as written", () => {
    expect(warnings("dialog#\ndialog#a.b\ndialog#ok_1-x")).toEqual([
      warning(1, 'missing id: expected a name after "#"'),
      warning(2, 'invalid id "#a.b": expected letters, digits, - or _'),
    ]);
    expect(parseWireframe("dialog#a.b").nodes[0]?.id).toBe("a.b");
  });

  it("warns about every attribute, since v0.1 defines none", () => {
    expect(warnings("banner tone=warning\n  text a=1 b=2 Hi")).toEqual([
      warning(1, 'unknown attribute "tone": v0.1 has none (quote a label that starts with word=)'),
      warning(2, 'unknown attribute "a": v0.1 has none (quote a label that starts with word=)'),
      warning(2, 'unknown attribute "b": v0.1 has none (quote a label that starts with word=)'),
    ]);
  });

  it("warns about an icon name that is missing or not on the allowlist", () => {
    expect(warnings("banner\n  icon\n  icon trash\n  icon Archive")).toEqual([
      warning(2, "icon needs a name: expected archive"),
      warning(3, 'unknown icon "trash": expected archive'),
      warning(4, 'unknown icon "Archive": expected archive'),
    ]);
  });

  it("warns about a label on a kind that takes none", () => {
    expect(warnings("banner Archived\n  row.end Actions")).toEqual([
      warning(1, "banner takes no label"),
      warning(2, "row takes no label"),
    ]);
    expect(parseWireframe("banner Archived").nodes[0]?.label).toBe("Archived");
  });

  it("warns about a root that is not at the top level", () => {
    expect(warnings("dialog\n  banner\n  row\n    dialog")).toEqual([
      warning(2, "banner must be at the top level"),
      warning(4, "dialog must be at the top level"),
    ]);
  });

  it("warns about text, row and icon outside a root", () => {
    expect(warnings("text Hi\nrow\nicon archive")).toEqual([
      warning(1, "text must be directly inside dialog or banner"),
      warning(2, "row must be directly inside dialog or banner"),
      warning(3, "icon must be directly inside dialog or banner"),
    ]);
    expect(warnings("dialog\n  row\n    text Hi\n    row\n    icon archive")).toEqual([
      warning(3, "text must be directly inside dialog or banner"),
      warning(4, "row must be directly inside dialog or banner"),
      warning(5, "icon must be directly inside dialog or banner"),
    ]);
  });

  it("warns about a button outside a row", () => {
    expect(warnings("button Top\ndialog\n  button Inside\n  text Hi\n    button Under")).toEqual([
      warning(1, "button must be inside row"),
      warning(3, "button must be inside row"),
      warning(5, "button must be inside row"),
    ]);
  });

  it("keeps misplaced nodes where they were written", () => {
    expect(parseWireframe("dialog\n  button Inside").nodes).toEqual([
      node(1, "dialog", { children: [node(2, "button", { label: "Inside" })] }),
    ]);
  });

  it("cuts long source text short inside a message", () => {
    expect(warnings(`${"x".repeat(100)} label`)).toEqual([
      warning(1, `unknown kind "${"x".repeat(40)}…": expected dialog, banner, text, row, button or icon`),
    ]);
  });
});

describe("errors", () => {
  it("rejects a tab in the indentation", () => {
    expect(errors("dialog\n\ttext Hi\n \ttext Hi")).toEqual([
      error(2, "indentation must be spaces, not tabs"),
      error(3, "indentation must be spaces, not tabs"),
    ]);
  });

  it("rejects indentation that is not a multiple of two spaces", () => {
    expect(errors("dialog\n   text Hi\n row")).toEqual([
      error(2, "indentation must be a multiple of two spaces, found 3"),
      error(3, "indentation must be a multiple of two spaces, found 1"),
      // Recovered at depth 0, a row is out of place too.
      warning(3, "row must be directly inside dialog or banner"),
    ]);
  });

  it("rejects a line more than one level deeper than the line above", () => {
    expect(errors("dialog\n  row\n\n      button A\n    button B")).toEqual([
      error(4, "indented 6 spaces: expected at most 4, one level below line 2"),
    ]);
    expect(errors("  dialog")).toEqual([error(1, "expected no indentation on the first line")]);
    expect(errors("\n\n    dialog")).toEqual([error(3, "expected no indentation on the first line")]);
  });

  it("still places a badly indented line at the nearest depth it can take", () => {
    const { nodes } = parseWireframe("dialog\n      text Hi\n\ttext Ho");
    expect(nodes).toEqual([
      node(1, "dialog", { children: [node(2, "text", { label: "Hi" }), node(3, "text", { label: "Ho" })] }),
    ]);
  });

  it("rejects an unterminated quote in a label or an attribute value", () => {
    expect(errors('dialog\n  text "Hello\n  text a="b c\n  text "end\\"')).toEqual([
      error(2, 'unterminated quote: expected a closing "'),
      error(3, 'unterminated quote: expected a closing "'),
      warning(3, 'unknown attribute "a": v0.1 has none (quote a label that starts with word=)'),
      error(4, 'unterminated quote: expected a closing "'),
    ]);
    expect(parseWireframe('text "Hello').nodes[0]?.label).toBe("Hello");
  });

  it("rejects text after a closing quote", () => {
    expect(errors('dialog\n  text "Hi," she said')).toEqual([
      error(2, "expected the line to end after the closing quote"),
    ]);
    expect(errors('dialog\n  text a="b"c Label')).toEqual([
      error(2, "expected a space after the closing quote"),
      warning(2, 'unknown attribute "a": v0.1 has none (quote a label that starts with word=)'),
    ]);
  });

  it("keeps the nodes of a source that must not render", () => {
    const result = parseWireframe('dialog\n  text "Hi\n\trow');
    expect(result.renderable).toBe(false);
    expect(result.nodes[0]?.children.map((child) => child.kind)).toEqual(["text", "row"]);
  });
});

describe("limits", () => {
  const lines = (count: number): string => ["dialog", ...Array.from({ length: count - 1 }, () => "  text x")].join("\n");

  it("accepts 64,000 characters and rejects 64,001 on the line that crosses the limit", () => {
    const head = "dialog\n  text ";
    const fits = head + "x".repeat(64_000 - head.length);
    expect(fits.length).toBe(64_000);
    expect(parseWireframe(fits).renderable).toBe(true);
    expect(parseWireframe(`${fits}x`)).toEqual({
      nodes: [],
      diagnostics: [error(2, "too long: expected at most 64,000 characters")],
      renderable: false,
    });
  });

  it("puts the character error on the line holding the 64,001st character", () => {
    const filler = "  text x\n"; // 9 characters
    const source = `dialog\n${filler.repeat(10_000)}`;
    // 64,001st character is index 64,000; 7 characters of "dialog\n" leave 63,993 in filler lines.
    const expected = 2 + Math.floor((64_000 - 7) / filler.length);
    expect(parseWireframe(source).diagnostics).toEqual([
      error(expected, "too long: expected at most 64,000 characters"),
    ]);
    // With CRLF, "dialog\r\n" is 8 characters and each filler line 10.
    expect(parseWireframe(source.replaceAll("\n", "\r\n")).diagnostics[0]?.line).toBe(
      2 + Math.floor((64_000 - 8) / 10),
    );
  });

  it("accepts 200 lines and rejects 201 on line 201", () => {
    expect(parseWireframe(lines(200)).renderable).toBe(true);
    expect(parseWireframe(`${lines(200)}\n`).renderable).toBe(true);
    expect(parseWireframe(lines(201))).toEqual({
      nodes: [],
      diagnostics: [error(201, "too many lines: expected at most 200")],
      renderable: false,
    });
  });

  it("counts blank lines toward the line limit", () => {
    // "dialog" and 200 blank lines; the final line break ends the last of them.
    expect(parseWireframe(`${lines(1)}${"\n".repeat(201)}`).diagnostics).toEqual([
      error(201, "too many lines: expected at most 200"),
    ]);
  });

  it("reports only the character limit when both limits are exceeded", () => {
    expect(parseWireframe("\n".repeat(70_000)).diagnostics).toEqual([
      error(64_001, "too long: expected at most 64,000 characters"),
    ]);
  });

  it("accepts 8 levels of nesting and rejects a line at level 9", () => {
    const nested = (levels: number): string =>
      Array.from({ length: levels }, (_, depth) => `${"  ".repeat(depth)}row`).join("\n");
    expect(parseWireframe(nested(8)).renderable).toBe(true);
    expect(errors(nested(10)).filter((d) => d.severity === "error")).toEqual([
      error(9, "nested too deep: expected at most 8 levels"),
      error(10, "nested too deep: expected at most 8 levels"),
    ]);
    // Level 9 is 16 spaces of indentation.
    expect(nested(9).split("\n")[8]).toBe(`${" ".repeat(16)}row`);
  });

  it("parses a long line in linear time", () => {
    const result = parseWireframe(`dialog\n  text a${" ".repeat(63_000)}b`);
    expect(result.nodes[0]?.children[0]?.label).toBe(`a${" ".repeat(63_000)}b`);
  });
});

describe("robustness", () => {
  // A small deterministic generator, so a failure reproduces.
  const random = (seed: number): (() => number) => {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  };
  const pieces = [
    "dialog", "banner", "text", "row", "button", "icon", "card", ".", "#", "=", "a=", '"', "\\", " ", "  ",
    "\t", "\n", "\r\n", "\r", "x", "é", "“", "end", "focus", "archive", "😀",
  ];

  it("never throws, keeps one node per non-blank line and returns plain data", () => {
    const next = random(42);
    for (let run = 0; run < 2_000; run += 1) {
      const source = Array.from({ length: 1 + Math.floor(next() * 60) }, () => pieces[Math.floor(next() * pieces.length)])
        .join("");
      const result = parseWireframe(source);
      const sourceLines = source.split(/\r\n|\r|\n/);
      const count = (nodes: WireframeNode[]): number => nodes.reduce((sum, n) => sum + 1 + count(n.children), 0);
      expect(count(result.nodes)).toBe(sourceLines.filter((line) => !/^[ \t]*$/.test(line)).length);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(result.renderable).toBe(result.diagnostics.every((d) => d.severity === "warning"));
      const diagnosticLines = result.diagnostics.map((d) => d.line);
      expect(diagnosticLines).toEqual([...diagnosticLines].sort((a, b) => a - b));
      for (const line of diagnosticLines) expect(sourceLines[line - 1]?.trim()).toBeTruthy();
    }
  });
});
