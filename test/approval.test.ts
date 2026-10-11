import { describe, expect, it } from "vitest";
import { approvalFingerprint, describeStatus, diffLines, fingerprint, formatMarkup, statusOf } from "../playground/approval.js";
import { getEmbedStyles, parseWireframe, renderWireframe } from "../src/index.js";
import { archivedBanner } from "./samples.js";

const markupOf = (source: string): string => {
  const root = renderWireframe(parseWireframe(source));
  expect(root).not.toBeNull();
  return formatMarkup(root!);
};

describe("formatMarkup", () => {
  it("puts each element on its own line, indented by depth, with text-only elements on one line", () => {
    expect(markupOf(archivedBanner).split("\n")).toEqual([
      '<div class="wf-root">',
      '  <div class="wf-banner wf-warning" data-line="1">',
      '    <span class="wf-icon" data-line="2">',
      '      <svg class="wf-icon-glyph" viewBox="0 0 16 16" aria-hidden="true">',
      '        <path d="M2 3h12v3H2zM3 6v7h10V6M6.5 9h3"></path>',
      "      </svg>",
      "    </span>",
      '    <div class="wf-text" data-line="3">Archived. Read-only and hidden from the document list.</div>',
      '    <div class="wf-row wf-end" data-line="4">',
      '      <span class="wf-button" data-line="5">Restore</span>',
      '      <span class="wf-button wf-link wf-danger" data-line="6">Delete…</span>',
      "    </div>",
      "  </div>",
      "</div>",
    ]);
  });

  it("gives text beside elements its own line", () => {
    expect(markupOf("text Mixed\n  button Inside").split("\n")).toEqual([
      '<div class="wf-root">',
      '  <div class="wf-text" data-line="1">',
      "    Mixed",
      '    <span class="wf-button" data-line="2">Inside</span>',
      "  </div>",
      "</div>",
    ]);
  });

  it("escapes markup, and characters that would break or hide a line", () => {
    // A line separator, a no-break space and a bell.
    const hidden = String.fromCharCode(0x2028, 0xa0, 0x7);
    expect(markupOf(`dialog <b>&"${hidden}</b>`)).toContain(
      '<div class="wf-dialog-title">&lt;b&gt;&amp;&quot;&#x2028;&#xa0;&#x7;&lt;/b&gt;</div>',
    );
  });

  it("changes with the source's line numbers, which the render records", () => {
    expect(markupOf(`\n${archivedBanner}`)).not.toBe(markupOf(archivedBanner));
  });
});

describe("fingerprint", () => {
  it("is sha256: and the stylesheet's hex digest", async () => {
    // The SHA-256 of "abc".
    expect(await fingerprint("abc")).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await fingerprint(getEmbedStyles())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("approvalFingerprint", () => {
  it("covers the source, stylesheet and markup independently", async () => {
    const original = await approvalFingerprint("source", "css", "markup");
    for (const inputs of [["source\n", "css", "markup"], ["source", "changed", "markup"], ["source", "css", "changed"]]) {
      expect(await approvalFingerprint(inputs[0]!, inputs[1]!, inputs[2]!)).not.toBe(original);
    }
    expect(await approvalFingerprint("a", "bc", "d")).not.toBe(await approvalFingerprint("ab", "c", "d"));
  });
});

describe("statusOf", () => {
  const approval = { approved: true, fingerprint: "sha256:1" };
  it("is approved only while the full fingerprint matches", () => {
    expect(statusOf("sha256:1", approval)).toEqual({ state: "approved" });
    expect(statusOf("sha256:2", approval)).toEqual({ state: "changed" });
  });
  it("is unapproved without an approval or with approved false, and an error without a render", () => {
    expect(statusOf("sha256:1", null)).toEqual({ state: "unapproved" });
    expect(statusOf("sha256:1", { ...approval, approved: false })).toEqual({ state: "unapproved" });
    expect(statusOf(null, approval)).toEqual({ state: "error" });
  });
  it("describes every state", () => {
    expect(describeStatus({ state: "approved" })).toBe("Approved");
    expect(describeStatus({ state: "unapproved" })).toBe("Not yet approved");
    expect(describeStatus({ state: "error" })).toBe("Has errors");
    expect(describeStatus({ state: "changed" })).toBe("Changed since approval");
  });
});

describe("diffLines", () => {
  it("marks the lines only one side has", () => {
    const { before, after } = diffLines("a\nb\nc\nd", "a\nc\nx\nd");
    expect(before.map((line) => line.changed)).toEqual([false, true, false, false]);
    expect(after.map((line) => line.changed)).toEqual([false, false, true, false]);
    expect(after.map((line) => line.text)).toEqual(["a", "c", "x", "d"]);
  });

  it("marks nothing in equal texts and everything in disjoint ones", () => {
    expect(diffLines("a\nb", "a\nb").after.some((line) => line.changed)).toBe(false);
    expect(diffLines("a", "b").before.every((line) => line.changed)).toBe(true);
  });
});
