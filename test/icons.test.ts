import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { generateIcons, validatePaths } from "../scripts/generate-icons.js";
import { ICON_DATA } from "../src/generated/icons.js";
import { ICONS, resolveIcon } from "../src/icons.js";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";

describe("bundled Tabler icons", () => {
  it("contains the complete pinned catalog and reproducible generated modules", () => {
    expect(ICONS).toHaveLength(5184);
    expect([...ICON_DATA.values()].filter((drawing) => drawing.filled)).toHaveLength(1054);
    for (const [file, content] of generateIcons()) {
      expect(readFileSync(join(import.meta.dirname, `../src/generated/${file}`), "utf8")).toBe(content);
    }
  });

  it("keeps every generated drawing to path geometry and fixed paint flags", () => {
    for (const [name, drawing] of ICON_DATA) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      for (const paths of Object.values(drawing)) {
        expect(paths.length).toBeGreaterThan(0);
        for (const [d, paint] of paths) {
          expect(d).toMatch(/^[Mm][MmZzLlHhVvCcSsQqTtAa\d\s.,+-]+$/);
          expect(Number.isInteger(paint) && paint >= 0 && paint <= 7).toBe(true);
        }
      }
    }
  });

  it.each([
    [["script", { d: "M0 0" }]],
    [["image", { href: "https://example.com" }]],
    [["use", { href: "#pin" }]],
    [["path", { d: "M0 0", onload: "alert(1)" }]],
    [["path", { d: "M0 0", style: "fill:red" }]],
    [["path", { d: "M0 0", fill: "url(https://example.com)" }]],
    [["path", { d: "M0 0", opacity: "1" }]],
    [["path", { d: "<script>" }]],
    [["path", {}]],
    [],
  ])("rejects unexpected upstream SVG: %j", (nodes?: unknown) => {
    // it.each expands an array row, so wrap it back into the node list.
    expect(() => validatePaths(nodes === undefined ? [] : [nodes])).toThrow();
  });

  it("normalizes Tabler's paint exceptions without copying presentation attributes", () => {
    expect(validatePaths([["path", { d: "M0 0", fill: "currentColor", stroke: "none", opacity: ".5" }]])).toEqual([["M0 0", 7]]);
  });

  it("accepts both styles inside roots, cells and buttons", () => {
    const source = "page\n  icon dots-vertical\n  icon.filled pin\n  table\n    row\n      cell Text\n        icon archive\n        button.link\n          icon pin\n        button Save\n          icon.filled pin";
    expect(parseWireframe(source).diagnostics).toEqual([]);
    expect(summarizeWireframe(parseWireframe(source))).toBe("Wireframe: page");
    const root = renderWireframe(parseWireframe(source))!;
    expect(root.querySelector('svg[aria-label="dots vertical"][role="img"]')).not.toBeNull();
    expect(root.querySelector(".wf-icon-filled path")!.getAttribute("d")).toBe(resolveIcon("pin", "filled")!.paths[0]![0]);
    const buttons = [...root.querySelectorAll(".wf-button")];
    expect(buttons[0]!.classList.contains("wf-icon-only")).toBe(true);
    expect(buttons[0]!.querySelector('svg[aria-label="pin"]')).not.toBeNull();
    expect(buttons[1]!.firstChild).toBe(buttons[1]!.querySelector(".wf-icon"));
    expect(buttons[1]!.lastChild!.textContent).toBe("Save");
    expect(root.querySelector("button, a, [tabindex], [href], [style]")).toBeNull();
  });

  it("warns and draws unknown names as text, suggests the filled syntax and rejects aliases", () => {
    const source = 'page\n  icon pinn\n  icon pin-filled\n  icon figma\n  icon constructor\n  icon "<svg onload=alert(1)>"';
    const result = parseWireframe(source);
    expect(result.diagnostics.map(({ line, severity, message }) => [line, severity, message])).toEqual([
      [2, "warning", 'unknown icon "pinn": expected a Tabler icon name'],
      [3, "warning", 'unknown icon "pin-filled": expected a Tabler icon name; use icon.filled pin'],
      [4, "warning", 'unknown icon "figma": expected a Tabler icon name'],
      [5, "warning", 'unknown icon "constructor": expected a Tabler icon name'],
      [6, "warning", 'unknown icon "<svg onload=alert(1)>": expected a Tabler icon name'],
    ]);
    const root = renderWireframe(result)!;
    expect([...root.querySelectorAll(".wf-icon-unknown")].map((node) => node.textContent)).toEqual(["pinn", "pin-filled", "figma", "constructor", "<svg onload=alert(1)>"]);
    expect(root.querySelector("svg")).toBeNull();
  });

  it("warns and draws outline when filled is missing", () => {
    const result = parseWireframe("page\n  icon.filled a-b-2");
    expect(result.diagnostics).toEqual([{ line: 2, severity: "warning", message: 'icon "a-b-2" has no filled style: drawing outline' }]);
    expect(renderWireframe(result)!.querySelector(".wf-icon-outline")).not.toBeNull();
  });

  it("warns and draws filled when outline is missing", () => {
    // This release has no filled-only names; exercise that direction with a
    // synthetic catalog entry, without adding any accepted name to production.
    const get = vi.spyOn(ICON_DATA, "get").mockReturnValue({ filled: [["M0 0L1 1Z", 0]] });
    try {
      const result = parseWireframe("page\n  icon pin");
      expect(result.diagnostics).toEqual([{ line: 2, severity: "warning", message: 'icon "pin" has no outline style: drawing filled' }]);
      expect(renderWireframe(result)!.querySelector(".wf-icon-filled")).not.toBeNull();
    } finally { get.mockRestore(); }
  });

  it.each(["row", "card", "text"])("warns and still draws an icon in %s", (parent) => {
    const source = parent === "card" ? "card\n  icon pin" : `page\n  ${parent}\n    icon pin`;
    const result = parseWireframe(source);
    expect(result.diagnostics).toEqual([{ line: source.split("\n").length, severity: "warning", message: "icon must be directly inside dialog, banner, page, frame, phone, cell or button" }]);
    expect(renderWireframe(result)!.querySelector('svg[aria-label="pin"]')).not.toBeNull();
  });
});
