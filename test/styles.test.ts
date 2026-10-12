import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEmbedStyles } from "../src/index.js";
import { ROOT_CLASS } from "../src/render.js";
import { PROPERTIES } from "./samples.js";

interface Rule {
  selectors: string[];
  declarations: [property: string, value: string][];
}

/** Split on commas and semicolons outside parentheses. */
const split = (text: string, separator: string): string[] => {
  const parts = [""];
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === separator && depth === 0) parts.push("");
    else parts[parts.length - 1] += char;
  }
  return parts.map((part) => part.trim()).filter((part) => part !== "");
};

// Extract style rules, including those inside the image's size container query.
const css = getEmbedStyles().replace(/\/\*[\s\S]*?\*\//g, "");
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
  selectors: split(selectors!, ","),
  declarations: split(body!, ";").map((declaration) => {
    const colon = declaration.indexOf(":");
    return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
  }),
}));
const root = rules.find((rule) => rule.selectors.join() === `.${ROOT_CLASS}`)!;
const declarations = rules.flatMap((rule) => rule.declarations);
const publicDeclarations = root.declarations.filter(([property]) => property.startsWith("--_wf-"));

describe("getEmbedStyles", () => {
  it("returns the same stylesheet with only the image size container query", () => {
    expect(getEmbedStyles()).toBe(getEmbedStyles());
    expect(css.match(/@[^ {][^{]*/g)).toEqual(["@container (min-width: 80px) "]);
    expect(rules).toHaveLength(css.split("{").length - 2);
    expect(rules.length).toBeGreaterThan(20);
  });

  it("puts every selector under the root class", () => {
    for (const { selectors } of rules) {
      // The root itself, which may be :empty, or something inside it.
      for (const selector of selectors) expect(selector).toMatch(/^\.wf-root(?=$|:empty$|[\s>])/);
    }
  });

  it("styles no html, body, :root or bare element", () => {
    for (const { selectors } of rules) {
      for (const selector of selectors) {
        expect(selector).not.toMatch(/:root|(^|[\s>+~(,])[a-z]/i);
      }
    }
  });

  it("loads nothing and changes font family only on inline mono spans", () => {
    expect(css).not.toMatch(/url\(|@import|expression\(|javascript:/i);
    expect(declarations.some(([property]) => property === "font")).toBe(false);
    const fonts = rules.filter((rule) => rule.declarations.some(([property]) => property === "font-family"));
    expect(fonts).toEqual([{
      selectors: [".wf-root .wf-mono"],
      declarations: [["font-family", "var(--_wf-mono-font)"]],
    }]);
  });

  it("reads each public property, with a default", () => {
    const read = publicDeclarations.map(([property, value]) => {
      const name = property.slice("--_wf-".length);
      expect(value).toMatch(new RegExp(`^var\\(--wf-${name}, .+\\)$`));
      return `--wf-${name}`;
    });
    expect(read).toEqual([...PROPERTIES].sort((a, b) => read.indexOf(a) - read.indexOf(b)));
    expect(new Set(read)).toEqual(new Set(PROPERTIES));
    // Only the root reads them; every other rule uses the private copies.
    expect(css.match(/var\(--wf-/g)).toHaveLength(PROPERTIES.length);
  });

  it("lists every property in the README with its defaults", () => {
    // A path, as jsdom's URL is not one Node's fs accepts.
    const readme = readFileSync(join(import.meta.dirname, "../README.md"), "utf8");
    // Rows of the theming tables: | `--wf-name` | what it controls | `light` | `dark` |, or one default for both.
    const documented = new Map(
      readme
        .split("\n")
        .filter((line) => line.startsWith("| `--wf-"))
        .map((line) => {
          const [name, , ...defaults] = line
            .slice(2, -2)
            .split(" | ")
            .map((cell) => cell.replace(/^`|`$/g, ""));
          return [name!, defaults];
        }),
    );
    const scheme = (value: string, index: number): string =>
      value.replace(/light-dark\((.*)\)/, (_, pair: string) => split(pair, ",")[index]!);
    for (const [property, value] of publicDeclarations) {
      const name = `--wf-${property.slice("--_wf-".length)}`;
      const fallback = /^var\(--wf-[a-z-]+, (.+)\)$/.exec(value)![1]!;
      const [light, dark = light] = documented.get(name) ?? [];
      expect([light, dark], name).toEqual([scheme(fallback, 0), scheme(fallback, 1)]);
    }
    expect([...documented.keys()].sort()).toEqual([...PROPERTIES].sort());
  });

  it("gives every colour a light and a dark default", () => {
    const sizes = ["stroke", "focus-width", "radius", "radius-lg", "text-size", "title-size", "mono-font"];
    for (const [property, value] of publicDeclarations) {
      const name = property.slice("--_wf-".length);
      if (sizes.includes(name)) expect(value).not.toContain("light-dark(");
      else expect(value).toMatch(/light-dark\(.+, .+\)/);
    }
  });

  it("uses every property it reads", () => {
    for (const [property] of publicDeclarations) {
      expect(declarations.some(([, value]) => value.includes(`var(${property})`))).toBe(true);
    }
  });

  it("takes every colour, stroke, radius and type size from a property", () => {
    const literalColour = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(red|white|black|gr[ae]y)\b/i;
    const sized = /^(font-size|border|border-width|border-radius|outline|outline-offset|outline-width|stroke-width|box-shadow)$/;
    for (const rule of rules) {
      if (rule === root) continue;
      for (const [property, value] of rule.declarations) {
        if (property.startsWith("--")) continue;
        expect(value, `${property}: ${value}`).not.toMatch(literalColour);
        if (property === "border-radius" && rule.selectors.includes(".wf-root .wf-image.wf-round")) {
          expect(value).toBe("50%"); // A circle's geometry is independent of theme radii.
        } else if (property === "border-width" && rule.selectors.includes(".wf-root .wf-card.wf-sized")) {
          expect(value).toBe("0");
        } else if (sized.test(property)) expect(value, `${property}: ${value}`).toMatch(/^(var\(--_wf-|(?:calc|min|inset)\b.*var\(--_wf-)/);
      }
    }
    for (const [property, value] of root.declarations) {
      if (!property.startsWith("--")) expect(value, `${property}: ${value}`).not.toMatch(literalColour);
    }
  });

  it("resets the text styles a host passes down", () => {
    const reset = Object.fromEntries(root.declarations);
    expect(reset).toMatchObject({
      color: "var(--_wf-ink)",
      "font-size": "var(--_wf-text-size)",
      "font-style": "normal",
      "font-weight": "400",
      "line-height": "1.4",
      "letter-spacing": "normal",
      "text-align": "start",
      "text-indent": "0",
      "text-transform": "none",
      "white-space": "normal",
      "text-wrap": "wrap",
      "line-break": "auto",
      "overflow-wrap": "normal",
      "word-break": "normal",
    });
  });

  it("keeps the root inside its container and scrolls what doesn't fit", () => {
    expect(Object.fromEntries(root.declarations)).toMatchObject({
      // No min-content width of its own, so a host that sizes to content doesn't grow.
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr)",
      "min-width": "0",
      "max-width": "100%",
      overflow: "auto hidden",
    });
    expect(Object.fromEntries(root.declarations).position).toBeUndefined();
  });
});
