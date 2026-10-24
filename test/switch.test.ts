import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const example = (name: string) => readFileSync(join(import.meta.dirname, `../examples/forms/4-switches/${name}.wireframe`), "utf8");
const warning = (line: number, message: string) => ({ line, severity: "warning", message });

describe("switch", () => {
  it.each(["settings", "bare", "long-caption"])("parses and draws the %s playground example without diagnostics", (name) => {
    const parsed = parseWireframe(example(name));
    expect(parsed.diagnostics).toEqual([]);
    expect(renderWireframe(parsed)!.querySelector(".wf-switch-track > .wf-switch-thumb")).not.toBeNull();
  });

  it.each(["dialog", "banner", "page", "frame", "phone", "card", "phone\n  dock", "card\n  row", "page\n  row\n    row"])("accepts captioned and bare switches inside %s", (parent) => {
    const indent = "  ".repeat(parent.split("\n").length);
    const parsed = parseWireframe(`${parent}\n${indent}switch.on Caption\n${indent}switch`);
    expect(parsed.diagnostics).toEqual([]);
    const switches = renderWireframe(parsed)!.querySelectorAll(".wf-switch[data-line]");
    expect([...switches].map((node) => node.classList.contains("wf-on"))).toEqual([true, false]);
    expect([...switches].map((node) => node.textContent)).toEqual(["Caption, on", "switch, off"]);
  });

  it.each([
    ["top level", "\nswitch", 2],
    ...[...KINDS.keys(), "unknown"].filter((kind) => !["dialog", "banner", "page", "frame", "phone", "dock", "card", "row"].includes(kind))
      .map((kind) => [kind, `${kind}\n  switch`, 2]),
  ])("warns about placement in %s and still draws", (_kind, source, line) => {
    const parsed = parseWireframe(source as string);
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.line === line)).toEqual([
      warning(line as number, "switch must be directly inside dialog, banner, page, frame, phone, dock, card or row"),
    ]);
    expect(renderWireframe(parsed)!.querySelector(`.wf-switch[data-line="${line}"]`)).not.toBeNull();
  });

  it("keeps the existing table-row warning", () => {
    expect(parseWireframe("page\n  table\n    row\n      switch.on").diagnostics).toEqual([
      warning(4, "switch in a table row: expected cell"),
    ]);
  });

  it.each(["off", "disabled"])("warns about .%s and draws the default off state", (variant) => {
    const parsed = parseWireframe(`card\n  switch.${variant} Caption`);
    expect(parsed.diagnostics).toEqual([warning(2, `unknown variant ".${variant}" on switch: expected .on`)]);
    const node = renderWireframe(parsed)!.querySelector(".wf-switch")!;
    expect(node.className).toBe("wf-switch");
    expect(node.textContent).toBe("Caption, off");
  });

  it("warns about children and attributes, retaining their content without markup", () => {
    const parsed = parseWireframe('card\n  switch.on#setting label=Hidden width=400 padding=8 format=PDF "<script> `literal`"\n    text Child');
    expect(parsed.diagnostics).toEqual([
      warning(2, 'attribute "label" is only allowed on input or select'),
      warning(2, 'attribute "width" is only allowed on page, card or image'),
      warning(2, 'attribute "padding" is only allowed on card'),
      warning(2, 'unknown attribute "format": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
      warning(3, "text must be directly inside dialog, banner, page, frame, phone, dock, card or row"),
    ]);
    const node = renderWireframe(parsed)!.querySelector(".wf-switch")!;
    expect(node.querySelector(".wf-switch-caption")!.textContent).toBe("<script> `literal`, on");
    expect(node.querySelector('.wf-text[data-line="3"]')!.textContent).toBe("Child");
    expect(node.querySelector("script, .wf-mono, [style], [id]")).toBeNull();
  });

  it("exposes one plain caption and state without an interactive role or focus target", () => {
    const parsed = parseWireframe(`${example("settings")}\n${example("bare")}\ncard\n  switch`);
    const root = renderWireframe(parsed)!;
    const switches = [...root.querySelectorAll(".wf-switch")];
    expect(switches.map((node) => node.textContent)).toEqual([
      "Collapse unchanged, on", "Show whitespace changes, off", "switch, on", "switch, off",
    ]);
    for (const node of switches) {
      expect(node.querySelector(".wf-switch-track")!.getAttribute("aria-hidden")).toBe("true");
      expect(node.querySelector(".wf-switch-state")!.hasAttribute("aria-hidden")).toBe(false);
      expect(node.hasAttribute("role") || node.hasAttribute("tabindex") || node.hasAttribute("aria-label")).toBe(false);
      expect(node.querySelector("[role], [tabindex], input, button, a, select")).toBeNull();
    }
  });

  it("does not use switch captions to name roots", () => {
    expect(summarizeWireframe(parseWireframe(example("settings")))).toBe("Wireframe: page “Review settings”");
    expect(summarizeWireframe(parseWireframe(example("bare")))).toBe("Wireframe: card");
    for (const kind of ["dialog", "banner", "page", "frame", "phone", "card"]) {
      expect(summarizeWireframe(parseWireframe(`${kind}\n  switch.on Caption`))).toBe(`Wireframe: ${kind}`);
    }
    expect(parseWireframe("unknown").diagnostics[0]!.message).toContain("select, switch, toggle");
  });
});
