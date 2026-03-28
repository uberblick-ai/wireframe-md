import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { decodeWireframeBlockOptions, installWireframeMarkdownParser, serializeWireframeMarkdown } from "@wireframe-md/markdown-it";

describe("markdown-it wireframe helpers", () => {
  it("serializes source to a wireframe fenced code block", () => {
    expect(serializeWireframeMarkdown("screen shell", { boxWidth: 1280, boxHeight: 820 })).toBe([
      "```wireframe[1280x820]",
      "screen shell",
      "```",
    ].join("\n"));
  });

  it("registers markdown-it wireframe parser and renderer", () => {
    const md = new MarkdownIt();
    installWireframeMarkdownParser(md);

    const rendered = md.render([
      "```wireframe[1280x820]",
      "screen lookbook title=\"Lookbook\" device=browser",
      "```",
    ].join("\n"));

    expect(rendered).toContain("<wireframe-md-block");

    const sourceMatch = rendered.match(/data-source="([^"]*)"/);
    expect(sourceMatch).toBeTruthy();
    expect(decodeURIComponent(sourceMatch[1])).toBe("screen lookbook title=\"Lookbook\" device=browser");

    const optionsMatch = rendered.match(/data-options="([^"]*)"/);
    expect(optionsMatch).toBeTruthy();
    expect(decodeWireframeBlockOptions(optionsMatch[1])).toEqual({ boxWidth: 1280, boxHeight: 820 });
  });

  it("is idempotent when installed twice", () => {
    const md = new MarkdownIt();
    installWireframeMarkdownParser(md);
    installWireframeMarkdownParser(md);

    const rendered = md.render("```wireframe\nscreen lookbook\n```");
    expect(rendered.match(/<wireframe-md-block/g)).toHaveLength(1);
  });

  it("does not intercept non-wireframe fenced blocks", () => {
    const md = new MarkdownIt();
    installWireframeMarkdownParser(md);

    const rendered = md.render("```ruby\nputs 'hello'\n```");
    expect(rendered).not.toContain("<wireframe-md-block");
    expect(rendered).toContain("<code");
  });

  it("handles tilde fences", () => {
    const md = new MarkdownIt();
    installWireframeMarkdownParser(md);

    const rendered = md.render("~~~wireframe[x400]\nscreen detail\n~~~");
    const optionsMatch = rendered.match(/data-options="([^"]*)"/);

    expect(rendered).toContain("<wireframe-md-block");
    expect(decodeWireframeBlockOptions(optionsMatch[1])).toEqual({ boxWidth: null, boxHeight: 400 });
  });
});
