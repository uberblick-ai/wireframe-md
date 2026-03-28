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

  it("renders a top-level frame without device shell chrome", () => {
    const html = renderWireframeBlockToHtml([
      "frame contact title=\"Contact Form\" width=480 height=360",
      "  region label=\"Form\"",
    ].join("\n"));

    expect(html).toContain("wf-frame");
    expect(html).toContain("Contact Form");
    expect(html).not.toContain("wf-shell-head");
    expect(html).not.toContain("wf-device-svg");
  });
});
