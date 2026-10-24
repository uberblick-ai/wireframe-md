import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const draw = (source: string): HTMLElement => renderWireframe(parseWireframe(source))!;
const warning = (line: number, message: string) => ({ line, severity: "warning", message });
const placement = "fractional width is only allowed on a card directly inside a row";
const overfull = "fractional card widths in a row add up to more than 1: scaled to fit";
const withinRow = (value: string) => `page\n  row\n    card width=${value}\n      text Content`;

describe("fractional card widths", () => {
  it("accepts digit-only fractions within the bounds in every full-width row", () => {
    for (const parent of ["dialog Title", "page", "page.browser Address", "frame", "phone", "phone\n  dock", "card"]) {
      for (const value of ["1/3", "1/1", "1/9999", "9999/9999", "0001/0003", '"2/3"']) {
        const indent = parent.includes("dock") ? "    " : "  ";
        const source = `${parent}\n${indent}row.stretch\n${indent}  card width=${value} padding=8\n${indent}    text Content`;
        const parsed = parseWireframe(source);
        expect(parsed.diagnostics).toEqual([]);
        expect(parsed.nodes[0]!.children).not.toEqual([]);
        expect(draw(source).textContent).toContain("Content");
        expect(summarizeWireframe(parsed)).toBe(summarizeWireframe(parseWireframe(source.replace(` width=${value}`, ""))));
      }
    }
  });

  it("ignores well-formed fractions outside full-width rows, with a warning on the node", () => {
    for (const source of [
      "card width=1/3", "page\n  card width=1/3", "banner\n  row\n    card width=1/3",
      "page\n  row\n    row\n      card width=1/3", "page\n  table\n    row\n      card width=1/3",
      "page\n  row.scroll\n    card width=1/3", "row\n  card width=1/3",
      "page width=1/3", "page\n  image width=1/3",
    ]) {
      const parsed = parseWireframe(source);
      expect(parsed.diagnostics).toContainEqual(warning(source.split("\n").length, placement));
      expect(parsed.diagnostics.some((d) => d.message.startsWith("invalid width"))).toBe(false);
      expect(draw(source).outerHTML).toBe(draw(source.replace(" width=1/3", "")).outerHTML);
    }
  });

  it("keeps the existing kind warning on other kinds", () => {
    for (const kind of [...KINDS.keys(), "unknown"].filter((kind) => !["page", "card", "image"].includes(kind))) {
      const source = `${kind} width=1/3`;
      const diagnostics = parseWireframe(source).diagnostics;
      expect(diagnostics).toContainEqual(warning(1, 'attribute "width" is only allowed on page, card or image'));
      expect(diagnostics.some((d) => /fractional|invalid width/.test(d.message))).toBe(false);
      expect(draw(source).outerHTML).toBe(draw(kind).outerHTML);
    }
  });

  it("describes both forms for invalid card widths, retaining pixel-only messages for page/image", () => {
    for (const value of ["0/3", "4/3", "1/0", "1.5/3", "1/10000", "10000/10000", "33%", "240px", "-1/3", "+1/3", "1/3/4", "１/３", "1 / 3", ""]) {
      const source = withinRow(`"${value}"`);
      expect(parseWireframe(source).diagnostics).toEqual([
        warning(3, `invalid width "${value}": expected a whole number of pixels from 1 to 9999, such as width=240, or a fraction of the row such as width=1/3`),
      ]);
      expect(draw(source).outerHTML).toBe(draw(source.replace(` width="${value}"`, "")).outerHTML);
      for (const kind of ["page", "image"]) {
        expect(parseWireframe(`${kind} width="${value}"`).diagnostics).toContainEqual(
          warning(1, `invalid width "${value}": expected a whole number of pixels from 1 to 9999, such as width=240`),
        );
      }
    }
  });

  it("uses the first repeated width, including invalid values and over-full sums", () => {
    for (const value of ["1/3", "120", "bad"]) {
      const source = withinRow(`${value} width=2/3`);
      expect(parseWireframe(source).diagnostics).toContainEqual(warning(3, 'repeated attribute "width": the first value is used'));
      expect(draw(source).outerHTML).toBe(draw(source.replace(" width=2/3", "")).outerHTML);
    }
    const source = "page\n  row\n    card width=1/3 width=1/1\n    card width=2/3";
    expect(parseWireframe(source).diagnostics).toEqual([warning(3, 'repeated attribute "width": the first value is used')]);
  });

  it("warns once on each over-full row and compares sums exactly", () => {
    expect(parseWireframe("page\n  row\n    card width=2/3\n    card width=2/3\n    card width=1/2\n  row\n    card width=1/1\n    card width=1/9999").diagnostics).toEqual([
      warning(2, overfull), warning(6, overfull),
    ]);
    for (const denominator of [3, 6, 7, 9, 10, 11]) {
      const cards = Array(denominator).fill(`    card width=1/${denominator}`).join("\n");
      expect(parseWireframe(`page\n  row\n${cards}`).diagnostics).toEqual([]);
      expect(parseWireframe(`page\n  row\n${cards}\n    card width=1/9999`).diagnostics).toEqual([warning(2, overfull)]);
    }
  });

  it("uses the effective scroll variant when deciding whether a fraction has a width", () => {
    for (const variants of ["stretch.scroll", "end.scroll.stretch", "stretch.scroll.end", "between.scroll.stretch"]) {
      expect(parseWireframe(withinRow("1/3").replace("row", `row.${variants}`)).diagnostics.some((d) => d.message === placement)).toBe(false);
    }
    for (const variants of ["scroll", "scroll.stretch", "scroll.end.stretch"]) {
      expect(parseWireframe(withinRow("1/3").replace("row", `row.${variants}`)).diagnostics).toContainEqual(warning(3, placement));
    }
  });

  it("revalidates a modified model and leaves mock output inert", () => {
    const source = withinRow("1/3");
    const parsed = parseWireframe(source);
    parsed.nodes[0]!.children[0]!.children[0]!.attributes[0]!.value = "1/3; background:url(evil)";
    expect(renderWireframe(parsed)!.outerHTML).toBe(draw(source.replace(" width=1/3", "")).outerHTML);
    expect(draw(source).querySelector("a, button, input, script, [tabindex], [onclick], [src], [href]")).toBeNull();
  });

  it("retains unsupported row labels and unknown children alongside fractional cards", () => {
    const source = "page\n  row Unsupported label\n    mystery Unknown child\n    card width=1/3\n      text First card\n    card\n      text Second card";
    const root = draw(source);
    expect(root.textContent).toBe("Unsupported labelmysteryUnknown childFirst cardSecond card");
    expect([...root.querySelectorAll(".wf-card")].map((card) => card.textContent)).toEqual(["First card", "Second card"]);
    expect(root.querySelector(".wf-unknown")!.getAttribute("data-line")).toBe("3");
  });
});
