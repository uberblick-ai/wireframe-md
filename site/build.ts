import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";
import type { Renderer } from "./showcase.js";

// Node strips TypeScript. Resolve the site's and playground helpers' .js
// specifiers to sources; the renderer itself always comes from the fresh dist.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL !== undefined && specifier.endsWith(".js")) {
      const target = new URL(specifier, context.parentURL);
      const roots = [new URL("./", import.meta.url).href, new URL("../playground/", import.meta.url).href];
      if (roots.some((root) => target.href.startsWith(root))) return nextResolve(target.href.replace(/\.js$/, ".ts"), context);
    }
    return nextResolve(specifier, context);
  },
});

const { generateShowcase, parseApprovals } = await import(new URL("showcase.ts", import.meta.url).href) as typeof import("./showcase.js");
const { manifest } = await import(new URL("manifest.ts", import.meta.url).href) as typeof import("./manifest.js");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--preview")) throw new Error("Usage: pnpm site [--preview]");
const preview = args[0] === "--preview";
const output = new URL(preview ? "preview/" : "out/", import.meta.url);
const examples = new URL("../examples/", import.meta.url);

function readOptional(file: URL): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

const renderer = await import(new URL("../dist/index.js", import.meta.url).href) as Renderer;
const dom = new JSDOM();
try {
  const approvals = parseApprovals(readOptional(new URL("approvals.json", examples)) ?? "{}");
  const html = await generateShowcase({
    sections: manifest,
    readSource: (id) => readOptional(new URL(`${id}.wireframe`, examples)),
    approvals,
    renderer,
    document: dom.window.document,
    preview,
  });
  // Gate before replacing output. Preview has its own directory and never
  // writes deployable files into out, even after a previous successful build.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(new URL("index.html", output), html);
  copyFileSync(new URL("site.css", import.meta.url), new URL("site.css", output));
  writeFileSync(new URL("wireframe.css", output), renderer.getEmbedStyles());
  console.log(`${preview ? "Preview" : "Approved showcase"}: ${manifest.reduce((count, section) => count + section.examples.length, 0)} examples → ${output.pathname}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  dom.window.close();
}
