import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";

const conflict = "row takes one of .stretch or .scroll: the first is used";
const horizontalConflict = "row takes one of .end, .between or .scroll: the first is used";

describe("row.stretch", () => {
  it.each(["stretch", "stretch.end", "end.stretch", "stretch.between", "between.stretch"])("accepts row.%s in every layout container without changing summaries", (variants) => {
    for (const prefix of ["dialog Title", "banner", "page", "frame", "phone", "phone\n  dock", "card"]) {
      const indent = prefix.includes("dock") ? "    " : "  ";
      const source = `${prefix}\n${indent}row.${variants}\n${indent}  card width=120\n${indent}    text Short\n${indent}  card\n${indent}    text Long\n${indent}    text Extra`;
      const parsed = parseWireframe(source);
      expect(parsed.diagnostics).toEqual([]);
      expect(renderWireframe(parsed)!.querySelector(".wf-row.wf-stretch")).not.toBeNull();
      expect(summarizeWireframe(parsed)).toBe(summarizeWireframe(parseWireframe(source.replace(`row.${variants}`, "row"))));
    }
  });

  it.each([
    ["scroll.stretch", "scroll", [conflict]],
    ["stretch.scroll", "stretch", [conflict]],
    ["end.scroll.stretch", "end", [horizontalConflict, conflict]],
    ["end.stretch.scroll", "end stretch", [horizontalConflict, conflict]],
    ["scroll.end.stretch", "scroll", [horizontalConflict, conflict]],
    ["scroll.stretch.end", "scroll", [horizontalConflict, conflict]],
    ["stretch.end.scroll", "stretch end", [horizontalConflict, conflict]],
    ["stretch.scroll.end", "stretch", [horizontalConflict, conflict]],
    ["between.scroll.stretch", "between", [horizontalConflict, conflict]],
    ["stretch.scroll.between", "stretch", [horizontalConflict, conflict]],
  ] as const)("resolves row.%s against the variants' original order", (variants, classes, messages) => {
    const parsed = parseWireframe(`page\n  row.${variants}\n    card\n      text Content`);
    expect(parsed.diagnostics).toEqual(messages.map((message) => ({ line: 2, severity: "warning", message })));
    expect(renderWireframe(parsed)!.querySelector(".wf-row")!.className).toBe(`wf-row ${classes.split(" ").map((name) => `wf-${name}`).join(" ")}`);
  });

  it("warns and ignores stretch on a table row", () => {
    const source = "page\n  table\n    row.stretch\n      cell Content";
    const parsed = parseWireframe(source);
    expect(parsed.diagnostics).toEqual([{
      line: 3, severity: "warning",
      message: "row.stretch must be directly inside dialog, banner, page, frame, phone, dock or card",
    }]);
    expect(renderWireframe(parsed)!.outerHTML).toBe(renderWireframe(parseWireframe(source.replace("row.stretch", "row")))!.outerHTML);
  });
});
