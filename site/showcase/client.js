// @ts-check

const STORAGE_KEY = "wireframe-md-showcase-theme";

/**
 * @typedef {{ key: string, kind: "select" | "input" | "text", value: string, options?: string[] }} ShowcaseParam
 * @typedef {{ id: string, title: string, description: string, groupId: string, groupLabel: string, params: ShowcaseParam[], source: string, previewHtml: string }} ShowcaseExample
 * @typedef {{ title: string, tagline: string, summary: string, githubUrl: string, localCommand: string }} ShowcaseMeta
 * @typedef {{ id: string, label: string, description: string, examples: ShowcaseExample[] }} ShowcaseGroup
 * @typedef {{ meta: ShowcaseMeta, groups: ShowcaseGroup[], defaultExampleId: string }} ShowcasePayload
 */

/**
 * @param {ShowcaseGroup[]} groups
 * @returns {ShowcaseExample[]}
 */
export function flattenExamples(groups) {
  return groups.flatMap((group) => group.examples);
}

/**
 * @param {ShowcasePayload} payload
 * @param {string | null | undefined} requestedId
 * @returns {string}
 */
export function resolveExampleId(payload, requestedId) {
  const candidate = String(requestedId || "").replace(/^#/, "");
  if (candidate && flattenExamples(payload.groups).some((example) => example.id === candidate)) {
    return candidate;
  }

  return payload.defaultExampleId || flattenExamples(payload.groups)[0]?.id || "";
}

/**
 * @param {"light" | "dark"} theme
 * @returns {"light" | "dark"}
 */
export function nextTheme(theme) {
  return theme === "dark" ? "light" : "dark";
}

function initShowcase() {
  const app = document.querySelector("[data-showcase-app]");
  const payload = readPayload();

  if (!app || !payload) return;

  const exampleMap = new Map(flattenExamples(payload.groups).map((example) => [example.id, example]));
  const elements = {
    buttons: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-example-id]")),
    preview: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='preview']")),
    title: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='title']")),
    summary: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='summary']")),
    source: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='source']")),
    params: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='params']")),
    permalink: /** @type {HTMLAnchorElement | null} */ (document.querySelector("[data-role='permalink']")),
    themeToggle: /** @type {HTMLButtonElement | null} */ (document.querySelector("[data-role='theme-toggle']")),
    themeLabel: /** @type {HTMLElement | null} */ (document.querySelector("[data-role='theme-label']")),
  };

  /** @type {"light" | "dark"} */
  let currentTheme = getInitialTheme();
  applyTheme(currentTheme, elements.themeLabel);

  function selectExample(exampleId, updateHash = true) {
    const resolvedId = resolveExampleId(payload, exampleId);
    const example = exampleMap.get(resolvedId);

    if (!example) return;

    if (elements.title) elements.title.textContent = example.title;
    if (elements.summary) elements.summary.textContent = example.description;
    if (elements.preview) elements.preview.innerHTML = example.previewHtml;
    if (elements.source) elements.source.textContent = example.source;
    if (elements.params) elements.params.innerHTML = renderParams(example.params);
    if (elements.permalink) elements.permalink.href = `#${example.id}`;

    elements.buttons.forEach((button) => {
      const active = button.dataset.exampleId === example.id;
      button.dataset.active = active ? "true" : "false";
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (updateHash && window.location.hash !== `#${example.id}`) {
      window.history.replaceState(null, "", `#${example.id}`);
    }
  }

  elements.buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const exampleId = button.dataset.exampleId;
      if (exampleId) {
        selectExample(exampleId);
      }
    });
  });

  elements.themeToggle?.addEventListener("click", () => {
    currentTheme = nextTheme(currentTheme);
    applyTheme(currentTheme, elements.themeLabel);
    window.localStorage.setItem(STORAGE_KEY, currentTheme);
  });

  window.addEventListener("hashchange", () => {
    selectExample(window.location.hash, false);
  });

  selectExample(window.location.hash || payload.defaultExampleId, false);
}

function readPayload() {
  const node = document.getElementById("showcase-data");
  if (!node?.textContent) return null;

  try {
    return /** @type {ShowcasePayload} */ (JSON.parse(node.textContent));
  } catch {
    return null;
  }
}

/**
 * @returns {"light" | "dark"}
 */
function getInitialTheme() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * @param {"light" | "dark"} theme
 * @param {HTMLElement | null} label
 */
function applyTheme(theme, label) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.dataset.theme = theme;

  if (label) {
    label.textContent = theme === "dark" ? "Dark" : "Light";
  }
}

/**
 * @param {ShowcaseParam[]} params
 */
function renderParams(params) {
  if (!params.length) {
    return "<p class=\"param-empty\">No params for this example.</p>";
  }

  return [
    "<dl class=\"param-list\">",
    ...params.map((param) => renderParam(param)),
    "</dl>",
  ].join("\n");
}

/**
 * @param {ShowcaseParam} param
 */
function renderParam(param) {
  return [
    "<div class=\"param-row\">",
    `  <dt>${escapeHtml(param.key)}</dt>`,
    `  <dd>${renderParamValue(param)}</dd>`,
    "</div>",
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
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof document !== "undefined") {
  initShowcase();
}
