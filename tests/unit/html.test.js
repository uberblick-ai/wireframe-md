import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDefaultStyles, renderFixtureDocument, renderWireframeBlockToHtml } from "@wireframe-md/html";

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

  it("supports plain screen surfaces without the outer preview card or device outline", () => {
    const html = renderWireframeBlockToHtml([
      "screen lookbook title=\"Lookbook\" device=browser surface=plain",
      "  region label=\"Preview\"",
    ].join("\n"));

    expect(html).toContain("wf-screen-frame frame-browser surface-plain");
    expect(html).toContain("wf-device-svg");
    expect(html).not.toContain("wf-shell-head");
    expect(html).not.toContain("wf-preview-box");
    expect(getDefaultStyles()).toContain(".wf-screen-frame.surface-plain");
  });

  it("allows regions to hide fallback placeholder lines", () => {
    const html = renderWireframeBlockToHtml([
      "frame chrome title=\"Chrome\" width=480 height=120 surface=plain",
      "  region label=\"Top Bar\" surface=plain placeholder=false",
    ].join("\n"));

    expect(html).toContain("wf-region surface-plain no-placeholder");
    expect(html).not.toContain("wf-region-lines");
  });

  it("allows regions to hide their label chrome", () => {
    const html = renderWireframeBlockToHtml([
      "frame sidebar title=\"Elements\" width=320 height=420 surface=plain",
      "  region label=\"Sidebar\" surface=plain show_label=false",
      "    tree",
      "      item label=\"Tree\" selected=true",
    ].join("\n"));

    expect(html).toContain("wf-region surface-plain no-placeholder hide-label");
    expect(html).toContain("wf-tree-item is-selected");
    expect(html).not.toContain("wf-region-label");
    expect(html).not.toContain("wf-region-chip");
  });

  it("renders static tree navigation inside a region", () => {
    const html = renderWireframeBlockToHtml([
      "frame sidebar title=\"Elements\" width=320 height=420 surface=plain",
      "  region label=\"Catalog\" surface=plain",
      "    tree",
      "      group label=\"Layout\"",
      "        item label=\"Screen\"",
      "        item label=\"Split\" selected=true",
      "      group label=\"Examples\" expanded=false",
      "        item label=\"Lookbook\"",
    ].join("\n"));

    expect(html).toContain("wf-tree");
    expect(html).toContain("wf-tree-group");
    expect(html).toContain("wf-tree-item is-selected");
    expect(html).toContain("Catalog");
    expect(html).toContain("Split");
    expect(html).not.toContain("wf-region-lines");
  });

  it("renders stack-based props and code blocks inside a region", () => {
    const html = renderWireframeBlockToHtml([
      "frame inspect title=\"Inspect\" width=520 height=420",
      "  region label=\"Inspector\"",
      "    stack gap=16",
      "      props",
      "        prop key=\"device\" value=\"browser\"",
      "        prop key=\"surface\" value=\"plain\"",
      "      code_block language=\"wireframe\"",
      "        code_line \"screen lookbook title=\\\"Lookbook\\\" device=browser\"",
      "        code_line \"  region label=\\\"Preview\\\"\"",
    ].join("\n"));

    expect(html).toContain("wf-stack");
    expect(html).toContain("--wf-stack-gap:16px");
    expect(html).toContain("wf-props");
    expect(html).toContain("wf-prop-key");
    expect(html).toContain("wf-code-block");
    expect(html).toContain("wf-code-block-language");
    expect(html).toContain("screen lookbook title=&quot;Lookbook&quot; device=browser");
    expect(html).not.toContain("wf-region-lines");
  });

  it("supports auto-sized split tracks for content-height rows", () => {
    const html = renderWireframeBlockToHtml([
      "screen lookbook title=\"Lookbook\" device=browser surface=plain",
      "  split axis=vertical sizes=\"auto,rest\" surface=plain",
      "    region label=\"Top Bar\" surface=plain placeholder=false",
      "    region label=\"Preview\"",
    ].join("\n"));

    expect(html).toContain("flex:0 0 auto");
  });

  it("fits blocks to the available width when no explicit box width is provided", () => {
    const html = renderWireframeBlockToHtml("frame contact title=\"Contact Form\" width=480 height=360");

    expect(html).toContain("wf-block-box is-fluid");
    expect(html).toContain("width:100%;max-width:480px");
    expect(html).toContain("--wf-natural-width:480;--wf-natural-height:360;--wf-natural-width-px:480px");
  });

  it("keeps fixed box sizing when an explicit box width is provided", () => {
    const html = renderWireframeBlockToHtml("frame contact title=\"Contact Form\" width=480 height=360", {
      boxWidth: 240,
    });

    expect(html).toContain("wf-block-box is-fixed");
    expect(html).toContain("width:240px;height:180px");
    expect(html).toContain("transform:scale(0.5)");
  });

  it("still uses fluid width when only an explicit box height is provided", () => {
    const html = renderWireframeBlockToHtml("frame contact title=\"Contact Form\" width=480 height=360", {
      boxHeight: 180,
    });

    expect(html).toContain("wf-block-box is-fluid");
    expect(html).toContain("width:100%;max-width:240px");
  });

  it("supports explicit dark theme rendering on a block", () => {
    const html = renderWireframeBlockToHtml("frame contact title=\"Contact Form\"", { theme: "dark" });

    expect(html).toContain("wf-theme-dark");
  });

  it("supports explicit dark theme rendering in fixture documents", () => {
    const html = renderFixtureDocument("frame contact title=\"Contact Form\"", { theme: "dark" });

    expect(html).toContain("<html lang=\"en\" class=\"dark\">");
    expect(html).toContain("wf-fixture-root wf-theme-dark");
  });
});
