import { describe, expect, it } from "vitest";
import { parseWireframe, type WireframeDiagnostic, type WireframeNode } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";
import { archivedBanner, cardBlock, deleteConfirmation, documentList } from "./samples.js";

const node = (line: number, kind: string, fields: Partial<WireframeNode> = {}): WireframeNode => ({
  kind,
  variants: [],
  attributes: [],
  label: "",
  line,
  children: [],
  ...fields,
});

/** Every kind, as an unknown kind's warning lists them. */
const KIND_LIST = "dialog, banner, page, frame, phone, dock, card, image, fold, text, row, divider, button, icon, input, select, switch, toggle, tabs, option, table, cell or chip";

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

  it("accepts a success banner with the archive icon without diagnostics", () => {
    const result = parseWireframe("banner.success\n  icon archive\n  text Restored");
    expect(result.renderable).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes[0]?.variants).toEqual(["success"]);
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

  it("parses the document list page, with its table rows of cells", () => {
    const result = parseWireframe(documentList);
    expect(result.diagnostics).toEqual([]);
    const outline = (nodes: WireframeNode[], depth = 0): string[] =>
      nodes.flatMap((n) => [
        `${"  ".repeat(depth)}${[n.kind, ...n.variants].join(".")}${n.label === "" ? "" : ` ${n.label}`}`,
        ...outline(n.children, depth + 1),
      ]);
    // The source, line for line.
    expect(outline(result.nodes)).toEqual(documentList.split("\n"));
    const table = result.nodes[0]?.children.find((child) => child.kind === "table");
    expect(table?.children.map((row) => [row.line, row.variants, row.children.map((cell) => cell.kind)])).toEqual([
      [11, ["head"], ["cell", "cell", "cell", "cell", "cell"]],
      [17, [], ["cell", "cell", "cell", "cell", "cell"]],
      [28, [], ["cell", "cell", "cell", "cell", "cell"]],
    ]);
  });

  it("gives the same result with a final line break, as Markdown parsers pass the body", () => {
    expect(parseWireframe(`${archivedBanner}\n`)).toEqual(parseWireframe(archivedBanner));
  });

  it("returns plain data that survives JSON", () => {
    for (const source of [deleteConfirmation, archivedBanner, documentList, "card#a.b x=1 Hi\n\tbutton"]) {
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
      warning(1, `unknown kind "constructor": expected ${KIND_LIST}`),
      warning(2, `unknown kind "toString": expected ${KIND_LIST}`),
    ]);
  });
});

describe("warnings", () => {
  it("accepts a top-level card and small text combined with other variants", () => {
    expect(warnings(cardBlock)).toEqual([]);
    expect(warnings("card\n  text.small.strong.title Title\npage\n  text.small.muted Label")).toEqual([]);
  });

  it("accepts frame captions and text-only cards directly inside every root", () => {
    for (const kind of ["dialog", "banner", "page", "frame"]) {
      expect(warnings(`${kind}\n  card\n    text.muted Preview\n    text Body`)).toEqual([]);
    }
    expect(warnings("frame Caption\n  button.link Open\n  row\n    button Load\n  table\n    row\n      cell Body")).toEqual([]);
  });

  it("warns about a nested frame, cards outside roots and caption buttons in other roots", () => {
    expect(warnings("frame Outer\n  frame Inner\n  row\n    card\ncard")).toEqual([
      warning(2, "frame must be at the top level"),
    ]);
    for (const kind of ["dialog", "banner", "page"]) {
      expect(warnings(`${kind}\n  button Open`)).toEqual([
        warning(2, "button must be directly inside row, cell or frame"),
      ]);
    }
  });

  it("warns about every known kind except text, image, fold, row, switch and tabs directly inside a card", () => {
    for (const prefix of ["card\n  ", "frame\n  card\n    "]) {
      for (const kind of KINDS.keys()) {
        if (["text", "image", "fold", "row", "switch", "tabs"].includes(kind)) continue;
        const diagnostics = warnings(`${prefix}${kind}${kind === "icon" ? " archive" : ""}`);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({ line: prefix.split("\n").length, severity: "warning" });
        expect(diagnostics[0]!.message).toContain(kind);
        expect(diagnostics[0]!.message).toMatch(/must be (at the top level|directly inside)/);
      }
    }
    expect(warnings("frame\n  card\n    row")).toEqual([]);
  });

  it("warns about a card inside any non-root, including another card", () => {
    for (const parent of KINDS.keys()) {
      if (["dialog", "banner", "page", "frame", "phone", "dock", "row"].includes(parent)) continue;
      expect(warnings(`${parent}\n  card`)).toContainEqual(
        warning(2, "card must be at the top level or directly inside dialog, banner, page, frame, phone, dock or row"),
      );
    }
    expect(warnings("card\n  row")).toEqual([]);
  });

  it("warns about frame and card variants, a card label and an unknown icon", () => {
    expect(warnings("frame.teal Caption\n  card.large Label\n    text Body\n  icon pinn")).toEqual([
      warning(1, 'unknown variant ".teal": frame takes no variants'),
      warning(2, 'unknown variant ".large": card takes no variants'),
      warning(2, "card takes no label"),
      warning(4, 'unknown icon "pinn": expected a Tabler icon name'),
    ]);
  });

  it("keeps an unknown kind with its label and children", () => {
    const result = parseWireframe("dialog\n  box.big#c Hello\n    text Hi");
    expect(result.renderable).toBe(true);
    expect(result.nodes[0]?.children).toEqual([
      node(2, "box", { variants: ["big"], id: "c", label: "Hello", children: [node(3, "text", { label: "Hi" })] }),
    ]);
    expect(result.diagnostics).toEqual([
      warning(2, `unknown kind "box": expected ${KIND_LIST}`),
      warning(3, "text must be directly inside dialog, banner, page, frame, phone, dock, card or row"),
    ]);
  });

  it("warns when a line has no kind", () => {
    expect(warnings("dialog\n  .muted Hi\n  #x")).toEqual([
      warning(2, `missing kind: expected ${KIND_LIST}`),
      warning(3, `missing kind: expected ${KIND_LIST}`),
    ]);
    expect(parseWireframe("dialog\n  .muted Hi").nodes[0]?.children[0]).toEqual(
      node(2, "", { variants: ["muted"], label: "Hi" }),
    );
  });

  it("warns about unknown variants", () => {
    expect(warnings("banner.alert\n  text.muted.big Hi\n  row.end.start")).toEqual([
      warning(1, 'unknown variant ".alert" on banner: expected .neutral, .info, .warning, .danger or .success'),
      warning(2, 'unknown variant ".big" on text: expected .muted, .strong, .title, .small, .red, .amber, .green, .blue, .bg-red, .bg-amber, .bg-green or .bg-blue'),
      warning(3, 'unknown variant ".start" on row: expected .end, .between, .scroll, .stretch or .head'),
    ]);
    expect(warnings("dialog.wide\n  icon.big archive\n  row\n    button.ghost Go")).toEqual([
      warning(1, 'unknown variant ".wide": dialog takes no variants'),
      warning(2, 'unknown variant ".big" on icon: expected .filled, .red, .amber, .green or .blue'),
      warning(4, 'unknown variant ".ghost" on button: expected .primary, .danger, .link or .focus'),
    ]);
  });

  it.each(["red", "amber", "green", "blue"])("accepts %s on icons and text with other variants in either order", (hue) => {
    expect(warnings(`page\n  icon.filled.${hue} point\n  icon.${hue}.filled point\n  text.small.strong.${hue} State\n  text.${hue}.title.small State`)).toEqual([]);
  });

  it("warns about unknown hues and hues on other kinds", () => {
    expect(warnings("page\n  icon.purple point\n  text.purple State\n  row\n    chip.red Tag\n    button.green Save\n    input.blue Hint\n    select.amber Value\n    toggle\n      option.red Choice\n  table\n    row\n      cell.blue State\nbanner.red\nframe.green Caption")).toEqual([
      warning(2, 'unknown variant ".purple" on icon: expected .filled, .red, .amber, .green or .blue'),
      warning(3, 'unknown variant ".purple" on text: expected .muted, .strong, .title, .small, .red, .amber, .green, .blue, .bg-red, .bg-amber, .bg-green or .bg-blue'),
      warning(5, 'unknown variant ".red" on chip: expected .more'),
      warning(6, 'unknown variant ".green" on button: expected .primary, .danger, .link or .focus'),
      warning(7, 'unknown variant ".blue": input takes no variants'),
      warning(8, 'unknown variant ".amber": select takes no variants'),
      warning(10, 'unknown variant ".red" on option: expected .current'),
      warning(13, 'unknown variant ".blue" on cell: expected .end, .sortable, .ascending or .descending'),
      warning(14, 'unknown variant ".red" on banner: expected .neutral, .info, .warning, .danger or .success'),
      warning(15, 'unknown variant ".green": frame takes no variants'),
    ]);
  });

  it("warns once for competing colours, including repeats and muted text", () => {
    expect(warnings("page\n  icon.blue.filled.red.amber.green point\n  icon.red.red point\n  text.small.muted.green.red State\n  text.red.strong.muted State\n  text.muted.muted State")).toEqual([
      warning(2, "icon takes one of .red, .amber, .green or .blue: the first is used"),
      warning(3, "icon takes one of .red, .amber, .green or .blue: the first is used"),
      warning(4, "text takes one of .muted, .red, .amber, .green or .blue: the first is used"),
      warning(5, "text takes one of .muted, .red, .amber, .green or .blue: the first is used"),
      warning(6, "text takes one of .muted, .red, .amber, .green or .blue: the first is used"),
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

  it("warns about every unknown attribute", () => {
    expect(warnings("banner tone=warning\n  text a=1 b=2 Hi")).toEqual([
      warning(1, 'unknown attribute "tone": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
      warning(2, 'unknown attribute "a": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
      warning(2, 'unknown attribute "b": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
    ]);
  });

  it("accepts whole pixel widths on pages, combined with an id and no label", () => {
    for (const value of ["1", "256", "9999", "00256", '"256"']) {
      const result = parseWireframe(`page#sidebar width=${value}`);
      expect(result.diagnostics).toEqual([]);
      expect(result.nodes[0]).toEqual(node(1, "page", {
        id: "sidebar", attributes: [{ key: "width", value: value.replaceAll('"', "") }],
      }));
    }
    expect(warnings("page width=256 Sidebar")).toEqual([warning(1, "page takes no label")]);
  });

  it("warns about invalid widths with their line number and keeps the source value", () => {
    for (const value of ["240px", "50%", "0", "0000", "10000", "12.5", "-1", "+1", "1e2", "0xff", "１", "", "1 2"]) {
      expect(warnings(`\npage width="${value}"`)).toEqual([
        warning(2, `invalid width "${value}": expected a whole number of pixels from 1 to 9999, such as width=240`),
      ]);
      expect(parseWireframe(`page width="${value}"`).nodes[0]?.attributes).toEqual([{ key: "width", value }]);
    }
    expect(warnings("page width=")).toEqual([
      warning(1, 'invalid width "": expected a whole number of pixels from 1 to 9999, such as width=240'),
    ]);
  });

  it("warns only about width's placement on every other kind, whatever the value", () => {
    for (const kind of [...KINDS.keys(), "box"].filter((kind) => !["page", "card", "image"].includes(kind))) {
      for (const value of ["256", "240px", ""]) {
        const diagnostics = warnings(`\n${kind} width=${value}`);
        expect(diagnostics).toContainEqual(warning(2, 'attribute "width" is only allowed on page, card or image'));
        expect(diagnostics.filter((diagnostic) => /invalid width|unknown attribute/.test(diagnostic.message))).toEqual([]);
      }
    }
  });

  it("warns about repeated widths and retains them in source order", () => {
    const result = parseWireframe("page width=256 width=400 width=512");
    expect(result.diagnostics).toEqual([
      warning(1, 'repeated attribute "width": the first value is used'),
      warning(1, 'repeated attribute "width": the first value is used'),
    ]);
    expect(result.nodes[0]?.attributes).toEqual([
      { key: "width", value: "256" }, { key: "width", value: "400" }, { key: "width", value: "512" },
    ]);
    expect(warnings("page width=0 width=256")).toEqual([
      warning(1, 'invalid width "0": expected a whole number of pixels from 1 to 9999, such as width=240'),
      warning(1, 'repeated attribute "width": the first value is used'),
    ]);
    expect(warnings("dialog width=256 width=400")).toEqual([
      warning(1, 'attribute "width" is only allowed on page, card or image'),
      warning(1, 'repeated attribute "width": the first value is used'),
      warning(1, 'attribute "width" is only allowed on page, card or image'),
    ]);
  });

  it("accepts field labels with the existing attribute grammar, alone and in rows", () => {
    const source = 'page\n  input label="Work email" you@company.com\n  select label=Role Editor\n  row\n    input label=Name\n    select label="Team name" Engineering';
    const result = parseWireframe(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes[0]?.children[0]).toEqual(node(2, "input", {
      attributes: [{ key: "label", value: "Work email" }], label: "you@company.com",
    }));
    expect(result.nodes[0]?.children[1]).toEqual(node(3, "select", {
      attributes: [{ key: "label", value: "Role" }], label: "Editor",
    }));
  });

  it("warns about label= on every other kind, including unknown kinds", () => {
    for (const kind of KIND_LIST.replace(" or ", ", ").split(", ").filter((kind) => !["input", "select"].includes(kind)).concat("box")) {
      expect(warnings(`\n${kind} label=Name`)).toContainEqual(
        warning(2, 'attribute "label" is only allowed on input or select'),
      );
    }
  });

  it("warns about repeated labels, retaining both source values in order", () => {
    const source = 'page\n  input label=Email label="Work email" name@company.com\n  select label= label=Role Editor';
    expect(warnings(source)).toEqual([
      warning(2, 'repeated attribute "label": the first value is used'),
      warning(3, 'repeated attribute "label": the first value is used'),
    ]);
    expect(parseWireframe(source).nodes[0]?.children[0]?.attributes).toEqual([
      { key: "label", value: "Email" }, { key: "label", value: "Work email" },
    ]);
  });

  it("still warns about other attributes on a labelled field", () => {
    expect(warnings('page\n  input label=Email size=20 name@company.com')).toEqual([
      warning(2, 'unknown attribute "size": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
    ]);
  });

  it("warns about an icon name that is missing or not on the allowlist", () => {
    expect(warnings("banner\n  icon\n  icon pinn\n  icon Archive")).toEqual([
      warning(2, "icon needs a name: expected a Tabler icon name"),
      warning(3, 'unknown icon "pinn": expected a Tabler icon name'),
      warning(4, 'unknown icon "Archive": expected a Tabler icon name'),
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
      warning(1, "text must be directly inside dialog, banner, page, frame, phone, dock, card or row"),
      warning(2, "row must be directly inside dialog, banner, page, frame, phone, dock, card, row or table"),
      warning(3, "icon must be directly inside dialog, banner, page, frame, phone, dock, cell, button or option"),
    ]);
    expect(warnings("dialog\n  row\n    text Hi\n    row\n    icon archive")).toEqual([
      warning(5, "icon must be directly inside dialog, banner, page, frame, phone, dock, cell, button or option"),
    ]);
  });

  it("warns about a button outside a row or a cell", () => {
    expect(warnings("button Top\ndialog\n  button Inside\n  text Hi\n    button Under")).toEqual([
      warning(1, "button must be directly inside row, cell or frame"),
      warning(3, "button must be directly inside row, cell or frame"),
      warning(5, "button must be directly inside row, cell or frame"),
    ]);
  });

  it("warns about a page that is not at the top level, and a label on it", () => {
    expect(warnings("dialog\n  page\npage Title\n  text.title Title")).toEqual([
      warning(2, "page must be at the top level"),
      warning(3, "page takes no label"),
    ]);
  });

  it("warns about an input, select or toggle outside a root or a row", () => {
    expect(warnings("input Search\nselect Any\ntoggle")).toEqual([
      warning(1, "input must be directly inside dialog, banner, page, frame, phone, dock or row"),
      warning(2, "select must be directly inside dialog, banner, page, frame, phone, dock or row"),
      warning(3, "toggle must be directly inside dialog, banner, page, frame, phone, dock or row"),
    ]);
    expect(warnings("page\n  table\n    input Search\n    row\n      cell\n        select Any\n        toggle")).toEqual([
      warning(3, "input must be directly inside dialog, banner, page, frame, phone, dock or row"),
      warning(6, "select must be directly inside dialog, banner, page, frame, phone, dock or row"),
      warning(7, "toggle must be directly inside dialog, banner, page, frame, phone, dock or row"),
    ]);
    expect(warnings("page\n  input Search\n  select Any\n  toggle\n  row\n    input A\n    select B\n    toggle")).toEqual([]);
  });

  it("warns about an option outside a toggle or tabs, and a toggle's label", () => {
    expect(warnings("page\n  option Day\n  row\n    option Week\n  toggle Period\n    option.current Day")).toEqual([
      warning(2, "option must be directly inside toggle or tabs"),
      warning(4, "option must be directly inside toggle or tabs"),
      warning(5, "toggle takes no label"),
    ]);
  });

  it("warns about a table outside a root, and a label on a table", () => {
    expect(warnings("table\npage\n  row\n    table\n  table Documents")).toEqual([
      warning(1, "table must be directly inside dialog, banner, page, frame, phone or dock"),
      warning(4, "table must be directly inside dialog, banner, page, frame, phone or dock"),
      warning(5, "table takes no label"),
    ]);
  });

  it("warns about a cell anywhere but directly inside a table row", () => {
    expect(warnings("cell A\npage\n  cell B\n  row\n    cell C\n  table\n    cell D\n    row\n      cell\n        cell E")).toEqual([
      warning(1, "cell must be directly inside a table row"),
      warning(3, "cell must be directly inside a table row"),
      warning(5, "cell must be directly inside a table row"),
      warning(7, "cell must be directly inside a table row"),
      warning(10, "cell must be directly inside a table row"),
    ]);
  });

  it("accepts one sort variant per header cell, with end alignment and multiple sorted columns", () => {
    expect(warnings("page\n  table\n    row.head\n      cell.sortable Name\n      cell.end.ascending Count\n      cell.descending Date")).toEqual([]);
  });

  it.each(["sortable", "ascending", "descending"])("warns about cell.%s outside a table header row", (variant) => {
    expect(warnings(`page\n  table\n    row\n      cell.${variant} Body`)).toEqual([
      warning(4, `cell.${variant} must be directly inside a header row`),
    ]);
    expect(warnings(`page\n  row.head\n    cell.${variant} Loose`)).toEqual([
      warning(2, "row.head must be directly inside table"),
      warning(3, `cell.${variant} must be directly inside a header row`),
      warning(3, "cell must be directly inside a table row"),
    ]);
  });

  it("warns once about competing sort variants, including repeated ones", () => {
    expect(warnings("page\n  table\n    row.head\n      cell.end.descending.sortable.ascending Count\n      cell.sortable.sortable Name")).toEqual([
      warning(4, "cell takes one of .sortable, .ascending or .descending: the first is used"),
      warning(5, "cell takes one of .sortable, .ascending or .descending: the first is used"),
    ]);
    expect(warnings("page\n  table\n    row\n      cell.ascending.descending Count")).toEqual([
      warning(4, "cell.ascending must be directly inside a header row"),
      warning(4, "cell takes one of .sortable, .ascending or .descending: the first is used"),
    ]);
  });

  it("accepts text variants directly inside a non-table row", () => {
    expect(warnings("page\n  row.end\n    text.small.muted 1–10 of 24\n    text.strong Count\n    text.title Title\n    button Next")).toEqual([]);
  });

  it("accepts plain row groups with the same children as a non-table row", () => {
    for (const row of ["row", "row.end", "row.between", "row.scroll", "row.stretch"]) {
      expect(warnings(`page\n  ${row}\n    row\n      button.link\n        icon user-circle\n      text.strong Ana Lopez\n      text.small.muted 2 h ago\n      card\n        text Preview\n      image.round Avatar\n      input Hint\n      select Value\n      toggle\n        option Choice\n      chip Tag\n      row\n        button More\n    button.link ✓ Resolve`)).toEqual([]);
    }
  });

  it.each(["end", "between", "scroll", "stretch"])("warns about row.%s in a nested group", (variant) => {
    expect(warnings(`card\n  row.between\n    row.${variant}\n      text Name\n    button Resolve`)).toEqual([
      warning(3, `row.${variant} must be directly inside dialog, banner, page, frame, phone, dock or card`),
    ]);
  });

  it("keeps the header warning for a nested row and placement warnings outside rows", () => {
    expect(warnings("page\n  row\n    row.head")).toEqual([
      warning(3, "row.head must be directly inside table"),
    ]);
    expect(warnings("page\n  table\n    row\n      cell\n        row")).toEqual([
      warning(5, "row must be directly inside dialog, banner, page, frame, phone, dock, card, row or table"),
    ]);
  });

  it("warns about any kind but cell in a table row", () => {
    const source = [
      "page",
      "  table",
      "    row",
      "      cell A",
      "      button Go",
      "      chip web",
      "      text Hi",
      "      row",
      "      box",
    ].join("\n");
    expect(warnings(source)).toEqual([
      warning(5, "button in a table row: expected cell"),
      warning(6, "chip in a table row: expected cell"),
      warning(7, "text in a table row: expected cell"),
      warning(8, "row in a table row: expected cell"),
      warning(9, `unknown kind "box": expected ${KIND_LIST}`),
    ]);
  });

  it("warns about row.head outside a table and row.end inside one", () => {
    expect(warnings("page\n  row.head\n  table\n    row.end\n      cell A\n    row.head\n      cell B")).toEqual([
      warning(2, "row.head must be directly inside table"),
      warning(4, "row.end must be directly inside dialog, banner, page, frame, phone, dock or card"),
    ]);
  });

  it("warns about a chip outside a row or a cell", () => {
    expect(warnings("chip web\npage\n  chip spec\n  row\n    chip ok\n  table\n    row\n      cell\n        chip ok")).toEqual([
      warning(1, "chip must be directly inside row or cell"),
      warning(3, "chip must be directly inside row or cell"),
    ]);
  });

  it("warns about unknown variants on the new kinds", () => {
    const source = [
      "page.wide",
      "  input.large Search",
      "  select.open Any",
      "  toggle.small",
      "    option.selected Day",
      "  table.striped",
      "    row.head",
      "      cell.start A",
      "    row",
      "      cell",
      "        chip.danger web",
    ].join("\n");
    expect(warnings(source)).toEqual([
      warning(1, 'unknown variant ".wide" on page: expected .browser or .window'),
      warning(2, 'unknown variant ".large": input takes no variants'),
      warning(3, 'unknown variant ".open": select takes no variants'),
      warning(4, 'unknown variant ".small": toggle takes no variants'),
      warning(5, 'unknown variant ".selected" on option: expected .current'),
      warning(6, 'unknown variant ".striped": table takes no variants'),
      warning(8, 'unknown variant ".start" on cell: expected .end, .sortable, .ascending or .descending'),
      warning(11, 'unknown variant ".danger" on chip: expected .more'),
    ]);
  });

  it("keeps misplaced nodes where they were written", () => {
    expect(parseWireframe("dialog\n  button Inside").nodes).toEqual([
      node(1, "dialog", { children: [node(2, "button", { label: "Inside" })] }),
    ]);
  });

  it("cuts long source text short inside a message", () => {
    expect(warnings(`${"x".repeat(100)} label`)).toEqual([
      warning(1, `unknown kind "${"x".repeat(40)}…": expected ${KIND_LIST}`),
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
      warning(3, "row must be directly inside dialog, banner, page, frame, phone, dock, card, row or table"),
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
      warning(3, 'unknown attribute "a": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
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
      warning(2, 'unknown attribute "a": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
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
    "page", "table", "cell", "chip", "toggle", "option", "input", "select", "head", "\n  ", "\n    ",
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
