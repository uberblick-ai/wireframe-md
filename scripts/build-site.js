import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultStyles, renderMarkdownWireframesToHtml } from "../packages/html/src/index.js";
import { siteCatalog } from "../site/catalog.js";

export const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const outDir = `${rootDir}/site-dist`;

export function buildSite() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/.nojekyll`, "");
  writeFileSync(`${outDir}/index.html`, buildHtmlDocument());
}

export function buildHtmlDocument() {
  const siteStyles = readFileSync(`${rootDir}/site/site.css`, "utf8");
  const rendererStyles = getDefaultStyles();

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${escapeHtml(siteCatalog.title)} showcase</title>`,
    `    <style>${rendererStyles}</style>`,
    `    <style>${siteStyles}</style>`,
    "  </head>",
    "  <body>",
    "    <div class=\"site-shell\">",
    renderHero(),
    "      <div class=\"site-layout\">",
    renderNavigation(),
    renderContent(),
    "      </div>",
    "      <footer class=\"site-footer\">",
    "        Built from the library itself. If a demo changes, update the fixture or the renderer.",
    "      </footer>",
    "    </div>",
    "  </body>",
    "</html>",
  ].join("\n");
}

function renderHero() {
  return [
    "      <header class=\"hero\">",
    "        <p class=\"eyebrow\">GitHub Pages Showcase</p>",
    `        <h1>${escapeHtml(siteCatalog.title)}</h1>`,
    `        <p>${escapeHtml(siteCatalog.tagline)}</p>`,
    "        <div class=\"hero-links\">",
    "          <a href=\"https://github.com/uberblick-ai/wireframe-md\">GitHub</a>",
    "          <a href=\"#screen\">Current element: screen</a>",
    "        </div>",
    "      </header>",
  ].join("\n");
}

function renderNavigation() {
  return [
    "        <aside class=\"site-nav\">",
    "          <h2>Catalog</h2>",
    "          <ul>",
    ...siteCatalog.sections.map((section) => `            <li><a href="#${escapeHtml(section.id)}"><code>${escapeHtml(section.name)}</code></a></li>`),
    "          </ul>",
    "        </aside>",
  ].join("\n");
}

function renderContent() {
  return [
    "        <main class=\"content\">",
    ...siteCatalog.sections.map(renderSection),
    "        </main>",
  ].join("\n");
}

function renderSection(section) {
  return [
    `          <section id="${escapeHtml(section.id)}" class="section-panel">`,
    "            <div class=\"section-head\">",
    `              <span class="section-tag">Element</span>`,
    `              <h2><code>${escapeHtml(section.name)}</code></h2>`,
    `              <p>${escapeHtml(section.summary)}</p>`,
    "            </div>",
    `            <ul class="note-list">${section.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`,
    "            <div class=\"section-grid\">",
    renderSyntaxCard(section),
    renderOptionsCard(section),
    "            </div>",
    "            <div class=\"demo-grid\">",
    ...section.demos.map(renderDemoCard),
    "            </div>",
    "          </section>",
  ].join("\n");
}

function renderSyntaxCard(section) {
  return [
    "              <div class=\"info-card\">",
    "                <h3>Supported Syntax</h3>",
    "                <div class=\"syntax-list\">",
    ...section.syntax.map((line) => `                  <code>${escapeHtml(line)}</code>`),
    "                </div>",
    "              </div>",
  ].join("\n");
}

function renderOptionsCard(section) {
  return [
    "              <div class=\"info-card\">",
    "                <h3>Options</h3>",
    renderOptionTable(section.options),
    "                <h3>Fence Options</h3>",
    renderOptionTable(section.blockOptions),
    "              </div>",
  ].join("\n");
}

function renderOptionTable(rows) {
  return [
    "                <table class=\"option-table\">",
    "                  <tbody>",
    ...rows.map(
      (row) => [
        "                    <tr>",
        `                      <th><code>${escapeHtml(row.name)}</code></th>`,
        `                      <td><strong>${escapeHtml(row.values)}</strong><br>${escapeHtml(row.description)}</td>`,
        "                    </tr>",
      ].join("\n"),
    ),
    "                  </tbody>",
    "                </table>",
  ].join("\n");
}

function renderDemoCard(demo) {
  const renderHtml = renderMarkdownWireframesToHtml(demo.markdown);

  return [
    "              <article class=\"demo-card\">",
    "                <div class=\"demo-head\">",
    `                  <h3>${escapeHtml(demo.title)}</h3>`,
    `                  <span class="demo-id">${escapeHtml(demo.id)}</span>`,
    "                </div>",
    `                <p>${escapeHtml(demo.description)}</p>`,
    "                <div class=\"demo-layout\">",
    "                  <div class=\"code-panel\">",
    `                    <pre><code>${escapeHtml(demo.markdown)}</code></pre>`,
    "                  </div>",
    "                  <div class=\"preview-panel\">",
    renderHtml,
    "                  </div>",
    "                </div>",
    "              </article>",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSite();
}
