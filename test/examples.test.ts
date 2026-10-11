// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWireframe } from "../src/index.js";

// The playground's gallery: an example with an error fails the suite. Warnings,
// missing approvals and examples changed since approval don't; a person sees
// those in the playground.

const folder = new URL("../examples/", import.meta.url);
// The examples directly in examples/ and in its group folders, as group/name.wireframe.
const examples = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".wireframe"));

describe("examples", () => {
  it("has the seeds", () => {
    expect(examples).toEqual(expect.arrayContaining([
        "samples/archived-banner.wireframe",
        "samples/delete-confirmation.wireframe",
        "reference/vocabulary.wireframe",
      ]));
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
