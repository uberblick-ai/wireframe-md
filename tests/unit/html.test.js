import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDefaultStyles, renderWireframeBlockToHtml } from "@wireframe-md/html";

describe("html rendering", () => {
  it("keeps the inlined default styles in sync with the stylesheet file", () => {
    const source = readFileSync(new URL("../../packages/html/styles.css", import.meta.url), "utf8");

    expect(getDefaultStyles()).toBe(source);
  });

  it("renders a custom browser url into browser chrome", () => {
    const html = renderWireframeBlockToHtml([
      "screen inspect title=\"Inspect\" device=browser url=\"https://uberblick.ai/lookbook/inspect/ui/form/single_select\"",
    ].join("\n"));

    expect(html).toContain("https://uberblick.ai/lookbook/inspect/ui/form/single_select");
  });

  it("does not replace non-browser chrome with a url", () => {
    const html = renderWireframeBlockToHtml([
      "screen mobile title=\"Inbox\" device=mobile url=\"https://example.com/mobile\"",
    ].join("\n"));

    expect(html).not.toContain("https://example.com/mobile");
  });
});
