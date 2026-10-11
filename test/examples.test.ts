// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWireframe } from "../src/index.js";

// The playground's gallery: an example with an error fails the suite. Warnings,
// missing approvals and examples changed since approval don't; a person sees
// those in the playground.

const folder = new URL("../examples/", import.meta.url);
const examples = readdirSync(folder).filter((file) => file.endsWith(".wireframe"));

describe("examples", () => {
  it("has the seeds", () => {
    expect(examples).toEqual(expect.arrayContaining(["archived-banner.wireframe", "delete-confirmation.wireframe", "vocabulary.wireframe"]));
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
});
