import { describe, expect, it } from "vitest";
import { extractWireframeBlocks, parseFenceInfo, parseWireframe, resolveDeviceProfile } from "@wireframe-md/core";

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

  it("parses top-level screens", () => {
    const ast = parseWireframe([
      "screen dashboard title=\"Dashboard\" device=browser",
      "screen detail title=\"Detail\" device=app width=1024 height=640",
    ].join("\n"));

    expect(ast.children).toHaveLength(2);
    expect(ast.children[0].attrs.title).toBe("Dashboard");
    expect(ast.children[1].attrs.width).toBe(1024);
    expect(ast.children[1].attrs.height).toBe(640);
  });

  it("rejects nested content in the screens-only v0", () => {
    expect(() =>
      parseWireframe([
        "screen dashboard title=\"Dashboard\" device=browser",
        "  screen nested title=\"Should fail\"",
      ].join("\n")),
    ).toThrow(/Only top-level screens are supported/);
  });

  it("rejects unsupported devices", () => {
    expect(() => resolveDeviceProfile("desktop")).toThrow(/Unsupported device "desktop"/);
    expect(() => resolveDeviceProfile("web")).toThrow(/Unsupported device "web"/);
  });
});
