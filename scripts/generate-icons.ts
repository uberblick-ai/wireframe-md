import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { IconDrawing, IconPath, IconStyle } from "../src/icons.js";

const require = createRequire(import.meta.url);
const packageRoot = new URL("../../", pathToFileURL(require.resolve("@tabler/icons/outline/pin.svg")));
const packageFile = new URL("package.json", packageRoot);
const version: string = JSON.parse(readFileSync(packageFile, "utf8")).version;

/** Fail closed on any upstream element, attribute or value we do not draw. */
export function validatePaths(input: unknown): IconPath[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("An icon needs shape nodes");
  return input.map((node: unknown) => {
    if (!Array.isArray(node) || node.length !== 2 || node[0] !== "path") throw new Error("Only SVG path shapes are allowed");
    const attributes: unknown = node[1];
    if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) throw new Error("Expected path attributes");
    let d = "";
    let paint = 0;
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "d" && typeof value === "string" && /^[Mm][MmZzLlHhVvCcSsQqTtAa\d\s.,+-]+$/.test(value)) d = value;
      else if (key === "fill" && value === "currentColor") paint |= 1;
      else if (key === "stroke" && value === "none") paint |= 2;
      else if (key === "opacity" && value === ".5") paint |= 4;
      else throw new Error(`Unexpected SVG attribute or value: ${key}`);
    }
    if (d === "") throw new Error("A path needs geometry");
    return [d, paint];
  });
}

export function generateIcons(): ReadonlyMap<string, string> {
  const catalog = new Map<string, IconDrawing>();
  for (const style of ["outline", "filled"] satisfies IconStyle[]) {
    const data: unknown = JSON.parse(readFileSync(new URL(`tabler-nodes-${style}.json`, packageRoot), "utf8"));
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected the Tabler catalog");
    for (const [name, nodes] of Object.entries(data)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`Invalid Tabler name: ${name}`);
      const drawing = catalog.get(name) ?? {};
      drawing[style] = validatePaths(nodes);
      catalog.set(name, drawing);
    }
  }
  const rows = [...catalog].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const header = `// Generated from @tabler/icons ${version}, outline and filled node data. Do not edit.\n` +
    `// Tabler Icons, MIT, Copyright (c) 2020-2026 Paweł Kuna. See THIRD_PARTY_NOTICES.md.\n`;
  // Small modules keep the full catalog within the project's lint file limit.
  const chunks: string[][] = [[]];
  let size = 0;
  for (const row of rows) {
    const line = `  ${JSON.stringify(row)},`;
    if (size + line.length > 700_000) { chunks.push([]); size = 0; }
    chunks.at(-1)?.push(line);
    size += line.length;
  }
  const files = new Map<string, string>();
  chunks.forEach((lines, i) => {
    files.set(`icon-data-${i}.ts`, `import type { IconDrawing } from "../icons.js";\n\n` + header +
      `export const data: readonly (readonly [string, IconDrawing])[] = [\n${lines.join("\n")}\n];\n`);
  });
  files.set("icons.ts", `import type { IconDrawing } from "../icons.js";\n` +
    chunks.map((_, i) => `import { data as data${i} } from "./icon-data-${i}.js";`).join("\n") +
    `\n\n${header}export const ICON_DATA: ReadonlyMap<string, IconDrawing> = new Map([${chunks.map((_, i) => `...data${i}`).join(", ")}]);\n`);
  return files;
}

export function writeIcons(): void {
  const folder = new URL("../src/generated/", import.meta.url);
  const files = generateIcons();
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  for (const [file, content] of files) writeFileSync(new URL(file, folder), content);
}
