import type { Locator, Page } from "@playwright/test";
import ts from "typescript";

// Serves the package's sources to Chromium from a made-up origin, so a test
// renders with the real renderer in a real browser and nothing needs a build.

const ORIGIN = "http://wireframe.test";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
// Geist, Uberblick's font, so the goldens look like a document and don't
// depend on the fonts the machine has.
const FONT = `${ROOT}node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: "Geist"; src: url("/geist.woff2") format("woff2"); font-weight: 100 900; }
  body { margin: 0; font-family: "Geist", sans-serif; }
  /* A bare page in the system's colours. */
  .standalone { padding: 16px; background: Canvas; color: CanvasText; }
  /* An Uberblick document: its ground, and the editor's text styles, which a
     wireframe inherits and must reset. */
  .document { width: max-content; padding: 24px; background: light-dark(oklch(0.96 0.008 75), oklch(0.145 0 0)); }
  .column {
    width: 710px;
    color: light-dark(oklch(0.3 0 0), oklch(0.92 0 0));
    font-size: 16px;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .column > p { margin: 0 0 0.7em; }
</style>
</head>
<body></body>
</html>`;

export type Scheme = "light" | "dark";

/** Where the wireframe sits: on a bare page, or in a 710 px document column with prose above it. */
export type Host = "standalone" | "column";

export interface Options {
  scheme?: Scheme;
  host?: Host;
  /** Prose above the wireframe in a column. */
  intro?: string;
  /** The column's width in pixels, 710 unless given. */
  width?: number;
}

/** Open the test page. Call once per test before {@link show}. */
export async function open(page: Page): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (pathname === "/geist.woff2") return route.fulfill({ contentType: "font/woff2", path: FONT });
    const module = /^\/src\/([a-z]+)\.js$/.exec(pathname)?.[1];
    const source = module === undefined ? undefined : ts.sys.readFile(`${ROOT}src/${module}.ts`);
    if (source === undefined) return route.fulfill({ status: 404 });
    const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
    return route.fulfill({
      contentType: "text/javascript",
      body: ts.transpileModule(source, { compilerOptions: options }).outputText,
    });
  });
  await page.goto(`${ORIGIN}/`);
}

/**
 * Parse and render `source` into a fresh host, replacing any earlier one, and
 * wait for the font. Returns the host, which a golden screenshots.
 */
export async function show(page: Page, source: string, options: Options = {}): Promise<Locator> {
  const { scheme = "light", host = "standalone", intro = "", width = 710 } = options;
  await page.evaluate(
    async ({ source, scheme, host, intro, width }) => {
      const url = "/src/index.js";
      const wireframe = await import(url);
      document.documentElement.style.colorScheme = scheme;
      if (document.getElementById("wf-styles") === null) {
        const style = document.createElement("style");
        style.id = "wf-styles";
        style.textContent = wireframe.getEmbedStyles();
        document.head.append(style);
      }
      const main = document.createElement("main");
      main.id = "host";
      let parent: HTMLElement = main;
      if (host === "standalone") main.className = "standalone";
      else {
        main.className = "document";
        parent = document.createElement("div");
        parent.className = "column";
        parent.style.width = `${width}px`;
        if (intro !== "") parent.append(Object.assign(document.createElement("p"), { textContent: intro }));
        main.append(parent);
      }
      const rendered = wireframe.renderWireframe(wireframe.parseWireframe(source));
      if (rendered !== null) parent.append(rendered);
      document.getElementById("host")?.remove();
      document.body.append(main);
      await document.fonts.ready;
    },
    { source, scheme, host, intro, width },
  );
  return page.locator("#host");
}
