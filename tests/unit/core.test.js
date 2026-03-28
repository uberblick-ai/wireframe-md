import { describe, expect, it } from "vitest";
import { ELEMENT_DEFINITIONS, compileWireframe, extractWireframeBlocks, formatWireframeFenceInfo, normalizeRenderBox, parseFenceInfo, parseWireframe, resolveDeviceProfile, resolveSplitDefinition, resolveSurfaceStyle } from "@wireframe-md/core";

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

  it("exposes a central element registry", () => {
    expect(Object.keys(ELEMENT_DEFINITIONS)).toEqual(["screen", "frame", "split", "region", "tree", "group", "item", "stack", "props", "prop", "code_block", "code_line"]);
    expect(ELEMENT_DEFINITIONS.screen.allowedChildren).toEqual(["split", "region"]);
    expect(ELEMENT_DEFINITIONS.split.attributes.sizes.defaultValue).toBeUndefined();
    expect(ELEMENT_DEFINITIONS.region.allowedChildren).toEqual(["split", "tree", "stack", "props", "code_block"]);
    expect(ELEMENT_DEFINITIONS.region.attributes.show_label.defaultValue).toBe(true);
    expect(ELEMENT_DEFINITIONS.tree.allowedChildren).toEqual(["group", "item"]);
    expect(ELEMENT_DEFINITIONS.stack.allowedChildren).toEqual(["tree", "stack", "props", "code_block"]);
    expect(ELEMENT_DEFINITIONS.props.allowedChildren).toEqual(["prop"]);
    expect(ELEMENT_DEFINITIONS.code_block.allowedChildren).toEqual(["code_line"]);
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

  it("parses a static tree inside a region", () => {
    const ast = parseWireframe([
      "screen lookbook title=\"Lookbook\" device=browser",
      "  split axis=horizontal sizes=\"280,rest\" surface=plain",
      "    region label=\"Sidebar\" surface=plain",
      "      tree",
      "        group label=\"Layout\"",
      "          item label=\"Screen\"",
      "          item label=\"Frame\" selected=true",
      "        group label=\"Examples\" expanded=false",
      "          item label=\"Lookbook\"",
      "    region label=\"Preview\"",
    ].join("\n"));

    const sidebar = ast.children[0].children[0].children[0];

    expect(sidebar.kind).toBe("region");
    expect(sidebar.children[0].kind).toBe("tree");
    expect(sidebar.children[0].children[0].kind).toBe("group");
    expect(sidebar.children[0].children[0].children[1].attrs.selected).toBe(true);
    expect(sidebar.children[0].children[1].attrs.expanded).toBe(false);
  });

  it("compiles raw nodes into a normalized model for renderers", () => {
    const ast = compileWireframe([
      "screen lookbook title=\"Lookbook\" device=browser surface=plain url=\"https://wireframe.md/lookbook\"",
      "  split axis=vertical sizes=\"auto,rest\" surface=plain",
      "    region label=\"Top Bar\" surface=plain placeholder=false",
      "    region label=\"Preview\"",
    ].join("\n"));

    expect(ast.children[0]).toMatchObject({
      kind: "screen",
      title: "Lookbook",
      surface: "plain",
      device: "browser",
      url: "https://wireframe.md/lookbook",
      child: {
        kind: "split",
        axis: "vertical",
        surface: "plain",
        sizes: [{ kind: "auto" }, { kind: "rest" }],
        children: [
          { kind: "region", label: "Top Bar", surface: "plain", placeholder: false },
          { kind: "region", label: "Preview", surface: "card", placeholder: true },
        ],
      },
    });
  });

  it("compiles region label visibility as an explicit flag", () => {
    const ast = compileWireframe([
      "frame sidebar title=\"Elements\" width=320 height=420 surface=plain",
      "  region label=\"Sidebar\" surface=plain show_label=false",
      "    tree",
      "      item label=\"Tree\" selected=true",
    ].join("\n"));

    expect(ast.children[0]).toMatchObject({
      kind: "frame",
      child: {
        kind: "region",
        label: "Sidebar",
        showLabel: false,
      },
    });
  });

  it("compiles tree/group/item content inside regions", () => {
    const ast = compileWireframe([
      "frame sidebar title=\"Elements\" width=320 height=420 surface=plain",
      "  region label=\"Catalog\" surface=plain",
      "    tree",
      "      group label=\"Layout\"",
      "        item label=\"Split\"",
      "        item label=\"Tree\" selected=true",
    ].join("\n"));

    expect(ast.children[0]).toMatchObject({
      kind: "frame",
      title: "Elements",
      child: {
        kind: "region",
        label: "Catalog",
        surface: "plain",
        child: {
          kind: "tree",
          children: [
            {
              kind: "group",
              label: "Layout",
              children: [
                { kind: "item", label: "Split", selected: false },
                { kind: "item", label: "Tree", selected: true },
              ],
            },
          ],
        },
      },
    });
  });

  it("parses stack, props, and code block content inside a region", () => {
    const ast = parseWireframe([
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

    const stack = ast.children[0].children[0].children[0];

    expect(stack.kind).toBe("stack");
    expect(stack.attrs.gap).toBe(16);
    expect(stack.children[0].kind).toBe("props");
    expect(stack.children[0].children[0].kind).toBe("prop");
    expect(stack.children[1].kind).toBe("code_block");
    expect(stack.children[1].children[0].kind).toBe("code_line");
  });

  it("compiles stack, props, and code blocks into normalized content nodes", () => {
    const ast = compileWireframe([
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

    expect(ast.children[0]).toMatchObject({
      kind: "frame",
      child: {
        kind: "region",
        child: {
          kind: "stack",
          gap: 16,
          children: [
            {
              kind: "props",
              children: [
                { kind: "prop", key: "device", value: "browser" },
                { kind: "prop", key: "surface", value: "plain" },
              ],
            },
            {
              kind: "code_block",
              language: "wireframe",
              children: [
                { kind: "code_line", value: "screen lookbook title=\"Lookbook\" device=browser" },
                { kind: "code_line", value: "  region label=\"Preview\"" },
              ],
            },
          ],
        },
      },
    });
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

  it("rejects tree nodes outside regions", () => {
    expect(() =>
      parseWireframe([
        "screen lookbook title=\"Lookbook\" device=browser",
        "  tree",
        "    item label=\"Screen\"",
      ].join("\n")),
    ).toThrow(/Only "split" and "region" are supported inside "screen"/);
  });

  it("rejects non-tree content inside a tree group", () => {
    expect(() =>
      parseWireframe([
        "screen lookbook title=\"Lookbook\" device=browser",
        "  region label=\"Sidebar\"",
        "    tree",
        "      group label=\"Layout\"",
        "        region label=\"Invalid\"",
      ].join("\n")),
    ).toThrow(/Only "group" and "item" are supported inside "group"/);
  });

  it("rejects prop nodes outside props", () => {
    expect(() =>
      parseWireframe([
        "frame inspect title=\"Inspect\"",
        "  region label=\"Inspector\"",
        "    prop key=\"device\" value=\"browser\"",
      ].join("\n")),
    ).toThrow(/Only "split" and "tree" and "stack" and "props" and "code_block" are supported inside "region"/);
  });

  it("rejects code lines outside code blocks", () => {
    expect(() =>
      parseWireframe([
        "frame inspect title=\"Inspect\"",
        "  region label=\"Inspector\"",
        "    stack",
        "      code_line \"screen lookbook\"",
      ].join("\n")),
    ).toThrow(/Only "tree" and "stack" and "props" and "code_block" are supported inside "stack"/);
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
