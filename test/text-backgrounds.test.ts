import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const backgrounds = ["bg-red", "bg-amber", "bg-green", "bg-blue"];

describe("text backgrounds", () => {
  for (const background of backgrounds) {
    it.each(["", ".strong", ".small", ".small.strong", ".title", ".title.small"])(`accepts ${background} text%s wherever text stands and keeps inline mono`, (variants) => {
      for (const parent of ["dialog Title", "banner", "page", "frame Caption", "phone", "card", "page\n  card", "page\n  row", "page\n  row\n    row", "phone\n  dock"]) {
        const indent = "  ".repeat(parent.split("\n").length);
        const result = parseWireframe(`${parent}\n${indent}text.${background}${variants} Use \`GitHub\`.`);
        expect(result.diagnostics).toEqual([]);
        const line = renderWireframe(result)!.querySelector(".wf-text")!;
        expect(line.textContent).toBe("Use GitHub.");
        expect(line.querySelector(".wf-mono")!.textContent).toBe("GitHub");
        expect(line.children).toHaveLength(1);
        for (const variant of [background, ...variants.split(".").filter(Boolean)]) expect(line.classList.contains(`wf-${variant}`)).toBe(true);
        expect(line.querySelector("[role], [tabindex], [style], a, button, input, script")).toBeNull();
        expect(line.hasAttribute("role")).toBe(false);
      }
    });

    it(`chooses ${background} independently of the text colour in any order`, () => {
      for (const colour of ["muted", "red", "amber", "green", "blue"]) {
        for (const variants of [[background, colour], [colour, background]]) {
          const result = parseWireframe(`page\n  text.${variants.join(".")}.strong.small Tinted`);
          expect(result.diagnostics).toEqual([]);
          const line = renderWireframe(result)!.querySelector(".wf-text")!;
          expect([...line.classList]).toEqual(["wf-text", ...variants.map((variant) => `wf-${variant}`), "wf-strong", "wf-small"]);
          expect(line.textContent).toBe("Tinted");
          expect(line.children).toHaveLength(0);
        }
      }
    });

    it(`warns once for competing ${background} backgrounds, including repeats, and draws only the first`, () => {
      for (const other of backgrounds) {
        const result = parseWireframe(`page\n  text.${background}.red.${other}.strong.bg-blue Tinted`);
        expect(result.diagnostics).toEqual([{
          line: 2, severity: "warning",
          message: "text takes one of .bg-red, .bg-amber, .bg-green or .bg-blue: the first is used",
        }]);
        const line = renderWireframe(result)!.querySelector(".wf-text")!;
        expect([...line.classList]).toEqual(["wf-text", `wf-${background}`, "wf-red", "wf-strong"]);
      }
    });

    it(`keeps ${background} labels inert and root summaries unchanged`, () => {
      const label = 'Use `<img src=x onerror="alert(1)">`.';
      for (const parent of ["page", "phone", "banner", "card"]) {
        const result = parseWireframe(`${parent}\n  text.${background} ${JSON.stringify(label)}`);
        expect(result.diagnostics).toEqual([]);
        expect(summarizeWireframe(result)).toBe(`Wireframe: ${parent} “Use <img src=x onerror="alert(1)">.”`);
        const root = renderWireframe(result)!;
        expect(root.querySelector(".wf-text")!.textContent).toBe('Use <img src=x onerror="alert(1)">.');
        expect(root.querySelector("img, script, [onerror], [style], [tabindex]")).toBeNull();
      }
      expect(summarizeWireframe(parseWireframe(`card\n  text Body\n  text.${background}.title Title`))).toBe("Wireframe: card “Title”");
    });

    it(`warns and adds no ${background} background on every other kind`, () => {
      for (const kind of KINDS.keys()) {
        if (kind === "text") continue;
        const result = parseWireframe(`${kind}.${background}`);
        expect(result.diagnostics.filter((diagnostic) => diagnostic.message.startsWith(`unknown variant ".${background}"`))).toEqual([
          expect.objectContaining({ line: 1, severity: "warning" }),
        ]);
        expect(renderWireframe(result)!.querySelector(`.wf-${background}`)).toBeNull();
      }
    });
  }

  it("resolves text colour and background conflicts independently", () => {
    const result = parseWireframe("page\n  text.bg-blue.muted.bg-red.red.bg-green.muted Tinted");
    expect(result.diagnostics).toEqual([
      { line: 2, severity: "warning", message: "text takes one of .muted, .red, .amber, .green or .blue: the first is used" },
      { line: 2, severity: "warning", message: "text takes one of .bg-red, .bg-amber, .bg-green or .bg-blue: the first is used" },
    ]);
    expect([...renderWireframe(result)!.querySelector(".wf-text")!.classList]).toEqual(["wf-text", "wf-bg-blue", "wf-muted"]);
  });

  it.each(["added", "removed", "bg-purple"])("recovers unknown text variant .%s without styling", (variant) => {
    const result = parseWireframe(`page\n  text.${variant} Tinted`);
    expect(result.diagnostics).toEqual([{
      line: 2, severity: "warning",
      message: `unknown variant ".${variant}" on text: expected .muted, .strong, .title, .small, .red, .amber, .green, .blue, .bg-red, .bg-amber, .bg-green or .bg-blue`,
    }]);
    const line = renderWireframe(result)!.querySelector(".wf-text")!;
    expect([...line.classList]).toEqual(["wf-text"]);
    expect(line.textContent).toBe("Tinted");
    expect(line.children).toHaveLength(0);
  });
});
