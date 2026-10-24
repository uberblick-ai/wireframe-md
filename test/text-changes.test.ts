import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";

describe("added and removed text", () => {
  for (const change of ["added", "removed"]) {
    it.each(["", ".strong", ".small", ".small.strong", ".title"])(`accepts ${change} text%s wherever text stands and keeps inline mono`, (variants) => {
      for (const parent of ["dialog Title", "banner", "page", "frame Caption", "phone", "card", "page\n  card", "page\n  row", "page\n  row\n    row", "phone\n  dock"]) {
        const indent = "  ".repeat(parent.split("\n").length);
        const result = parseWireframe(`${parent}\n${indent}text.${change}${variants} Use \`GitHub\`.`);
        expect(result.diagnostics).toEqual([]);
        const root = renderWireframe(result)!;
        const line = root.querySelector(".wf-text")!;
        expect(line.textContent).toBe(`${change} Use GitHub.`);
        expect(line.querySelector(".wf-mono")!.textContent).toBe("GitHub");
        expect(line.querySelectorAll(".wf-text-change")).toHaveLength(1);
        expect(line.firstChild!.textContent).toBe(`${change} `);
        expect(line.firstElementChild!.hasAttribute("aria-hidden")).toBe(false);
        for (const variant of [change, ...variants.split(".").filter(Boolean)]) expect(line.classList.contains(`wf-${variant}`)).toBe(true);
        expect(line.querySelector("[role], [tabindex], [style], a, button, input, script")).toBeNull();
        expect(line.hasAttribute("role")).toBe(false);
      }
    });

    it(`warns once for competing ${change} colours, including repeats, and draws only the first`, () => {
      for (const other of ["added", "removed", "muted", "red", "amber", "green", "blue"]) {
        for (const colours of [[change, other], [other, change]]) {
          const result = parseWireframe(`page\n  text.${colours.join(".")}.strong.small Changed`);
          expect(result.diagnostics).toEqual([{
            line: 2, severity: "warning",
            message: "text takes one of .muted, .red, .amber, .green, .blue, .added or .removed: the first is used",
          }]);
          const line = renderWireframe(result)!.querySelector(".wf-text")!;
          expect([...line.classList]).toEqual(["wf-text", `wf-${colours[0]}`, "wf-strong", "wf-small"]);
          const marked = ["added", "removed"].includes(colours[0]!);
          expect(line.querySelectorAll(".wf-text-change")).toHaveLength(marked ? 1 : 0);
          expect(line.textContent).toBe(`${marked ? `${colours[0]} ` : ""}Changed`);
        }
      }
    });

    it(`keeps ${change} labels inert and root summaries free of the change prefix`, () => {
      const label = 'Use `<img src=x onerror="alert(1)">`.';
      for (const parent of ["page", "phone", "banner", "card"]) {
        const result = parseWireframe(`${parent}\n  text.${change} ${JSON.stringify(label)}`);
        expect(result.diagnostics).toEqual([]);
        expect(summarizeWireframe(result)).toBe(`Wireframe: ${parent} “Use <img src=x onerror="alert(1)">.”`);
        const root = renderWireframe(result)!;
        expect(root.querySelector(".wf-text")!.textContent).toBe(`${change} Use <img src=x onerror="alert(1)">.`);
        expect(root.querySelector("img, script, [onerror], [style], [tabindex]")).toBeNull();
      }
      expect(summarizeWireframe(parseWireframe(`card\n  text Body\n  text.${change}.title Title`))).toBe("Wireframe: card “Title”");
    });
  }
});
