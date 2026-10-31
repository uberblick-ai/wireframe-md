import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const warning = (line: number, message: string) => ({ line, severity: "warning", message });
const visibleBoxes = (root: Element) => [...root.querySelectorAll('.wf-code[data-line] > .wf-code-box, .wf-field[data-line] > .wf-code > .wf-code-box')];

describe("input boxes", () => {
  it.each([4, 5, 6, 7, 8])("draws %i empty single-character boxes", (count) => {
    const parsed = parseWireframe(`page\n  input boxes=${count}`);
    expect(parsed.diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    expect(visibleBoxes(root).map((box) => box.textContent)).toEqual(Array(count).fill(""));
    expect(root.querySelector(".wf-code-name")!.textContent).toBe(`${count}-character code`);
  });

  it("parses and draws the Check your email example", () => {
    const source = readFileSync(join(import.meta.dirname, "../examples/forms/2-simple-forms/check-your-email.wireframe"), "utf8");
    const parsed = parseWireframe(source);
    expect(parsed.diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    expect(root.querySelector(".wf-field-label")!.textContent).toBe("Code");
    expect(visibleBoxes(root).map((box) => box.textContent)).toEqual(["4", "8", "", "", "", ""]);
    expect(root.querySelector(".wf-code-name")!.textContent).toBe("6-character code, 4 8");
  });

  it.each(["dialog", "banner", "page", "frame", "phone", "phone\n  dock", "page\n  row", "card\n  row\n    row"])("keeps input placement inside %s", (parent) => {
    const indent = "  ".repeat(parent.split("\n").length);
    const parsed = parseWireframe(`${parent}\n${indent}input label=Code boxes=4 4•`);
    expect(parsed.diagnostics).toEqual([]);
    expect(visibleBoxes(renderWireframe(parsed)!).map((box) => box.textContent)).toEqual(["4", "•", "", ""]);
  });

  it.each([
    ["input boxes=6 48", 1, "input must be directly inside dialog, banner, page, frame, phone, dock or row"],
    ["card\n  input boxes=6 48", 2, "input must be directly inside dialog, banner, page, frame, phone, dock or row"],
    ["page\n  table\n    row\n      input boxes=6 48", 4, "input in a table row: expected cell"],
    ["page\n  table\n    row\n      cell\n        input boxes=6 48", 5, "input must be directly inside dialog, banner, page, frame, phone, dock or row"],
  ] as const)("warns and still draws misplaced code fields: %s", (source, line, message) => {
    const parsed = parseWireframe(source);
    expect(parsed.diagnostics).toEqual([warning(line, message)]);
    expect(visibleBoxes(renderWireframe(parsed)!)).toHaveLength(6);
  });

  it.each(["", "3", "12", "six", "6.0", "6px", "-6", "4/4"])("warns about invalid boxes=%s and draws an ordinary placeholder", (value) => {
    const parsed = parseWireframe(`page\n  input label=Code boxes=${value} 48`);
    expect(parsed.diagnostics).toEqual([warning(2, `invalid boxes "${value}": expected a whole number from 4 to 8, such as boxes=6`)]);
    expect(parsed.renderable).toBe(true);
    const root = renderWireframe(parsed)!;
    expect(root.querySelector(".wf-code")).toBeNull();
    expect(root.querySelector(".wf-input")!.textContent).toBe("48");
    expect(root.querySelector(".wf-field-label")!.textContent).toBe("Code");
  });

  it("warns about excess characters, retaining source while drawing and announcing only the first boxes", () => {
    const parsed = parseWireframe("page\n  input boxes=6 1234567");
    expect(parsed.diagnostics).toEqual([warning(2, "too many characters for boxes=6: the first 6 are drawn")]);
    expect(parsed.nodes[0]!.children[0]!.label).toBe("1234567");
    const root = renderWireframe(parsed)!;
    expect(visibleBoxes(root).map((box) => box.textContent)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(root.querySelector(".wf-code-name")!.textContent).toBe("6-character code, 1 2 3 4 5 6");
  });

  it("counts Unicode code points without splitting supplementary characters", () => {
    const parsed = parseWireframe("page\n  input boxes=4 𝟜•89");
    expect(parsed.diagnostics).toEqual([]);
    expect(visibleBoxes(renderWireframe(parsed)!).map((box) => box.textContent)).toEqual(["𝟜", "•", "8", "9"]);
  });

  it.each([...KINDS.keys(), "unknown"].filter((kind) => kind !== "input"))("warns about boxes on %s without changing its drawing", (kind) => {
    const parsed = parseWireframe(`${kind} boxes=6 Label`);
    expect(parsed.diagnostics).toContainEqual(warning(1, 'attribute "boxes" is only allowed on input'));
    const root = renderWireframe(parsed)!;
    expect(root.outerHTML).toBe(renderWireframe(parseWireframe(`${kind} Label`))!.outerHTML);
  });

  it.each(["4", "3"])("uses the first repeated boxes=%s value even when invalid", (first) => {
    const parsed = parseWireframe(`page\n  input boxes=${first} boxes=8 48`);
    expect(parsed.diagnostics).toEqual([
      ...(first === "3" ? [warning(2, 'invalid boxes "3": expected a whole number from 4 to 8, such as boxes=6')] : []),
      warning(2, 'repeated attribute "boxes": the first value is used'),
    ]);
    expect(parsed.nodes[0]!.children[0]!.attributes).toEqual([{ key: "boxes", value: first }, { key: "boxes", value: "8" }]);
    expect(visibleBoxes(renderWireframe(parsed)!)).toHaveLength(first === "3" ? 0 : 4);
  });

  it("includes boxes in unknown-attribute guidance", () => {
    expect(parseWireframe("page\n  input size=6").diagnostics).toEqual([
      warning(2, 'unknown attribute "size": expected label on input or select, boxes on input, width on page, card or image, padding on card, or at on mark (quote a label that starts with word=)'),
    ]);
  });

  it("reads code fields once as static text and escapes source characters", () => {
    const root = renderWireframe(parseWireframe('page\n  input label=Code boxes=6 "<>&\\"•"\n    text Child'))!;
    const field = root.querySelector('.wf-field[data-line="2"]')!;
    expect(field.querySelector(".wf-code-name")!.textContent).toBe('6-character code, < > & " •');
    expect(visibleBoxes(root).every((box) => box.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(field.querySelector(".wf-code-name")!.hasAttribute("aria-hidden")).toBe(false);
    expect(field.querySelector(".wf-text")!.textContent).toBe("Child");
    expect(field.querySelector("[role], [tabindex], [aria-label], input, button, a, select, script")).toBeNull();
    expect(field.hasAttribute("role") || field.hasAttribute("tabindex")).toBe(false);
    expect(field.querySelector(".wf-code")!.children).toHaveLength(8);
  });

  it("keeps code labels and field names out of root summaries", () => {
    for (const kind of ["dialog", "banner", "page", "frame", "phone"]) {
      expect(summarizeWireframe(parseWireframe(`${kind}\n  input label=Code boxes=6 48`))).toBe(`Wireframe: ${kind}`);
    }
  });
});
