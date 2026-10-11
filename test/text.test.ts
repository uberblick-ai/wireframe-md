import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";

const source = (label: string): string => `page\n  text ${label}`;

describe("inline monospace on text labels", () => {
  it.each([
    ["rev `e9faf4df`", "rev e9faf4df", ["e9faf4df"]],
    ["`first` and `second`", "first and second", ["first", "second"]],
    ["`one` then `two` and `unmatched", "one then two and `unmatched", ["one", "two"]],
    ["No markers", "No markers", []],
    ["One `unmatched", "One `unmatched", []],
    ["Empty `` pair", "Empty `` pair", []],
    ["``double`` and ```triple```", "``double`` and ```triple```", []],
    ["``literal`` then `mono`", "``literal`` then mono", ["mono"]],
    ["`one``two`", "one``two", ["one``two"]],
    ["` `", " ", [" "]],
    ["*draft* [link](https://example.test) **bold**", "*draft* [link](https://example.test) **bold**", []],
  ])("draws %s with literal fallback and no diagnostics", (label, visible, spans) => {
    for (const quoted of [false, true]) {
      const result = parseWireframe(source(quoted ? JSON.stringify(label) : label));
      expect(result.diagnostics).toEqual([]);
      expect(result.nodes[0]!.children[0]!.label).toBe(label);
      const root = renderWireframe(result)!;
      expect(root.querySelector(".wf-text")!.textContent).toBe(visible);
      expect([...root.querySelectorAll(".wf-mono")].map((span) => span.textContent)).toEqual(spans);
      expect(summarizeWireframe(result)).toBe(`Wireframe: page “${visible}”`);
    }
  });

  it.each(["", ".muted", ".strong", ".title", ".small", ".red", ".amber", ".green", ".blue", ".small.muted", ".small.strong.title"])(
    "keeps spans and variants on text%s in every permitted placement",
    (variants) => {
      for (const parent of ["page\n", "card\n", "page\n  card\n", "page\n  row\n", "page\n  row.end\n", "dialog Title\n", "banner\n", "frame Caption\n"]) {
        const indent = parent.split("\n").at(-2)!.startsWith("  ") ? "    " : "  ";
        const result = parseWireframe(`${parent}${indent}text${variants} rev \`e9faf4df\``);
        expect(result.diagnostics).toEqual([]);
        const text = renderWireframe(result)!.querySelector(".wf-text")!;
        expect(text.textContent).toBe("rev e9faf4df");
        expect(text.querySelector(".wf-mono")!.textContent).toBe("e9faf4df");
        for (const variant of variants.split(".").filter(Boolean)) expect(text.classList.contains(`wf-${variant}`)).toBe(true);
      }
    },
  );

  it("treats mono contents as text, including quotes, markup, URLs and backslashes", () => {
    const label = 'Run `<img src=x onerror="alert(1)">` and `javascript:alert(2)` or `C:\\work`.';
    const root = renderWireframe(parseWireframe(source(JSON.stringify(label))))!;
    expect(root.textContent).toBe('Run <img src=x onerror="alert(1)"> and javascript:alert(2) or C:\\work.');
    expect(root.querySelectorAll("img, script, a, [style], [onclick], [onerror], [tabindex]")).toHaveLength(0);
    for (const span of root.querySelectorAll(".wf-mono")) {
      expect(span.localName).toBe("span");
      expect(span.children).toHaveLength(0);
      expect(span.getAttributeNames()).toEqual(["class"]);
    }
  });

  it("keeps backticks on every non-text kind, including fallback labels and field names", () => {
    const result = parseWireframe([
      "dialog `title`",
      "  input label=\"`field`\" `placeholder`",
      "  select `value`",
      "  toggle",
      "    option `option`",
      "  row",
      "    button `button`",
      "    button.link `link`",
      "    chip `chip`",
      "  table",
      "    row.head",
      "      cell.sortable `cell`",
      "frame `caption`",
      "  button.link `action`",
      "page `invalid label`",
      "unknown `unknown label`",
      "icon `unknown icon`",
    ].join("\n"));
    const root = renderWireframe(result)!;
    expect(root.querySelectorAll(".wf-mono")).toHaveLength(0);
    for (const label of ["title", "field", "placeholder", "value", "option", "button", "link", "chip", "cell", "caption", "action", "invalid label", "unknown label", "unknown icon"]) {
      expect(root.textContent).toContain(`\`${label}\``);
    }
  });

  it("preserves the DOM structure of labels without spans", () => {
    for (const label of ["No markers", "One `unmatched", "Empty `` pair", "``double``"]) {
      const text = renderWireframe(parseWireframe(source(label)))!.querySelector(".wf-text")!;
      expect(text.children).toHaveLength(0);
      expect(text.childNodes).toHaveLength(1);
      expect(text.firstChild!.nodeType).toBe(Node.TEXT_NODE);
      expect(text.textContent).toBe(label);
    }
  });
});
