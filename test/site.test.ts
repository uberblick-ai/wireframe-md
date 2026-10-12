import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import * as renderer from "../src/index.js";
import { type Approval, fingerprint } from "../playground/approval.js";
import { type Example, refreshFingerprint } from "../playground/editor.js";
import { manifest, type Section } from "../site/manifest.js";
import { type Approvals, generateShowcase, parseApprovals, type Renderer } from "../site/showcase.js";

const ID = "dialogs/basic/confirmation";
const SOURCE = "dialog Continue?\n  text Review your changes.\n  row.end\n    button Cancel\n    button.primary Continue\n";
const sections: Section[] = [{ id: "dialogs", title: "Dialogs", description: "Confirmations", examples: [ID] }];
const examplesDirectory = fileURLToPath(new NodeURL("../examples/", import.meta.url));

/** Fixture approvals produced through the same browser-side path as Approve. */
async function approval(source = SOURCE): Promise<Approval> {
  const example: Example = { name: ID, source, approval: null, fingerprint: null };
  await refreshFingerprint(example, await fingerprint(renderer.getEmbedStyles()));
  return { approved: true, fingerprint: example.fingerprint! };
}

function build(options: {
  source?: string;
  approvals?: Approvals;
  preview?: boolean;
  renderer?: Renderer;
  sections?: readonly Section[];
  readSource?: (id: string) => string | null;
} = {}): Promise<string> {
  return generateShowcase({
    sections: options.sections ?? sections,
    readSource: options.readSource ?? (() => options.source ?? SOURCE),
    approvals: options.approvals ?? {},
    renderer: options.renderer ?? renderer,
    document,
    preview: options.preview ?? false,
  });
}

describe("showcase approval gate (fixture approvals only)", () => {
  it("accepts an unchanged example approved through the playground path", async () => {
    const html = await build({ approvals: { [ID]: await approval() } });
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelectorAll(".wf-root")).toHaveLength(2);
    expect(page.querySelector(".showcase-source code")?.textContent).toBe(SOURCE);
    expect(page.querySelector(".showcase-preview, .showcase-status")).toBeNull();
    expect(page.querySelector('link[href="https://uberblick.ai/shared.css"]')).not.toBeNull();
    expect(page.querySelectorAll("script, [onclick], [onerror], form, input, button")).toHaveLength(0);
  });

  it("rejects absent and explicitly withdrawn approvals", async () => {
    await expect(build()).rejects.toThrow(`${ID}: Not yet approved`);
    await expect(build({ approvals: { [ID]: { ...await approval(), approved: false } } })).rejects.toThrow(`${ID}: Not yet approved`);
  });

  it("requires another approval after the source, stylesheet or rendered markup changes", async () => {
    const approvals = { [ID]: await approval() };
    await expect(build({ approvals, source: `${SOURCE}\n` })).rejects.toThrow(`${ID}: Changed since approval`);
    await expect(build({ approvals, renderer: { ...renderer, getEmbedStyles: () => `${renderer.getEmbedStyles()}\n` } })).rejects.toThrow(`${ID}: Changed since approval`);
    await expect(build({ approvals, renderer: {
      ...renderer,
      renderWireframe: (result, doc) => {
        const root = renderer.renderWireframe(result, doc);
        root?.setAttribute("data-render-change", "true");
        return root;
      },
    } })).rejects.toThrow(`${ID}: Changed since approval`);
  });

  it("names all missing, erroneous, unapproved and changed ids in the same failure", async () => {
    const ids = ["dialogs/basic/missing", "dialogs/basic/error", "dialogs/basic/unapproved", "dialogs/basic/changed"];
    const problemSections = [{ ...sections[0]!, examples: ids }];
    const run = build({
      sections: problemSections,
      readSource: (id) => id.endsWith("missing") ? null : id.endsWith("error") ? 'dialog "Unclosed' : SOURCE,
      approvals: { "dialogs/basic/changed": await approval(`${SOURCE}\n`) },
    });
    await expect(run).rejects.toThrow(/missing: missing example\n.*error: has errors; Line 1:.*\n.*unapproved: Not yet approved\n.*changed: Changed since approval/);
  });

  it("never approves a failed render, even if the source was valid", async () => {
    await expect(build({ renderer: { ...renderer, renderWireframe: () => null }, approvals: { [ID]: await approval() } })).rejects.toThrow(`${ID}: has errors`);
  });

  it("preview marks unapproved and changed examples, and identifies itself", async () => {
    const html = await build({ preview: true });
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelector(".showcase-preview")?.textContent).toContain("Preview for review");
    expect(page.querySelector('.showcase-status[data-status="unapproved"]')?.textContent).toContain(ID);
    expect(page.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(await build({ preview: true, approvals: { [ID]: await approval(`${SOURCE}\n`) } })).toContain('data-status="changed"');
    await expect(build({ preview: true, readSource: () => null })).rejects.toThrow(`${ID}: missing example`);
    await expect(build({ preview: true, source: 'dialog "Unclosed' })).rejects.toThrow(`${ID}: has errors`);
  });

  it("escapes source and accessible labels and keeps source warnings visible", async () => {
    const source = 'dialog "<script>alert(1)</script> & test"\n  mystery "<img src=x onerror=alert(1)>"';
    const page = new DOMParser().parseFromString(await build({ source, preview: true }), "text/html");
    expect(page.querySelector(".showcase-source code")?.textContent).toBe(source);
    expect(page.querySelector(".showcase-diagnostics")?.textContent).toContain("Line 2");
    expect(page.querySelectorAll("script, img, [onerror]")).toHaveLength(0);
    expect(page.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("<script>");
  });

  it("refuses invalid ids before reading source and refuses duplicates", async () => {
    let read = false;
    await expect(build({
      sections: [{ ...sections[0]!, examples: ["../outside"] }],
      readSource: () => { read = true; return SOURCE; },
    })).rejects.toThrow("../outside: invalid example id");
    expect(read).toBe(false);
    await expect(build({ preview: true, sections: [{ ...sections[0]!, examples: [ID, ID] }] })).rejects.toThrow(`${ID}: listed more than once`);
  });

  it("reads the playground mapping shape and never accepts malformed entries", () => {
    const valid = { approved: true, fingerprint: `sha256:${"a".repeat(64)}`, markup: "snapshot", stylesheet: "snapshot" };
    expect(parseApprovals(JSON.stringify({ [ID]: valid, bad: { approved: "true", fingerprint: valid.fingerprint }, invalid: { approved: true, fingerprint: "x" } }))).toEqual({ [ID]: valid });
    expect(parseApprovals("{}")).toEqual({});
    expect(() => parseApprovals("[]")).toThrow("Expected an approval mapping");
    expect(() => parseApprovals("{")).toThrow();
  });
});

describe("real showcase manifest (independent of real approvals)", () => {
  const ids = manifest.flatMap((section) => section.examples);
  it("curates 10–20 unique examples across all six sections and at least two full pages", () => {
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids.length).toBeLessThanOrEqual(20);
    expect(new Set(ids).size).toBe(ids.length);
    expect(manifest.map((s) => s.id)).toEqual(["dialogs", "banners", "forms", "tables", "blocks", "pages"]);
    expect(manifest.every((s) => s.examples.length > 0)).toBe(true);
    const pages = manifest.find((s) => s.id === "pages")!.examples;
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages).toContain("pages/uberblick/document-list");
  });

  it.each(ids)("%s exists and renders without errors", (id) => {
    const source = readFileSync(join(examplesDirectory, `${id}.wireframe`), "utf8");
    const result = renderer.parseWireframe(source);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(renderer.renderWireframe(result)).not.toBeNull();
  });

  it("prerenders both schemes in manifest order with working section navigation", async () => {
    const html = await build({ sections: manifest, preview: true, readSource: (id) => readFileSync(join(examplesDirectory, `${id}.wireframe`), "utf8") });
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelectorAll(".wf-root")).toHaveLength(ids.length * 2);
    expect([...page.querySelectorAll(".showcase-status code")].map((code) => code.textContent)).toEqual(ids);
    for (const section of manifest) {
      expect(page.querySelector(`.showcase-nav a[href="#${section.id}"]`)).not.toBeNull();
      expect(page.getElementById(section.id)).not.toBeNull();
    }
  });
});
