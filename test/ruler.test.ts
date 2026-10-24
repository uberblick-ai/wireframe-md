import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const warning = (line: number, message: string) => ({ line, severity: "warning", message });
const invalid = (value: string) => `invalid at "${value}": expected a whole number from 0 to 100, such as at=22`;

describe("overview rulers", () => {
  it.each(["row", "row.stretch", "row.end", "row.between", "row.scroll", "row\n    row"])("accepts a ruler in %s", (row) => {
    const indent = row.includes("\n") ? "      " : "    ";
    const result = parseWireframe(`page\n  ${row}\n${indent}card\n${indent}  text Before\n${indent}ruler#changes\n${indent}  mark.red at=0\n${indent}  mark at=22\n${indent}  mark.green at=100`);
    expect(result.diagnostics).toEqual([]);
    const root = renderWireframe(result)!;
    const ruler = root.querySelector(".wf-ruler")!;
    expect(ruler.className).toBe("wf-ruler");
    expect(ruler.getAttribute("aria-hidden")).toBe("true");
    expect([...ruler.children].map((mark) => [mark.className, mark.getAttribute("aria-hidden"), (mark as HTMLElement).style.getPropertyValue("--_wf-at")]))
      .toEqual([["wf-mark wf-red", "true", "0%"], ["wf-mark", "true", "22%"], ["wf-mark wf-green", "true", "100%"]]);
    expect(root.querySelector("[tabindex], [role], [id], a, button, input, script")).toBeNull();
    expect(summarizeWireframe(result)).toBe("Wireframe: page");
  });

  it("draws an empty track without a warning", () => {
    const result = parseWireframe("page\n  row\n    ruler");
    expect(result.diagnostics).toEqual([]);
    expect(renderWireframe(result)!.querySelector(".wf-ruler")!.childNodes).toHaveLength(0);
  });

  it.each(["0", "22", "100", "000", "00100"])("accepts digit position %s", (at) => {
    const result = parseWireframe(`page\n  row\n    ruler\n      mark at=${at}`);
    expect(result.diagnostics).toEqual([]);
    expect(renderWireframe(result)!.querySelector<HTMLElement>(".wf-mark")!.style.getPropertyValue("--_wf-at")).toBe(`${Number(at)}%`);
  });

  it.each([undefined, "", "101", "-1", "+22", "22%", "2.5", "1e2", "0x10", "NaN", "Infinity", "22px", "١٢", '"22 33"', '"22; color:red"'])("drops a mark with invalid or missing at=%s", (at) => {
    const result = parseWireframe(`page\n  row\n    ruler\n      mark${at === undefined ? "" : ` at=${at}`}`);
    expect(result.diagnostics).toEqual([warning(4, invalid(at?.replaceAll('"', "") ?? ""))]);
    expect(result.renderable).toBe(true);
    const root = renderWireframe(result)!;
    expect(root.querySelector(".wf-ruler")).not.toBeNull();
    expect(root.querySelector(".wf-mark, [style]")).toBeNull();
  });

  it("uses only the first repeated at value, even if invalid", () => {
    for (const [first, second] of [["22", "78"], ["22", "bad"], ["bad", "22"], ["", "22"]]) {
      const result = parseWireframe(`page\n  row\n    ruler\n      mark at=${first} at=${second}`);
      expect(result.diagnostics).toEqual([
        warning(4, 'repeated attribute "at": the first value is used'),
        ...(first === "bad" || first === "" ? [warning(4, invalid(first))] : []),
      ]);
      expect(renderWireframe(result)!.querySelector<HTMLElement>(".wf-mark")?.style.getPropertyValue("--_wf-at"))
        .toBe(first === "22" ? "22%" : undefined);
    }
  });

  it.each(["red.green", "green.red"])("uses the first colour in mark.%s", (variants) => {
    const result = parseWireframe(`page\n  row\n    ruler\n      mark.${variants} at=50`);
    expect(result.diagnostics).toEqual([warning(4, "mark takes one of .red or .green: the first is used")]);
    expect(renderWireframe(result)!.querySelector(".wf-mark")!.className).toBe(`wf-mark wf-${variants.split(".")[0]}`);
  });

  it.each([
    ["ruler", 1], ["page\n  ruler", 2], ["card\n  ruler", 2],
    ["page\n  table\n    row\n      ruler", 4], ["page\n  table\n    row\n      cell\n        ruler", 5],
  ] as const)("retains a misplaced ruler in %s", (source, line) => {
    const result = parseWireframe(source);
    expect(result.diagnostics).toEqual([warning(line, "ruler must be directly inside a non-table row")]);
    expect(renderWireframe(result)!.querySelector(`.wf-ruler[data-line="${line}"]`)).not.toBeNull();
  });

  it("retains a ruler before the final row child, including the first of two rulers", () => {
    for (const last of ["text Later", "ruler"]) {
      const result = parseWireframe(`page\n  row\n    ruler\n    ${last}`);
      expect(result.diagnostics).toEqual([warning(3, "ruler must be its row's last child")]);
      const row = renderWireframe(result)!.querySelector(".wf-row")!;
      expect(row.firstElementChild!.className).toBe("wf-ruler");
      expect(row.children).toHaveLength(2);
    }
  });

  it.each(["", ...[...KINDS.keys(), "unknown"].filter((kind) => kind !== "ruler").map((kind) => `${kind}\n  `)])("retains a mark outside a ruler under %s", (prefix) => {
    const result = parseWireframe(`${prefix}mark at=22`);
    const line = prefix === "" ? 1 : 2;
    expect(result.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([warning(line, "mark must be directly inside ruler")]);
    expect(renderWireframe(result)!.querySelector(`.wf-mark[data-line="${line}"]`)).not.toBeNull();
  });

  it("does not suggest a cell for a mark in a table row", () => {
    expect(parseWireframe("page\n  table\n    row\n      mark at=50").diagnostics)
      .toEqual([warning(4, "mark must be directly inside ruler")]);
  });

  it("warns about at on every other kind without styling it", () => {
    for (const kind of [...KINDS.keys(), "unknown"].filter((kind) => kind !== "mark")) {
      for (const value of ["22", "bad", ""]) {
        const result = parseWireframe(`${kind} at=${value}`);
        expect(result.diagnostics).toContainEqual(warning(1, 'attribute "at" is only allowed on mark'));
        expect(renderWireframe(result)!.querySelector('[style*="--_wf-at"]')).toBeNull();
      }
    }
  });

  it.each(["ruler", "mark"])("gives the usual diagnostics for unsupported parts of %s", (kind) => {
    const result = parseWireframe(`page\n  row\n    ruler\n      ${kind}.x${kind === "mark" ? " at=50" : ""} label=Hidden width=20 padding=8 other=9 <hr>\n        text Child`);
    expect(result.diagnostics).toEqual([
      warning(4, kind === "ruler" ? 'unknown variant ".x": ruler takes no variants' : 'unknown variant ".x" on mark: expected .red or .green'),
      warning(4, 'attribute "label" is only allowed on input or select'),
      warning(4, 'attribute "width" is only allowed on page, card or image'),
      warning(4, 'attribute "padding" is only allowed on card'),
      warning(4, 'unknown attribute "other": expected label on input or select, width on page, card or image, padding on card, or at on mark (quote a label that starts with word=)'),
      warning(4, `${kind} takes no label`),
      ...(kind === "ruler" ? [warning(4, "ruler must be directly inside a non-table row")] : []),
      warning(5, "text must be directly inside dialog, banner, page, frame, phone, dock, card, row or item"),
    ]);
    const element = renderWireframe(result)!.querySelector(`.wf-${kind}[data-line="4"]`)!;
    expect(element.textContent).toBe("<hr>Child");
    expect(element.querySelector("hr")).toBeNull();
  });

  it("preserves misplaced children when an invalid mark has no drawing", () => {
    const root = renderWireframe(parseWireframe("page\n  row\n    mark\n      text Child\n    card width=1/3\n      text First\n    card\n      text Rest"))!;
    expect(root).not.toBeNull();
    expect(root.querySelector(".wf-mark")).toBeNull();
    expect(root.querySelector('[data-line="4"]')!.textContent).toBe("Child");
    expect(root.querySelectorAll(".wf-row-size .wf-card-track > .wf-card")).toHaveLength(2);
  });

  it("never adds rulers, marks or their unsupported labels to the accessible summary", () => {
    for (const source of ["page", "page\n  text History", "card\n  text.title Before", "dialog Compare"]) {
      expect(summarizeWireframe(parseWireframe(`${source}\n  row\n    ruler Label\n      mark at=22 Label\nruler Label\nmark at=50 Label`)))
        .toBe(summarizeWireframe(parseWireframe(source)));
    }
    expect(summarizeWireframe(parseWireframe("ruler\n  mark at=0"))).toBe("Empty wireframe");
  });
});
