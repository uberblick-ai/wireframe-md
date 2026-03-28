import { describe, expect, it } from "vitest";
import { buildHtmlDocument, buildShowcaseModel } from "../../scripts/build-site.js";
import { nextTheme, resolveExampleId } from "../../site/showcase/client.js";

describe("showcase site", () => {
  it("builds a materialized showcase model from the example registry", () => {
    const model = buildShowcaseModel();

    expect(model.defaultExampleId).toBeTruthy();
    expect(model.groups).not.toHaveLength(0);
    expect(model.groups[0].examples[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      source: expect.any(String),
      previewHtml: expect.stringContaining("wf-block-box"),
    });
  });

  it("renders the showcase shell into the built html document", () => {
    const html = buildHtmlDocument();

    expect(html).toContain("data-showcase-app");
    expect(html).toContain("Capability Gallery");
    expect(html).toContain("showcase-data");
    expect(html).toContain("./assets/showcase.js");
  });

  it("falls back to the default example when the requested hash is invalid", () => {
    const model = buildShowcaseModel();

    expect(resolveExampleId(model, "#not-real")).toBe(model.defaultExampleId);
  });

  it("toggles between light and dark themes", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});
