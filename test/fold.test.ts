import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

describe("fold", () => {
  it.each(["dialog", "banner", "page", "page.browser", "page.window", "frame", "phone", "card", "page\n  card", "phone\n  dock"])("accepts labelled and bare folds in %s", (parent) => {
    const indent = parent.includes("\n") ? "    " : "  ";
    for (const label of ["", "4 unchanged blocks · Steps, Checklist"]) {
      const result = parseWireframe(`${parent}\n${indent}fold#unchanged ${label}`);
      expect(result.diagnostics).toEqual([]);
      const root = renderWireframe(result)!;
      const fold = root.querySelector(".wf-fold")!;
      expect(fold.textContent).toBe(label || "fold");
      expect(fold.className).toBe("wf-fold");
      expect(fold.getAttribute("data-line")).toBe(String(parent.split("\n").length + 1));
      expect(fold.matches("[id], [tabindex], [role], [aria-expanded], [style]")).toBe(false);
      expect(fold.querySelector("[id], [tabindex], [role], [aria-label], [aria-expanded], a, button, input, script")).toBeNull();
      expect(fold.querySelector(".wf-fold-name")?.textContent).toBe(label === "" ? "fold" : undefined);
    }
  });

  it("keeps the label as literal, escaped text", () => {
    const label = '<img src=x onerror="alert(1)"> & `literal`';
    const result = parseWireframe(`card\n  fold ${JSON.stringify(label)}`);
    expect(result.diagnostics).toEqual([]);
    const fold = renderWireframe(result)!.querySelector(".wf-fold")!;
    expect(fold.textContent).toBe(label);
    expect(fold.children).toHaveLength(0);
    expect(fold.querySelector("img, script, [onerror]")).toBeNull();
  });

  it("never uses a fold label to name its root", () => {
    for (const source of ["dialog", "dialog Save changes", "banner", "page", "page.browser", "frame", "frame History", "phone", "card", "card\n  text.title Before"]) {
      for (const tail of ["", "\n  text Visible section"]) {
        expect(summarizeWireframe(parseWireframe(`${source}\n  fold 4 unchanged blocks${tail}`)))
          .toBe(summarizeWireframe(parseWireframe(`${source}${tail}`)));
      }
    }
  });

  it.each([
    ["top level", "\nfold Collapsed", 2],
    ...[...KINDS.keys(), "unknown"].filter((kind) => !["dialog", "banner", "page", "frame", "phone", "dock", "card"].includes(kind))
      .map((kind) => [kind, `${kind}\n  fold Collapsed`, 2]),
    ["table row", "page\n  table\n    row\n      fold Collapsed", 4],
    ["cell", "page\n  table\n    row\n      cell\n        fold Collapsed", 5],
  ])("warns about placement in %s and still draws", (place, source, line) => {
    const result = parseWireframe(source as string);
    expect(result.renderable).toBe(true);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([{
      line, severity: "warning", message: place === "table row"
        ? "fold in a table row: expected cell"
        : "fold must be directly inside dialog, banner, page, frame, phone, dock or card",
    }]);
    expect(renderWireframe(result)!.querySelector(`.wf-fold[data-line="${line}"]`)!.textContent).toBe("Collapsed");
  });

  it("warns about variants, attributes and children with the existing diagnostics and fallback drawing", () => {
    const result = parseWireframe('card\n  fold.strong#collapsed label=Hidden width=200 padding=8 tone=red <hr>\n    text Child');
    expect(result.diagnostics).toEqual([
      { line: 2, severity: "warning", message: 'unknown variant ".strong": fold takes no variants' },
      { line: 2, severity: "warning", message: 'attribute "label" is only allowed on input or select' },
      { line: 2, severity: "warning", message: 'attribute "width" is only allowed on page, card or image' },
      { line: 2, severity: "warning", message: 'attribute "padding" is only allowed on card' },
      { line: 2, severity: "warning", message: 'unknown attribute "tone": expected label on input or select, width on page, card or image, padding on card, or at on mark (quote a label that starts with word=)' },
      { line: 3, severity: "warning", message: "text must be directly inside dialog, banner, page, frame, phone, dock, card or row" },
    ]);
    const fold = renderWireframe(result)!.querySelector(".wf-fold")!;
    expect(fold.className).toBe("wf-fold");
    expect(fold.getAttribute("style")).toBeNull();
    expect(fold.textContent).toBe("<hr>Child");
    expect(fold.querySelector("hr")).toBeNull();
    expect(fold.querySelector('[data-line="3"]')!.textContent).toBe("Child");
  });
});
