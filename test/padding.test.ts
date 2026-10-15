import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const render = (source: string): HTMLElement => renderWireframe(parseWireframe(source))!;
const warning = (line: number, message: string) => ({ line, severity: "warning", message });

describe("card padding", () => {
  it("accepts whole pixel padding including both limits, with ids and widths", () => {
    for (const value of ["0", "8", "64", "0008", '"8"']) {
      const result = parseWireframe(`card#compact width=240 padding=${value}\n  text Title`);
      expect(result.diagnostics).toEqual([]);
      expect(result.nodes[0]!.attributes).toEqual([
        { key: "width", value: "240" }, { key: "padding", value: value.replaceAll('"', "") },
      ]);
      const card = renderWireframe(result)!.querySelector<HTMLElement>(".wf-card")!;
      expect(card.style.getPropertyValue("--_wf-card-padding")).toBe(`${Number(value.replaceAll('"', ""))}px`);
      expect(card.style.getPropertyValue("--_wf-width")).toBe("240px");
      expect(card.hasAttribute("id")).toBe(false);
    }
  });

  it("warns at the source line about invalid padding and draws the default", () => {
    for (const value of ["8px", "-1", "8.5", "65", "1em", "", "+8", "1e1", "0xff", "８", "8 4", "url(evil)", "8; color:red"]) {
      const result = parseWireframe(`\ncard padding="${value}"\n  text Title`);
      expect(result.diagnostics).toEqual([
        warning(2, `invalid padding "${value}": expected a whole number of pixels from 0 to 64, such as padding=8`),
      ]);
      expect(result.renderable).toBe(true);
      expect(result.nodes[0]!.attributes).toEqual([{ key: "padding", value }]);
      expect(renderWireframe(result)!.outerHTML).toBe(render("\ncard\n  text Title").outerHTML);
    }
    expect(parseWireframe("card padding=").diagnostics).toEqual([
      warning(1, 'invalid padding "": expected a whole number of pixels from 0 to 64, such as padding=8'),
    ]);
  });

  it("warns only about padding's placement on every other kind, whatever its value", () => {
    for (const kind of [...KINDS.keys(), "box"].filter((kind) => kind !== "card")) {
      for (const value of ["8", "8px", ""]) {
        const result = parseWireframe(`\n${kind} padding=${value}`);
        expect(result.diagnostics).toContainEqual(warning(2, 'attribute "padding" is only allowed on card'));
        expect(result.diagnostics.filter((d) => /invalid padding|unknown attribute/.test(d.message))).toEqual([]);
        expect(result.renderable).toBe(true);
        expect(renderWireframe(result)!.outerHTML).toBe(render(`\n${kind}`).outerHTML);
      }
    }
  });

  it("retains repeated values, warns and uses the first even when invalid", () => {
    const result = parseWireframe("\ncard padding=8 padding=4");
    expect(result.diagnostics).toEqual([warning(2, 'repeated attribute "padding": the first value is used')]);
    expect(result.nodes[0]!.attributes).toEqual([{ key: "padding", value: "8" }, { key: "padding", value: "4" }]);
    expect(renderWireframe(result)!.querySelector<HTMLElement>(".wf-card")!.style.getPropertyValue("--_wf-card-padding")).toBe("8px");
    expect(parseWireframe("card padding=65 padding=8").diagnostics).toEqual([
      warning(1, 'invalid padding "65": expected a whole number of pixels from 0 to 64, such as padding=8'),
      warning(1, 'repeated attribute "padding": the first value is used'),
    ]);
    expect(render("card padding=65 padding=8").outerHTML).toBe(render("card").outerHTML);
    expect(parseWireframe("page padding=8 padding=4").diagnostics).toEqual([
      warning(1, 'attribute "padding" is only allowed on card'),
      warning(1, 'repeated attribute "padding": the first value is used'),
      warning(1, 'attribute "padding" is only allowed on card'),
    ]);
  });

  it("names padding in the unknown-attribute warning without changing the drawing", () => {
    const result = parseWireframe("\ncard format=PDF");
    expect(result.diagnostics).toEqual([
      warning(2, 'unknown attribute "format": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)'),
    ]);
    expect(renderWireframe(result)!.outerHTML).toBe(render("\ncard").outerHTML);
  });

  it("revalidates padding from a caller-modified model before setting a style", () => {
    const result = parseWireframe("card padding=8");
    result.nodes[0]!.attributes[0]!.value = "8px; background: url(https://example.com)";
    expect(renderWireframe(result)!.outerHTML).toBe(render("card").outerHTML);
  });

  it("keeps accessible summaries unchanged", () => {
    for (const source of ["card\n  text.title Title\n  text Body", "phone\n  dock\n    card\n      text Now playing"]) {
      expect(summarizeWireframe(parseWireframe(source.replace("card", "card padding=8")))).toBe(summarizeWireframe(parseWireframe(source)));
    }
  });
});
