import { describe, expect, it } from "vitest";
import { extractWireframeBlocks, formatWireframeFenceInfo, normalizeRenderBox, parseFenceInfo, parseWireframe, resolveDeviceProfile, resolveSplitDefinition, resolveSurfaceStyle } from "@wireframe-md/core";

describe("core parsing", () => {
  it("parses inline fence render-box syntax", () => {
    expect(parseFenceInfo("wireframe[1280x800]")).toEqual({
      language: "wireframe",
      options: {
        boxWidth: 1280,
        boxHeight: 800,
      },
    });
  });

  it("formats wireframe fence info from render-box options", () => {
    expect(formatWireframeFenceInfo({})).toBe("wireframe");
    expect(formatWireframeFenceInfo({ boxWidth: 1280, boxHeight: 820 })).toBe("wireframe[1280x820]");
    expect(formatWireframeFenceInfo({ boxWidth: null, boxHeight: 400 })).toBe("wireframe[x400]");
  });

  it("normalizes render-box options to the canonical boxWidth/boxHeight shape", () => {
    expect(normalizeRenderBox({ boxWidth: 1280, boxHeight: 820 })).toEqual({ boxWidth: 1280, boxHeight: 820 });
    expect(normalizeRenderBox({ width: 960, height: 540 })).toEqual({ boxWidth: 960, boxHeight: 540 });
  });

  it("extracts wireframe blocks from markdown", () => {
    const blocks = extractWireframeBlocks([
      "# Demo",
      "",
      "```wireframe[x400]",
      "screen settings title=\"Settings\" device=app",
      "```",
    ].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toContain("screen settings");
    expect(blocks[0].info.options).toEqual({ boxWidth: null, boxHeight: 400 });
  });

  it("extracts tilde-fenced wireframe blocks from markdown", () => {
    const blocks = extractWireframeBlocks([
      "~~~wireframe[1280x820]",
      "screen lookbook title=\"Lookbook\" device=browser",
      "~~~",
    ].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].info.options).toEqual({ boxWidth: 1280, boxHeight: 820 });
  });

  it("parses top-level screens", () => {
    const ast = parseWireframe([
      "screen dashboard title=\"Dashboard\" device=browser",
      "frame contact title=\"Contact Form\" width=480 height=360",
      "screen detail title=\"Detail\" device=app width=1024 height=640",
    ].join("\n"));

    expect(ast.children).toHaveLength(3);
    expect(ast.children[0].attrs.title).toBe("Dashboard");
    expect(ast.children[1].kind).toBe("frame");
    expect(ast.children[1].attrs.width).toBe(480);
    expect(ast.children[2].attrs.width).toBe(1024);
    expect(ast.children[2].attrs.height).toBe(640);
  });

  it("ignores unsupported size shorthand and uses explicit dimensions only", () => {
    const ast = parseWireframe("screen analytics title=\"Analytics\" device=browser size=1440x520 width=1200 height=600");
    const screen = ast.children[0];

    expect(screen.attrs.size).toBe("1440x520");
  });

  it("parses nested split layouts beneath a screen or frame", () => {
    const ast = parseWireframe([
      "screen lookbook title=\"Lookbook\" device=browser",
      "  split axis=horizontal sizes=\"260,rest\"",
      "    region label=\"Previews\"",
      "    split axis=vertical sizes=\"rest,180\"",
      "      region label=\"Preview\"",
      "      region label=\"Params\"",
      "frame contact title=\"Contact Form\" width=480 height=360",
      "  region label=\"Form\"",
    ].join("\n"));

    expect(ast.children).toHaveLength(2);
    expect(ast.children[0].kind).toBe("screen");
    expect(ast.children[0].children).toHaveLength(1);
    expect(ast.children[0].children[0].kind).toBe("split");
    expect(ast.children[0].children[0].children[0].attrs.label).toBe("Previews");
    expect(ast.children[0].children[0].children[1].children[1].attrs.label).toBe("Params");
    expect(ast.children[1].kind).toBe("frame");
    expect(ast.children[1].children[0].attrs.label).toBe("Form");
  });

  it("rejects invalid indentation", () => {
    expect(() =>
      parseWireframe([
        "screen dashboard title=\"Dashboard\" device=browser",
        "   split axis=horizontal",
        "    region label=\"Bad indent\"",
      ].join("\n")),
    ).toThrow(/Use multiples of 2 spaces/);
  });

  it("rejects non-screen or non-frame top-level nodes", () => {
    expect(() => parseWireframe("split axis=horizontal")).toThrow(/Only "screen" and "frame" are supported at the top level/);
  });

  it("validates split definitions", () => {
    expect(resolveSplitDefinition({ axis: "horizontal", sizes: "260,rest" }, 2)).toEqual({
      axis: "horizontal",
      surface: "card",
      sizes: [{ kind: "fixed", value: 260 }, { kind: "rest" }],
    });

    expect(resolveSplitDefinition({ axis: "vertical", sizes: "auto,rest" }, 2)).toEqual({
      axis: "vertical",
      surface: "card",
      sizes: [{ kind: "auto" }, { kind: "rest" }],
    });

    expect(() =>
      parseWireframe([
        "screen dashboard title=\"Dashboard\" device=browser",
        "  split axis=diagonal",
        "    region label=\"Left\"",
        "    region label=\"Right\"",
      ].join("\n")),
    ).toThrow(/Unsupported split axis/);

    expect(() =>
      parseWireframe([
        "screen dashboard title=\"Dashboard\" device=browser",
        "  split axis=horizontal sizes=\"260\"",
        "    region label=\"Left\"",
        "    region label=\"Right\"",
      ].join("\n")),
    ).toThrow(/Split sizes must provide one entry per child/);
  });

  it("validates surface styles", () => {
    expect(resolveSurfaceStyle()).toBe("card");
    expect(resolveSurfaceStyle("plain")).toBe("plain");
    expect(() => resolveSurfaceStyle("ghost")).toThrow(/Unsupported surface/);
  });

  it("rejects unsupported devices", () => {
    expect(() => resolveDeviceProfile("desktop")).toThrow(/Unsupported device "desktop"/);
    expect(() => resolveDeviceProfile("web")).toThrow(/Unsupported device "web"/);
  });
});
