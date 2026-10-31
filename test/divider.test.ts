import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

describe("divider", () => {
  it.each(["dialog", "page", "frame", "phone"])("accepts a divider with an id directly inside %s", (kind) => {
    const parsed = parseWireframe(`${kind}\n  divider#section-break`);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]!.children[0]).toMatchObject({
      kind: "divider", id: "section-break", label: "", variants: [], attributes: [], children: [], line: 2,
    });
    const root = renderWireframe(parsed)!;
    const divider = root.querySelector(".wf-divider")!;
    expect(divider.getAttribute("role")).toBe("separator");
    expect(divider.getAttribute("data-line")).toBe("2");
    expect(divider.childNodes).toHaveLength(0);
    expect(root.querySelector("[id], [tabindex], a, button, input, script")).toBeNull();
    expect(summarizeWireframe(parsed)).toBe(`Wireframe: ${kind}`);
  });

  it("adds nothing to the summary of a titled root", () => {
    for (const source of ["page\n  text Dashboard", "dialog Save changes", "frame Workspace"]) {
      expect(summarizeWireframe(parseWireframe(`${source}\n  divider`)))
        .toBe(summarizeWireframe(parseWireframe(source)));
    }
  });

  it.each([
    ["top level", "\ndivider", 2],
    ...[...KINDS.keys(), "unknown"].filter((kind) => !["dialog", "page", "frame", "phone", "dock"].includes(kind))
      .map((kind) => [kind, `${kind}\n  divider`, 2]),
    ["table row", "page\n  table\n    row\n      divider", 4],
    ["cell", "page\n  table\n    row\n      cell\n        divider", 5],
  ])("warns about placement in %s and retains the divider", (_place, source, line) => {
    const parsed = parseWireframe(source as string);
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([{
      line, severity: "warning", message: "divider must be directly inside dialog, page, frame, phone or dock",
    }]);
    expect(renderWireframe(parsed)!.querySelector(`.wf-divider[data-line="${line}"]`)).not.toBeNull();
  });

  it("warns about a variant, label, attributes and child with the existing diagnostics", () => {
    const parsed = parseWireframe('page\n  divider.dashed#break label=Hidden width=200 tone=red <hr>\n    text Child');
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics).toEqual([
      { line: 2, severity: "warning", message: 'unknown variant ".dashed": divider takes no variants' },
      { line: 2, severity: "warning", message: 'attribute "label" is only allowed on input or select' },
      { line: 2, severity: "warning", message: 'attribute "width" is only allowed on page, card or image' },
      { line: 2, severity: "warning", message: 'unknown attribute "tone": expected label on input or select, boxes on input, width on page, card or image, padding on card, or at on mark (quote a label that starts with word=)' },
      { line: 2, severity: "warning", message: "divider takes no label" },
      { line: 3, severity: "warning", message: "text must be directly inside dialog, banner, page, frame, phone, dock, card, row or item" },
    ]);
    const divider = renderWireframe(parsed)!.querySelector(".wf-divider")!;
    expect(divider.className).toBe("wf-divider");
    expect(divider.getAttribute("style")).toBeNull();
    expect(divider.textContent).toBe("<hr>Child");
    expect(divider.querySelector("hr")).toBeNull();
    expect(divider.querySelector('[data-line="3"]')!.textContent).toBe("Child");
  });

  it("lists divider among the expected kinds", () => {
    expect(parseWireframe("unknown").diagnostics[0]!.message).toContain("row, divider, ruler, mark, button");
  });
});
