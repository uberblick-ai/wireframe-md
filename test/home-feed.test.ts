import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWireframe, renderWireframe, summarizeWireframe } from "../src/index.js";
import { KINDS } from "../src/vocabulary.js";

const home = readFileSync(join(import.meta.dirname, "../examples/phones/1-screens/home-feed.wireframe"), "utf8");
const warnings = (source: string): string[] => parseWireframe(source).diagnostics.map((d) => `${d.line}: ${d.message}`);
const render = (source: string): HTMLElement => renderWireframe(parseWireframe(source))!;

describe("home screen vocabulary", () => {
  it("parses the exact home example without warnings and keeps its bare summary", () => {
    const parsed = parseWireframe(home);
    expect(parsed.diagnostics).toEqual([]);
    expect(summarizeWireframe(parsed)).toBe("Wireframe: phone");
    const root = renderWireframe(parsed)!;
    expect(root.querySelectorAll(".wf-image")).toHaveLength(10);
    expect(root.querySelectorAll(".wf-row.wf-scroll")).toHaveLength(2);
    expect(root.querySelector(".wf-phone-viewport > .wf-dock > .wf-toggle")!.children).toHaveLength(4);
    expect(root.querySelector("a, button, input, script, [tabindex], [onclick], [src], [href]")).toBeNull();
  });

  it("gives images their label alternative and a decorative bundled mark", () => {
    const root = render('page\n  image <script>\n  image\n  image.round Avatar');
    expect([...root.querySelectorAll(".wf-image")].map((node) => [node.getAttribute("role"), node.getAttribute("aria-label")])).toEqual([
      ["img", "<script>"], ["img", "image"], ["img", "Avatar"],
    ]);
    expect(root.querySelector(".wf-image-caption")!.textContent).toBe("<script>");
    for (const mark of root.querySelectorAll(".wf-image svg")) {
      expect(mark.getAttribute("aria-hidden")).toBe("true");
      expect(mark.hasAttribute("aria-label")).toBe(false);
      expect(mark.hasAttribute("role")).toBe(false);
    }
    expect(root.querySelector("script")).toBeNull();
  });

  it.each(["page", "card", "image"])("validates invalid, repeated and unknown attributes on %s", (kind) => {
    const prefix = kind === "image" ? "page\n  " : "";
    const line = kind === "image" ? 2 : 1;
    expect(warnings(`${prefix}${kind} width=0 width=256`)).toEqual([
      `${line}: invalid width "0": expected a whole number of pixels from 1 to 9999, such as width=240`,
      `${line}: repeated attribute "width": the first value is used`,
    ]);
    expect(render(`${prefix}${kind} width=0 width=256`).querySelector("[style]")).toBeNull();
    expect(warnings(`${prefix}${kind} height=50`)).toEqual([
      `${line}: unknown attribute "height": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)`,
    ]);
  });

  it.each(["card", "image"])("sets only validated pixel styles on %s", (kind) => {
    for (const width of ["1", "96", "9999"]) {
      expect(render(`page\n  ${kind} width=${width}`).querySelector<HTMLElement>(`.wf-${kind}`)!.style.getPropertyValue("--_wf-width")).toBe(`${width}px`);
    }
    for (const width of ["240px", "1.5", "-1", "10000", "url(evil)", "0"]) {
      expect(render(`page\n  ${kind} width=${width}`).querySelector("[style]")).toBeNull();
    }
  });

  it("uses the first layout and shape and warns at each source line", () => {
    const source = 'phone\n  row.between.scroll.end\n    image.round.square Avatar\n  row.scroll.end\n    card\n      image.square.round Cover';
    expect(warnings(source)).toEqual([
      "2: row takes one of .end, .between or .scroll: the first is used",
      "3: image takes one of .square or .round: the first is used",
      "4: row takes one of .end, .between or .scroll: the first is used",
      "6: image takes one of .square or .round: the first is used",
    ]);
    const root = render(source);
    expect([...root.querySelectorAll(".wf-row")].map((node) => node.className)).toEqual(["wf-row wf-between", "wf-row wf-scroll"]);
    expect([...root.querySelectorAll(".wf-image")].map((node) => node.className)).toEqual(["wf-image wf-round", "wf-image wf-square"]);
    expect(warnings("page\n  table\n    row.between\n      cell One\n    row.scroll\n      cell Two")).toEqual([
      "3: row.between must be directly inside dialog, banner, page, frame, phone, dock or card",
      "5: row.scroll must be directly inside dialog, banner, page, frame, phone, dock or card",
    ]);
  });

  it("lists the new image and row variants in unknown-variant warnings", () => {
    expect(warnings("page\n  image.wide Cover\n  row.start")).toEqual([
      '2: unknown variant ".wide" on image: expected .square or .round',
      '3: unknown variant ".start" on row: expected .end, .between, .scroll, .stretch or .head',
    ]);
  });

  it("warns about dock placement, last children and unsupported syntax while retaining source", () => {
    expect(warnings("dock.x Label\n  text Body")).toEqual([
      '1: unknown variant ".x": dock takes no variants',
      "1: dock takes no label",
      "1: dock must be directly inside phone",
    ]);
    for (const kind of [...KINDS.keys(), "unknown"]) {
      if (kind === "phone") continue;
      expect(warnings(`${kind}\n  dock`)).toContain("2: dock must be directly inside phone");
      expect(render(`${kind}\n  dock\n    text Body`).querySelector(".wf-dock")!.textContent).toBe("Body");
    }
    const source = 'phone\n  dock\n    text Early\n  dock\n    text Late';
    expect(warnings(source)).toEqual(["2: dock must be its phone's last child"]);
    const root = render(source);
    expect(root.querySelector(".wf-phone-content > .wf-dock")!.textContent).toBe("Early");
    expect(root.querySelector(".wf-phone-viewport > .wf-dock")!.textContent).toBe("Late");
    expect(warnings("phone\n  dock\n  text After")).toEqual(["2: dock must be its phone's last child"]);
  });

  it("accepts the phone vocabulary inside a dock and the new card places", () => {
    const contents = '\n  text Title\n  image Art\n  icon home\n  input Hint\n  select Choice\n  toggle\n    option.current Home\n      icon home\n  divider\n  table\n    row\n      cell One\n  card\n    row\n      image.square Cover\n      text Caption\n      card width=100\n        text Nested';
    expect(parseWireframe(`phone${contents}`).diagnostics).toEqual([]);
    expect(parseWireframe(`phone\n  dock${contents.replaceAll("\n", "\n  ")}`).diagnostics).toEqual([]);
  });

  it("warns about misplaced images and icons, listing their allowed places", () => {
    expect(warnings("image Cover")).toEqual(["1: image must be directly inside dialog, banner, page, frame, phone, dock, card or row"]);
    expect(warnings("page\n  toggle\n    image Cover")).toEqual(["3: image must be directly inside dialog, banner, page, frame, phone, dock, card or row"]);
    expect(warnings("page\n  table\n    row\n      image Cover")).toEqual(["4: image in a table row: expected cell"]);
    expect(warnings("page\n  card\n    icon home")).toEqual(["3: icon must be directly inside dialog, banner, page, frame, phone, dock, cell, button or option"]);
    expect(render("image Cover").querySelector(".wf-image")!.getAttribute("aria-label")).toBe("Cover");
  });

  it("draws all option icons before its caption and warns about a second", () => {
    const source = 'phone\n  dock\n    toggle\n      option.current Home\n        icon home\n        icon.red bell';
    expect(warnings(source)).toEqual(["6: option takes only one icon"]);
    const option = render(source).querySelector(".wf-option")!;
    expect([...option.children].map((child) => child.className)).toEqual(["wf-icon", "wf-icon wf-red", "wf-option-caption"]);
    expect(option.lastChild!.textContent).toBe("Home");
  });
});
