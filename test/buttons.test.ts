import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe } from "../src/index.js";

function permutations(variants: string[]): string[][] {
  return variants.length === 0 ? [[]] : variants.flatMap((variant, index) =>
    permutations(variants.filter((_, other) => other !== index)).map((rest) => [variant, ...rest]));
}

describe("disabled buttons", () => {
  it("accepts all variant combinations in every order with captioned or bare icons", () => {
    const variants = ["primary", "danger", "link", "focus"];
    for (let mask = 0; mask < 16; mask++) {
      const selected = variants.filter((_, bit) => mask & (1 << bit));
      for (const order of permutations([...selected, "disabled"])) {
        for (const caption of ["Restore", ""]) {
          const parsed = parseWireframe(`frame\n  button.${order.join(".")} ${caption}\n    icon.blue archive`);
          expect(parsed.diagnostics, order.join(".")).toEqual([]);
          const button = renderWireframe(parsed)!.querySelector(".wf-button")!;
          expect([...button.classList]).toEqual(expect.arrayContaining(order.map((variant) => `wf-${variant}`)));
          expect(button.querySelector(".wf-icon")!.getAttribute("aria-hidden")).toBe("true");
          expect(button.querySelector(".wf-button-state")!.textContent).toBe(caption === "" ? "archive, unavailable" : ", unavailable");
        }
      }
    }
  });

  it("keeps one plain caption and state without role, focus, or source markup", () => {
    const parsed = parseWireframe('frame\n  button.disabled Restore\n    icon restore\n  button.link.disabled "<script> `literal`"\n    icon.red archive\n  button.disabled\n    icon dots-vertical\n  button.disabled');
    expect(parsed.diagnostics).toEqual([]);
    const root = renderWireframe(parsed)!;
    expect([...root.querySelectorAll(".wf-button")].map((node) => node.textContent)).toEqual([
      "Restore, unavailable", "<script> `literal`, unavailable", "dots vertical, unavailable", "button, unavailable",
    ]);
    for (const button of root.querySelectorAll(".wf-button")) {
      expect(button.tagName).toBe("SPAN");
      expect(["role", "tabindex", "aria-label", "aria-disabled"].map((name) => button.getAttribute(name))).toEqual([null, null, null, null]);
      expect(button.querySelector(".wf-button-state")!.hasAttribute("aria-hidden")).toBe(false);
    }
    expect(root.querySelector("script, .wf-mono, button, a, [tabindex]")).toBeNull();
  });

  it("retains misplaced children and unknown-icon name boxes", () => {
    const parsed = parseWireframe("frame\n  button.disabled Restore\n    icon pinn\n    text Child");
    expect(parsed.diagnostics.map(({ line, message }) => [line, message])).toEqual([
      [3, 'unknown icon "pinn": expected a Tabler icon name'],
      [4, "text must be directly inside dialog, banner, page, frame, phone, dock, card, row or item"],
    ]);
    const button = renderWireframe(parsed)!.querySelector(".wf-button")!;
    expect(button.querySelector(".wf-icon-unknown")!.textContent).toBe("pinn");
    expect(button.querySelector(".wf-text")!.textContent).toBe("Child");
  });

  it("leaves enabled buttons and their icon alternatives unchanged", () => {
    const root = renderWireframe(parseWireframe("frame\n  button Restore\n    icon.blue archive\n  button.link\n    icon archive"))!;
    expect(root.querySelector(".wf-button-state")).toBeNull();
    expect([...root.querySelectorAll(".wf-icon")].map((icon) => icon.getAttribute("aria-hidden"))).toEqual([null, null]);
    expect([...root.querySelectorAll("svg")].map((icon) => icon.getAttribute("aria-label"))).toEqual(["blue archive", "archive"]);
  });

  it("lists disabled in the exact unknown-variant diagnostic", () => {
    expect(parseWireframe("frame\n  button.x Go").diagnostics).toEqual([
      { line: 2, severity: "warning", message: 'unknown variant ".x" on button: expected .primary, .danger, .link, .focus or .disabled' },
    ]);
  });
});
