import { describe, expect, it } from "vitest";
import { renderWireframeBlockToHtml } from "@wireframe-md/html";

describe("html rendering", () => {
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
