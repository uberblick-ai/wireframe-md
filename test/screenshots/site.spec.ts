import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import * as renderer from "../../src/index.js";
import { type Approval, approvalFingerprint, fingerprint, formatMarkup } from "../../playground/approval.js";
import { manifest } from "../../site/manifest.js";
import { generateShowcase } from "../../site/showcase.js";

const ROOT = join(import.meta.dirname, "../..");
const ORIGIN = "http://showcase.test";
const SITE_CSS = readFileSync(join(ROOT, "site/site.css"), "utf8");
const FONT = join(ROOT, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");

// An offline fixture for the shared shell: the global sizing, font, block and
// navigation rules the site inherits. This avoids making CI depend on the
// sibling site's availability. The wireframes use the real package stylesheet.
const SHARED_CSS = `
@font-face { font-family: "Geist"; src: url("${ORIGIN}/geist.woff2"); font-weight: 100 900; }
:root { --bg: white; --fg: #252525; --prose: #444; --muted: #666; --card: #f7f7f7; --border: #ddd; --rule: #ddd; --radius: 10px; --measure: 66ch; --font-sans: "Geist", sans-serif; --font-mono: ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --fg: #eee; --prose: #ddd; --card: #202020; --rule: #444; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 16px/27px var(--font-sans); }
p, h1, h2, h3 { margin: 0; }
h3 { font: 600 18px/24px var(--font-sans); }
a { color: inherit; }
code { font: 400 .92em var(--font-mono); }
.wrap { max-width: 84ch; margin: 0 auto; padding: 0 16px 72px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; flex-wrap: wrap; }
.top nav { display: flex; flex-wrap: wrap; }
.top nav a { padding: 4px 10px; }
.block { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); position: relative; overflow: hidden; }
.block .cap { padding: 8px 12px 8px 16px; font: 400 12px/16px var(--font-sans); color: var(--muted); border-bottom: 1px solid var(--border); }
.block pre { margin: 0; padding: 14px 16px 16px; overflow-x: auto; font: 400 13.5px/22px var(--font-mono); color: var(--fg); }
.end { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 48px; }
.end nav { display: flex; flex-wrap: wrap; gap: 14px; }
`;

let html = "";
test.beforeAll(async () => {
  const dom = new JSDOM();
  try {
    const approvals: Record<string, Approval> = {};
    const stylesheet = await fingerprint(renderer.getEmbedStyles());
    const readSource = (id: string): string => readFileSync(join(ROOT, `examples/${id}.wireframe`), "utf8");
    // Only in-memory fixture approvals; never read or write real approvals.
    for (const id of manifest.flatMap((s) => s.examples)) {
      const source = readSource(id);
      const root = renderer.renderWireframe(renderer.parseWireframe(source), dom.window.document);
      if (root === null) throw new Error(`${id}: cannot render`);
      approvals[id] = { approved: true, fingerprint: await approvalFingerprint(source, stylesheet, formatMarkup(root)) };
    }
    html = await generateShowcase({ sections: manifest, readSource, approvals, renderer, document: dom.window.document });
  } finally {
    dom.window.close();
  }
});

test.use({ javaScriptEnabled: false });
test.beforeEach(async ({ page }) => {
  await page.route("https://uberblick.ai/shared.css", (route) => route.fulfill({ contentType: "text/css", body: SHARED_CSS }));
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (path === "/site.css") return route.fulfill({ contentType: "text/css", body: SITE_CSS });
    if (path === "/wireframe.css") return route.fulfill({ contentType: "text/css", body: renderer.getEmbedStyles() });
    if (path === "/geist.woff2") return route.fulfill({ contentType: "font/woff2", path: FONT });
    return route.fulfill({ status: 404 });
  });
});

for (const scheme of ["light", "dark"] as const) {
  test(`showcase in ${scheme} works without JavaScript and keeps both render schemes`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(ORIGIN);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".wf-root")).toHaveCount(30);
    const colours = await page.locator(".showcase-render").evaluateAll((renders) => renders.map((render) => {
      const ground = render.querySelector(".showcase-ground")!;
      const root = ground.querySelector(".wf-root")!;
      return { scheme: getComputedStyle(render).colorScheme, background: getComputedStyle(ground).backgroundColor, ink: getComputedStyle(root).color };
    }));
    expect(colours.filter((c) => c.scheme === "light")).toHaveLength(15);
    expect(colours.filter((c) => c.scheme === "dark")).toHaveLength(15);
    expect(new Set(colours.map((c) => c.background)).size).toBe(2);
    expect(new Set(colours.map((c) => c.ink)).size).toBe(2);
    for (const c of colours) {
      expect(c.background).toBe(c.scheme === "light" ? "rgb(255, 255, 255)" : "rgb(18, 18, 18)");
      expect(c.ink).toBe(c.scheme === "light" ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)");
    }
    await expect(page.locator("#dialogs .showcase-example").first()).toHaveScreenshot(`showcase-dialog-${scheme}.png`);
  });

  test(`phone-width showcase in ${scheme} keeps wide content inside the render`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ colorScheme: scheme });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.resourceType()));
    await page.goto(ORIGIN);
    await expect(page.locator("#pages .wf-root")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const wide = page.locator("#pages .wf-root").first();
    const size = await wide.evaluate((root) => ({ client: root.clientWidth, scroll: root.scrollWidth }));
    expect(size.scroll).toBeGreaterThan(size.client);
    await wide.evaluate((root) => { root.scrollLeft = 100; });
    expect(await wide.evaluate((root) => root.scrollLeft)).toBeGreaterThan(0);
    expect(requests).not.toContain("script");
    await page.locator('.showcase-nav a[href="#pages"]').click();
    await expect(page).toHaveURL(`${ORIGIN}/#pages`);
  });
}
