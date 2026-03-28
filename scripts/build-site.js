// @ts-check

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultStyles, renderWireframeBlockToHtml } from "../packages/html/src/index.js";
import { showcaseGroups, showcaseMeta, getDefaultExampleId } from "../site/showcase/registry.js";

export const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const outDir = `${rootDir}/site-dist`;

/**
 * @typedef {{ key: string, kind: "select" | "input" | "text", value: string, options?: string[] }} ShowcaseParam
 * @typedef {{ id: string, title: string, description: string, groupId: string, groupLabel: string, params: ShowcaseParam[], source: string, previewHtml: string }} MaterializedExample
 * @typedef {{ id: string, label: string, description: string, examples: MaterializedExample[] }} MaterializedGroup
 * @typedef {{ meta: typeof showcaseMeta, groups: MaterializedGroup[], defaultExampleId: string }} ShowcaseModel
 */

export function buildSite() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(`${outDir}/assets`, { recursive: true });

  writeFileSync(`${outDir}/.nojekyll`, "");
  writeFileSync(`${outDir}/index.html`, buildHtmlDocument());
  copyFileSync(`${rootDir}/site/showcase/client.js`, `${outDir}/assets/showcase.js`);
}

/**
 * @returns {ShowcaseModel}
 */
export function buildShowcaseModel() {
  return {
    meta: showcaseMeta,
    defaultExampleId: getDefaultExampleId(),
    groups: showcaseGroups.map((group) => ({
      id: group.id,
      label: group.label,
      description: group.description,
      examples: group.examples.map((example) => {
        const source = example.sourceLines.join("\n");

        return {
          id: example.id,
          title: example.title,
          description: example.description,
          groupId: group.id,
          groupLabel: group.label,
          params: example.params,
          source,
          previewHtml: renderWireframeBlockToHtml(source, example.renderOptions),
        };
      }),
    })),
  };
}

export function buildHtmlDocument() {
  const siteStyles = readFileSync(`${rootDir}/site/site.css`, "utf8");
  const rendererStyles = getDefaultStyles();
  const showcase = buildShowcaseModel();
  const initialExample = findExample(showcase, showcase.defaultExampleId);

  if (!initialExample) {
    throw new Error("The showcase registry must provide at least one example.");
  }

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${escapeHtml(showcase.meta.title)} showcase</title>`,
    "    <meta name=\"description\" content=\"Public capability showcase for wireframe-md.\">",
    "    <script>",
    "      (() => {",
    "        const stored = localStorage.getItem(\"wireframe-md-showcase-theme\");",
    "        const theme = stored === \"light\" || stored === \"dark\"",
    "          ? stored",
    "          : (window.matchMedia(\"(prefers-color-scheme: dark)\").matches ? \"dark\" : \"light\");",
    "        document.documentElement.classList.add(theme);",
    "        document.documentElement.dataset.theme = theme;",
    "      })();",
    "    </script>",
    `    <style>${rendererStyles}</style>`,
    `    <style>${siteStyles}</style>`,
    "  </head>",
    "  <body>",
    "    <div class=\"page-shell\" data-showcase-app>",
    renderPageHeader(showcase),
    renderShowcaseShell(showcase, initialExample),
    "      <footer class=\"page-footer\">",
    `        <span>Built from the same static app that ${escapeHtml(showcase.meta.localCommand)} serves locally.</span>`,
    "        <span>Planned in Uberblick, rendered with wireframe-md.</span>",
    "      </footer>",
    `      <script id="showcase-data" type="application/json">${serializeForScript(showcase)}</script>`,
    "      <script type=\"module\" src=\"./assets/showcase.js\"></script>",
    "    </div>",
    "  </body>",
    "</html>",
  ].join("\n");
}

/**
 * @param {ShowcaseModel} showcase
 */
function renderPageHeader(showcase) {
  return [
    "      <header class=\"page-header\">",
    "        <div class=\"page-header-main\">",
    "          <p class=\"page-eyebrow\">Public Capability Showcase</p>",
    `          <h1>${escapeHtml(showcase.meta.title)}</h1>`,
    `          <p class="page-summary">${escapeHtml(showcase.meta.summary)}</p>`,
    "          <div class=\"page-pills\">",
    "            <span class=\"page-pill\">GitHub Pages</span>",
    `            <span class="page-pill">${escapeHtml(showcase.meta.localCommand)}</span>`,
    "            <span class=\"page-pill\">Informational params in V1</span>",
    "          </div>",
    "        </div>",
    "        <div class=\"page-header-actions\">",
    `          <a class="page-link" href="${escapeHtml(showcase.meta.githubUrl)}">GitHub</a>`,
    "          <button class=\"theme-toggle\" type=\"button\" data-role=\"theme-toggle\">",
    "            <span class=\"theme-toggle-dot\" aria-hidden=\"true\"></span>",
    "            <span data-role=\"theme-label\">Dark</span>",
    "          </button>",
    "        </div>",
    "      </header>",
  ].join("\n");
}

/**
 * @param {ShowcaseModel} showcase
 * @param {MaterializedExample} initialExample
 */
function renderShowcaseShell(showcase, initialExample) {
  return [
    "      <main class=\"showcase-shell\">",
    "        <aside class=\"showcase-sidebar\">",
    "          <div class=\"sidebar-head\">",
    "            <p class=\"sidebar-eyebrow\">Examples</p>",
    "            <h2>Capability Gallery</h2>",
    "            <p>Curated examples of what the DSL can express today.</p>",
    "          </div>",
    renderSidebar(showcase, initialExample.id),
    "        </aside>",
    "        <section class=\"showcase-main\">",
    "          <article class=\"preview-card\">",
    "            <div class=\"panel-head panel-head-spread\">",
    "              <div>",
    `                <p class="panel-eyebrow">${escapeHtml(initialExample.groupLabel)}</p>`,
    `                <h2 data-role="title">${escapeHtml(initialExample.title)}</h2>`,
    `                <p data-role="summary">${escapeHtml(initialExample.description)}</p>`,
    "              </div>",
    `              <a class="panel-link" data-role="permalink" href="#${escapeHtml(initialExample.id)}">Permalink</a>`,
    "            </div>",
    "            <div class=\"preview-stage\" data-role=\"preview\">",
    initialExample.previewHtml,
    "            </div>",
    "          </article>",
    "          <div class=\"inspector-grid\">",
    "            <article class=\"panel-card\">",
    "              <div class=\"panel-head\">",
    "                <p class=\"panel-eyebrow\">Inspector</p>",
    "                <h3>Params</h3>",
    "                <p>Informational only in V1. The inspector explains the current example state.</p>",
    "              </div>",
    `              <div data-role="params">${renderParams(initialExample.params)}</div>`,
    "            </article>",
    "            <article class=\"panel-card\">",
    "              <div class=\"panel-head\">",
    "                <p class=\"panel-eyebrow\">Source</p>",
    "                <h3>Markdown</h3>",
    "                <p>The exact source that produced the rendered preview.</p>",
    "              </div>",
    "              <div class=\"source-frame\">",
    `                <pre><code data-role="source">${escapeHtml(initialExample.source)}</code></pre>`,
    "              </div>",
    "            </article>",
    "          </div>",
    "        </section>",
    "      </main>",
  ].join("\n");
}

/**
 * @param {ShowcaseModel} showcase
 * @param {string} selectedId
 */
function renderSidebar(showcase, selectedId) {
  return [
    "          <nav class=\"sidebar-groups\" aria-label=\"Showcase examples\">",
    ...showcase.groups.map((group) => [
      "            <section class=\"sidebar-group\">",
      `              <div class="sidebar-group-title">${escapeHtml(group.label)}</div>`,
      `              <p class="sidebar-group-description">${escapeHtml(group.description)}</p>`,
      "              <div class=\"sidebar-example-list\">",
      ...group.examples.map((example) => [
        `                <button class="sidebar-example" type="button" data-example-id="${escapeHtml(example.id)}" data-active="${example.id === selectedId ? "true" : "false"}" aria-pressed="${example.id === selectedId ? "true" : "false"}">`,
        `                  <span class="sidebar-example-title">${escapeHtml(example.title)}</span>`,
        `                  <span class="sidebar-example-summary">${escapeHtml(example.description)}</span>`,
        "                </button>",
      ].join("\n")),
      "              </div>",
      "            </section>",
    ].join("\n")),
    "          </nav>",
  ].join("\n");
}

/**
 * @param {ShowcaseParam[]} params
 */
function renderParams(params) {
  return [
    "              <dl class=\"param-list\">",
    ...params.map((param) => [
      "                <div class=\"param-row\">",
      `                  <dt>${escapeHtml(param.key)}</dt>`,
      `                  <dd>${renderParamValue(param)}</dd>`,
      "                </div>",
    ].join("\n")),
    "              </dl>",
  ].join("\n");
}

/**
 * @param {ShowcaseParam} param
 */
function renderParamValue(param) {
  if (param.kind === "select") {
    return [
      `<div class="control control-select" data-options="${escapeHtml((param.options || []).join(","))}">`,
      `  <span class="control-value">${escapeHtml(param.value)}</span>`,
      "  <span class=\"control-caret\" aria-hidden=\"true\">▾</span>",
      "</div>",
    ].join("\n");
  }

  if (param.kind === "input") {
    return [
      "<div class=\"control control-input\">",
      `  <span class="control-value">${escapeHtml(param.value)}</span>`,
      "</div>",
    ].join("\n");
  }

  return `<span class="param-text">${escapeHtml(param.value)}</span>`;
}

/**
 * @param {ShowcaseModel} showcase
 * @param {string} exampleId
 * @returns {MaterializedExample | null}
 */
function findExample(showcase, exampleId) {
  for (const group of showcase.groups) {
    const match = group.examples.find((example) => example.id === exampleId);
    if (match) return match;
  }

  return null;
}

/**
 * @param {unknown} value
 */
function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * @param {unknown} value
 */
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
