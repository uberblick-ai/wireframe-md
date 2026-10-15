import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";

const example = (name: string): string => readFileSync(join(import.meta.dirname, `../examples/pages/1-wrappers/${name}.wireframe`), "utf8");
const draw = (source: string): HTMLElement => renderWireframe(parseWireframe(source))!;

describe("page wrappers", () => {
  it.each(["browser", "window", "general"])("parses the %s example without diagnostics", (name) => {
    expect(parseWireframe(example(name)).diagnostics).toEqual([]);
  });

  it.each(["browser", "window"])("keeps page children, placement rules and widths in %s", (variant) => {
    const body = "\n  text.title Content\n  input label=Name Hint\n  select Value\n  toggle\n    option.current General\n  row\n    card\n      text Card\n      image.square Placeholder\n      row\n        button Save\n  divider\n  table\n    row\n      cell Entry\n  icon pin";
    const parsed = parseWireframe(`page.${variant}#example width=480 Label${body}`);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]?.id).toBe("example");
    const root = renderWireframe(parsed)!;
    expect(root.querySelector<HTMLElement>(".wf-page")!.style.width).toBe("min(480px, 100%)");
    expect(root.querySelector(".wf-page-content")!.innerHTML).toBe(draw(`page width=480${body}`).firstElementChild!.innerHTML);
    expect(parseWireframe(`dialog\n  page.${variant} Label\n    button Loose`).diagnostics).toEqual([
      { line: 2, severity: "warning", message: "page must be at the top level" },
      { line: 3, severity: "warning", message: "button must be directly inside row, cell or frame" },
    ]);
  });

  it("draws three hidden browser marks and a plain address before the body", () => {
    const root = draw(example("browser"));
    expect([...root.querySelector(".wf-page")!.children].map((element) => element.className)).toEqual(["wf-page-chrome", "wf-page-content"]);
    expect(root.querySelector(".wf-page-marks")!.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelectorAll(".wf-browser-mark[aria-hidden=true]")).toHaveLength(3);
    expect(root.querySelector(".wf-browser-address")!.textContent).toBe("acme.example/pricing");
    expect(root.querySelectorAll(".wf-window-light")).toHaveLength(0);
  });

  it("draws three hidden traffic lights and a window title", () => {
    const root = draw(example("window"));
    expect(root.querySelector(".wf-page-marks")!.getAttribute("aria-hidden")).toBe("true");
    expect([...root.querySelectorAll(".wf-window-light")].map((element) => element.className)).toEqual([
      "wf-window-light wf-danger", "wf-window-light wf-warning", "wf-window-light wf-success",
    ]);
    expect(root.querySelector(".wf-window-title")!.textContent).toBe("Settings");
    expect(root.querySelectorAll(".wf-browser-mark")).toHaveLength(0);
  });

  it.each(["browser", "window"])("keeps %s labels literal and inert, including URLs and markup", (variant) => {
    const label = 'javascript:alert(1) <img src=x onerror=alert(1)> `literal`';
    const root = draw(`page.${variant} ${label}`);
    expect(root.querySelector(".wf-page-chrome")!.textContent).toBe(label);
    expect(root.querySelectorAll("a, input, button, select, img, script, [href], [src], [tabindex], [contenteditable], [style]")).toHaveLength(0);
    for (const element of root.querySelectorAll("*")) {
      expect([...element.attributes].some((attribute) => attribute.name.startsWith("on"))).toBe(false);
    }
    expect(parseWireframe(`page.${variant}`).diagnostics).toEqual([]);
    expect(draw(`page.${variant}`).querySelector(".wf-page-chrome")!.textContent).toBe("");
  });

  it.each([
    ["browser.window", "browser"], ["window.browser", "window"], ["browser.browser", "browser"], ["window.window", "window"],
  ])("warns once and draws the first chrome variant for page.%s", (variants, first) => {
    const result = parseWireframe(`\npage.${variants} Label`);
    expect(result.diagnostics).toEqual([{ line: 2, severity: "warning", message: "page takes one of .browser or .window: the first is used" }]);
    expect(result.renderable).toBe(true);
    expect(renderWireframe(result)!.firstElementChild!.className).toBe(`wf-page wf-${first}`);
    expect(summarizeWireframe(result)).toBe(`Wireframe: ${first} “Label”`);
  });

  it("warns about unknown page variants and labels, retaining the plain drawing", () => {
    const result = parseWireframe("page.x Label\n  text.title Body");
    expect(result.diagnostics).toEqual([
      { line: 1, severity: "warning", message: 'unknown variant ".x" on page: expected .browser or .window' },
      { line: 1, severity: "warning", message: "page takes no label" },
    ]);
    const root = renderWireframe(result)!;
    expect(root.firstElementChild!.className).toBe("wf-page");
    expect(root.querySelectorAll(".wf-page-chrome, .wf-page-content")).toHaveLength(0);
    expect(root.textContent).toBe("LabelBody");
    expect(parseWireframe("page Title").diagnostics).toEqual([{ line: 1, severity: "warning", message: "page takes no label" }]);
  });

  it.each(["browser", "window"])("ignores unknown variants beside known %s chrome", (variant) => {
    const source = `page.x.${variant} Label`;
    expect(parseWireframe(source).diagnostics).toEqual([{ line: 1, severity: "warning", message: 'unknown variant ".x" on page: expected .browser or .window' }]);
    expect(draw(source).firstElementChild!.className).toBe(`wf-page wf-${variant}`);
    expect(summarizeWireframe(parseWireframe(source))).toBe(`Wireframe: ${variant} “Label”`);
  });

  it.each([
    ["browser", "browser “acme.example/pricing”"], ["window", "window “Settings”"], ["general", "page “Sign in”"],
  ])("summarizes the %s example", (name, summary) => {
    expect(summarizeWireframe(parseWireframe(example(name)))).toBe(`Wireframe: ${summary}`);
  });

  it.each(["browser", "window"])("names %s by its label, then its first direct text, then only its variant", (variant) => {
    expect(summarizeWireframe(parseWireframe(`page.${variant} Label\n  text First`))).toBe(`Wireframe: ${variant} “Label”`);
    expect(summarizeWireframe(parseWireframe(`page.${variant}\n  text First\n  text.title Second`))).toBe(`Wireframe: ${variant} “First”`);
    expect(summarizeWireframe(parseWireframe(`page.${variant}\n  row\n    text Nested`))).toBe(`Wireframe: ${variant}`);
  });
});
