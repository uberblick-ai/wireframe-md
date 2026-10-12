import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

describe("phone", () => {
  it("accepts an optional id and everything a page holds, using the same placements", () => {
    const content = '\n  text.title General\n  input label=Name Uberblick\n  select label=Role Editor\n  toggle\n    option.current One\n  row.end\n    text.small Hint\n    button Save\n      icon check\n    chip web\n  divider\n  card\n    text Note\n  table\n    row.head\n      cell.sortable Name\n    row\n      cell Workspace\n  icon settings';
    const parsed = parseWireframe(`phone#settings${content}`);
    expect(parsed.diagnostics).toEqual([]);
    expect(parseWireframe(`page${content}`).diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    const phone = root.querySelector(".wf-phone")!;
    expect(phone.getAttribute("data-line")).toBe("1");
    expect(phone.querySelector(".wf-phone-content")!.children).toHaveLength(9);
    expect(phone.querySelector(".wf-field-label")!.textContent).toBe("Name");
    expect(phone.querySelector(".wf-divider")!.getAttribute("role")).toBe("separator");
    const viewport = phone.querySelector(".wf-phone-viewport")!;
    for (const selector of [".wf-phone-status", ".wf-phone-home"]) {
      const decoration = phone.querySelector(selector)!;
      expect(decoration.getAttribute("aria-hidden")).toBe("true");
      expect(viewport.contains(decoration)).toBe(false);
      expect(decoration.querySelector("[data-line]")).toBeNull();
    }
    expect(phone.querySelector(".wf-phone-time")!.textContent).toBe("9:41");
    expect([...phone.querySelectorAll(".wf-phone-indicators svg")].map((svg) => svg.getAttribute("aria-label")))
      .toEqual(["antenna bars 5", "wifi", "battery 4"]);
    expect(phone.querySelectorAll(".wf-phone-indicators .wf-icon-outline")).toHaveLength(3);
    expect(phone.querySelector(".wf-phone-island")!.childNodes).toHaveLength(0);
    expect(phone.querySelector(".wf-phone-home-indicator")!.childNodes).toHaveLength(0);
    expect(root.querySelector("[id], [style], [tabindex], a, button, input, script")).toBeNull();
  });

  it.each([...KINDS.keys(), "unknown"])("warns about a phone inside %s and still draws its screen", (kind) => {
    const parsed = parseWireframe(`${kind}\n  phone\n    text General`);
    expect(parsed.renderable).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.line === 2)).toEqual([
      { line: 2, severity: "warning", message: "phone must be at the top level" },
    ]);
    expect(renderWireframe(parsed)!.querySelector('.wf-phone[data-line="2"] .wf-phone-content')!.textContent).toBe("General");
  });

  it("warns about unsupported syntax, retains source text and ignores attributes", () => {
    const parsed = parseWireframe('phone.x label=Hidden width=200 model=small <script>\n  text Child');
    expect(parsed.diagnostics).toEqual([
      { line: 1, severity: "warning", message: 'unknown variant ".x": phone takes no variants' },
      { line: 1, severity: "warning", message: 'attribute "label" is only allowed on input or select' },
      { line: 1, severity: "warning", message: 'attribute "width" is only allowed on page, card or image' },
      { line: 1, severity: "warning", message: 'unknown attribute "model": expected label on input or select, or width on page, card or image (quote a label that starts with word=)' },
      { line: 1, severity: "warning", message: "phone takes no label" },
    ]);
    const root = renderWireframe(parsed)!;
    expect(root.querySelector(".wf-phone-content")!.textContent).toBe("<script>Child");
    expect(root.querySelector("[style], .wf-x, script")).toBeNull();
  });

  it("keeps other roots' top-level warnings and draws them inside the screen", () => {
    const parsed = parseWireframe('phone\n  banner\n    text Warning\n  dialog Confirm\n    text Body');
    expect(parsed.diagnostics).toEqual([
      { line: 2, severity: "warning", message: "banner must be at the top level" },
      { line: 4, severity: "warning", message: "dialog must be at the top level" },
    ]);
    const screen = renderWireframe(parsed)!.querySelector(".wf-phone-screen")!;
    expect(screen.querySelector(".wf-banner")!.textContent).toBe("Warning");
    expect(screen.querySelector(".wf-dialog")!.textContent).toBe("ConfirmBody");
  });

  it("names the first direct text like a page, and has a bare summary without text", () => {
    for (const [source, expected] of [
      ["phone\n  text.title General", "Wireframe: phone “General”"],
      ["phone\n  text First\n  text.title Second", "Wireframe: phone “First”"],
      ["phone\n  row\n    text Nested", "Wireframe: phone"],
      ["phone", "Wireframe: phone"],
    ]) expect(summarizeWireframe(parseWireframe(source!))).toBe(expected);
  });
});
