// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWireframe } from "../src/index.js";
import { validName } from "../playground/catalog.js";
import { cardBlock, documentList, figmaPrivate, figmaReading } from "./samples.js";

// The playground's gallery: an example with an error fails the suite. Warnings,
// missing approvals and examples changed since approval don't; a person sees
// those in the playground.

const folder = new URL("../examples/", import.meta.url);
// Scan every depth so a misplaced example cannot silently disappear.
const examples = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".wireframe"));

describe("examples", () => {
  it("has the seeds", () => {
    expect(examples).toEqual(expect.arrayContaining([
        "badges-and-banners/1-badges/chip.wireframe",
        "badges-and-banners/1-badges/chip-overflow.wireframe",
        "badges-and-banners/1-badges/long-tags.wireframe",
        "badges-and-banners/2-banners/archived-banner.wireframe",
        "badges-and-banners/3-confirmations/delete-confirmation.wireframe",
        "pages/uberblick/document-list.wireframe",
        "reference/vocabulary/kinds-and-variants.wireframe",
      ]));
  });

  it("has a group for each family of components", () => {
    const groups = new Set(examples.map((file) => file.split("/")[0]));
    for (const group of ["badges-and-banners", "blocks", "forms", "navigation", "pages", "tables"]) expect(groups).toContain(group);
  });

  it("holds the document list page as the product corpus sketches it", () => {
    expect(readFileSync(new URL("pages/uberblick/document-list.wireframe", folder), "utf8")).toBe(`${documentList}\n`);
  });

  it("holds the Card block source without diagnostics", () => {
    expect(readFileSync(new URL("pages/uberblick/card-block.wireframe", folder), "utf8")).toBe(`${cardBlock}\n`);
    expect(parseWireframe(cardBlock).diagnostics).toEqual([]);
  });

  it("holds the sidebar sketch with its optional pixel width and no diagnostics", () => {
    const source = readFileSync(new URL("pages/uberblick/sidebar.wireframe", folder), "utf8");
    expect(source.startsWith("page width=256\n")).toBe(true);
    expect(parseWireframe(source).diagnostics).toEqual([]);
  });

  it("holds both assigned Figma sources without diagnostics", () => {
    for (const [name, source] of [["reading", figmaReading], ["private", figmaPrivate]]) {
      expect(readFileSync(new URL(`pages/uberblick/figma-block-${name}.wireframe`, folder), "utf8")).toBe(`${source}\n`);
      expect(parseWireframe(source!).diagnostics).toEqual([]);
    }
  });

  it("includes one that gives a warning", () => {
    const warned = examples.filter((file) =>
      parseWireframe(readFileSync(new URL(file, folder), "utf8")).diagnostics.some((d) => d.severity === "warning"),
    );
    expect(warned).not.toEqual([]);
  });

  it.each(examples)("%s has no error", (file) => {
    const { diagnostics } = parseWireframe(readFileSync(new URL(file, folder), "utf8"));
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it.each(examples)("%s is visible in the sidebar", (file) => {
    expect(validName(file.slice(0, -".wireframe".length))).toBe(true);
  });

  it("has at least one complex form, with no errors or warnings", () => {
    const complex = examples.filter((file) => file.startsWith("forms/3-complex-forms/"));
    expect(complex.length).toBeGreaterThan(0);
    for (const file of complex) expect(parseWireframe(readFileSync(new URL(file, folder), "utf8")).diagnostics).toEqual([]);
  });

  it("holds the banner examples without diagnostics", () => {
    const banners = examples.filter((file) => file.startsWith("badges-and-banners/2-banners/"));
    for (const file of banners) expect(parseWireframe(readFileSync(new URL(file, folder), "utf8")).diagnostics).toEqual([]);
  });

  it("holds the divider showcase without diagnostics", () => {
    const source = readFileSync(new URL("blocks/3-dividers/stacked-content.wireframe", folder), "utf8");
    expect(parseWireframe(source).diagnostics).toEqual([]);
  });
});
