import {
  getEmbedStyles,
  parseWireframe,
  renderWireframe,
  summarizeWireframe,
  type WireframeParseResult,
} from "../src/index.js";
import { type Approval, describeStatus, diffLines, fingerprint, formatMarkup, type Status, statusOf } from "./approval.js";

// The playground's page: the sidebar of examples by group, the editor, and the render,
// diagnostics, summary and approval of what the editor holds, or in their place
// a group's overview, a tile per example. The server transpiles the package's
// sources per request, so a reload renders with the current code.

interface Example {
  name: string;
  /** The source as saved in examples/. */
  source: string;
  approval: Approval | null;
}

type Scheme = "light" | "dark";
type Host = "standalone" | "column";

/** Prose above the wireframe in the document column. */
const INTRO = "A paragraph of the document. The wireframe below sits in Uberblick's 710 px column.";
const SVG = "http://www.w3.org/2000/svg";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`the page lacks #${id}`);
  return element as T;
}

function element(tag: string, className = "", text = ""): HTMLElement {
  const created = document.createElement(tag);
  if (className !== "") created.className = className;
  if (text !== "") created.textContent = text;
  return created;
}

const editor = byId<HTMLTextAreaElement>("pg-source");
const gutter = byId("pg-gutter");
const title = byId("pg-name");
const dirtyMark = byId("pg-dirty");
const saveButton = byId<HTMLButtonElement>("pg-save");
const notice = byId("pg-notice");
const preview = byId("pg-preview");
const staleMark = byId("pg-stale");
const summary = byId("pg-summary");
const diagnostics = byId("pg-diagnostics");
const statusBadge = byId("pg-status");
const approveButton = byId<HTMLButtonElement>("pg-approve");
const approveHint = byId("pg-approve-hint");
const review = byId("pg-review");
const groupList = byId("pg-groups");
const addForm = byId<HTMLFormElement>("pg-add");
const newName = byId<HTMLInputElement>("pg-new-name");
const panes = byId("pg-main");
const overviewPane = byId("pg-overview");
const overviewTitle = byId("pg-overview-title");
const overviewCount = byId("pg-overview-count");
const overviewHint = byId("pg-overview-hint");
const tiles = byId("pg-tiles");

let examples: Example[] = [];
/** The example in the editor, or undefined for a scratch source. */
let current: Example | undefined;
/** The group whose overview shows in place of the editor and render, "" for the ungrouped examples. */
let overview: string | undefined;
/** What the editor's source parses to. */
let result: WireframeParseResult = parseWireframe("");
/** The last render without an error, kept while the source has one. */
let lastGood: HTMLElement | null = null;
/** The fingerprint of getEmbedStyles(). */
let stylesheet = "";
let host: Host = "standalone";

// The editor as saved: textareas hold line feeds only.
const saved = (example: Example): string => example.source.replace(/\r\n?/g, "\n");
const isDirty = (): boolean => current !== undefined && editor.value !== saved(current);

/** The markup an example's saved source renders to, or null when it has an error. */
function renderSaved(example: Example): { element: HTMLElement; markup: string } | null {
  const rendered = renderWireframe(parseWireframe(example.source));
  return rendered === null ? null : { element: rendered, markup: formatMarkup(rendered) };
}

const statusOfExample = (example: Example): Status =>
  statusOf(renderSaved(example)?.markup ?? null, stylesheet, example.approval);

function say(message: string, failed = false): void {
  notice.textContent = message;
  notice.classList.toggle("pg-failed", failed);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `${method} ${path} failed: ${response.status}`);
  return value as T;
}

// The editor and what it renders to.

function update(): void {
  result = parseWireframe(editor.value);
  const rendered = renderWireframe(result);
  if (rendered !== null) lastGood = rendered;
  showPreview(rendered === null && lastGood !== null);
  showGutter();
  showDiagnostics();
  summary.textContent = summarizeWireframe(result);
  showControls();
}

function showPreview(stale: boolean): void {
  staleMark.hidden = !stale;
  preview.classList.toggle("pg-is-stale", stale);
  const content = lastGood ?? element("p", "pg-empty", "Nothing to show: the source has an error.");
  // The hosts of test/screenshots/page.ts, styled by the same hosts.css.
  if (host === "standalone") {
    const page = element("div", "standalone");
    page.append(content);
    preview.replaceChildren(page);
    return;
  }
  const column = element("div", "column");
  column.append(element("p", "", INTRO), content);
  const documentHost = element("div", "document");
  documentHost.append(column);
  preview.replaceChildren(documentHost);
}

function showGutter(): void {
  const marks = new Map<number, string>();
  for (const { line, severity } of result.diagnostics) {
    if (marks.get(line) !== "error") marks.set(line, severity);
  }
  const count = editor.value.split("\n").length;
  gutter.replaceChildren(
    ...Array.from({ length: count }, (_, index) => {
      const severity = marks.get(index + 1);
      return element("span", severity === undefined ? "" : `pg-${severity}`, `${index + 1}\n`);
    }),
  );
  gutter.scrollTop = editor.scrollTop;
}

function showDiagnostics(): void {
  if (result.diagnostics.length === 0) {
    diagnostics.replaceChildren(element("li", "pg-none", "None"));
    return;
  }
  diagnostics.replaceChildren(
    ...result.diagnostics.map(({ line, severity, message }) => {
      const button = element("button", "pg-diagnostic");
      button.setAttribute("type", "button");
      button.title = `Select line ${line}`;
      button.append(
        element("span", "pg-line", `line ${line}`),
        element("span", `pg-severity pg-${severity}`, severity),
        element("span", "pg-message", message),
      );
      button.addEventListener("click", () => selectLine(line));
      const item = element("li");
      item.append(button);
      return item;
    }),
  );
}

function selectLine(line: number): void {
  const lines = editor.value.split("\n");
  const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
  editor.focus();
  editor.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
  const height = Number.parseFloat(getComputedStyle(editor).lineHeight) || 20;
  editor.scrollTop = Math.max(0, (line - 1) * height - editor.clientHeight / 3);
}

/** Save and approve, which depend on the editor, the open example and its status. */
function showControls(): void {
  title.textContent = current === undefined ? "Scratch" : `${current.name}.wireframe`;
  const dirty = isDirty();
  dirtyMark.hidden = !dirty;
  saveButton.disabled = !dirty;

  if (current === undefined) {
    statusBadge.textContent = "Scratch";
    statusBadge.dataset.state = "scratch";
    approveButton.disabled = true;
    approveHint.textContent = "Add the source as an example to approve it.";
    return;
  }
  const status = statusOfExample(current);
  statusBadge.textContent = describeStatus(status);
  statusBadge.dataset.state = status.state;
  // An approval records the saved source, and only one that renders.
  const refusal = !result.renderable
    ? "Fix the errors before approving."
    : dirty
      ? "Save before approving: an approval records the source as saved."
      : status.state === "approved"
        ? "Approved. A change to the parser, renderer or stylesheet that alters this render flags it here and in the sidebar."
        : "";
  approveButton.disabled = refusal !== "";
  approveHint.textContent =
    refusal || "One approval covers light and dark, the bare page and the column: look at each before approving.";
}

// The approval of the open example: what changed since a person approved it.

function showReview(): void {
  review.replaceChildren();
  if (current === undefined) return;
  const status = statusOfExample(current);
  const rendered = renderSaved(current);
  const { approval } = current;
  if (status.state === "changed" && approval !== null) {
    if (status.stylesheet) {
      review.append(
        element(
          "p",
          "pg-hint",
          `The stylesheet changed: approved ${approval.stylesheet}, now ${stylesheet}. Check the render in light and dark, on the bare page and in the column.`,
        ),
      );
    }
    if (status.markup && rendered !== null) {
      const diff = diffLines(approval.markup, rendered.markup);
      const sides = element("div", "pg-sides");
      sides.append(markupColumn("Approved markup", diff.before, "pg-removed"), markupColumn("Current markup", diff.after, "pg-added"));
      review.append(sides);
    }
  }
  if (rendered !== null && !(status.state === "changed" && status.markup)) {
    const details = element("details", "pg-markup");
    details.append(
      element("summary", "", status.state === "approved" ? "Approved markup" : "Markup an approval records"),
      element("pre", "", rendered.markup),
    );
    review.append(details);
  }
}

function markupColumn(heading: string, lines: readonly { text: string; changed: boolean }[], changed: string): HTMLElement {
  const column = element("div", "pg-side");
  const pre = element("pre");
  pre.append(...lines.map((line) => element("span", line.changed ? changed : "", line.text)));
  column.append(element("h4", "", heading), pre);
  return column;
}

// The sidebar: the examples by group, each with its status. A group is a folder
// in examples/; the examples directly in it are ungrouped.

const COLLAPSED = "wireframe-playground-collapsed";

/** The groups a person collapsed, remembered between visits. */
function collapsedGroups(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function rememberCollapsed(key: string, collapsed: boolean): void {
  const keys = collapsedGroups();
  if (collapsed) keys.add(key);
  else keys.delete(key);
  localStorage.setItem(COLLAPSED, JSON.stringify([...keys]));
}

const groupOf = (name: string): string => (name.includes("/") ? name.slice(0, name.indexOf("/")) : "");
const leafOf = (name: string): string => name.slice(name.indexOf("/") + 1);

/** A group folder's name as a heading: banners-and-confirmations reads Banners & confirmations. */
function groupLabel(key: string): string {
  if (key === "") return "Ungrouped";
  const words = key.replace(/-and-/g, " & ").replace(/-/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function showSidebar(): void {
  const groups = new Map<string, Example[]>();
  for (const example of examples) {
    const key = groupOf(example.name);
    groups.set(key, [...(groups.get(key) ?? []), example]);
  }
  // Groups by name, the ungrouped examples last.
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a < b ? -1 : 1));
  const collapsed = collapsedGroups();
  groupList.replaceChildren(
    ...keys.map((key) => {
      const members = groups.get(key) ?? [];
      const states = members.map((example) => statusOfExample(example).state);
      const details = element("details", "pg-group") as HTMLDetailsElement;
      // The open example's group stays open.
      details.open = !collapsed.has(key) || members.includes(current as Example);
      details.addEventListener("toggle", () => rememberCollapsed(key, !details.open));

      const heading = element("summary", "pg-group-head");
      const name = element("span", "pg-group-name", groupLabel(key));
      name.title = groupLabel(key);
      heading.append(name, element("span", "pg-count", String(members.length)));
      const open = states.filter((state) => state !== "approved").length;
      if (open > 0) {
        const badge = element("span", "pg-badge", `${open} to review`);
        badge.dataset.state = states.includes("error") ? "error" : states.includes("changed") ? "changed" : "unapproved";
        badge.title = "Examples with errors, changed since approval, or not yet approved";
        heading.append(badge);
      }

      const list = element("ul", "pg-items");
      list.append(
        ...members.map((example) => {
          const status = statusOfExample(example);
          const link = element("a", "pg-item") as HTMLAnchorElement;
          link.href = `#${example.name}`;
          link.title = `${example.name}: ${describeStatus(status)}`;
          if (example === current) link.setAttribute("aria-current", "page");
          const dot = element("span", "pg-dot");
          dot.dataset.state = status.state;
          link.append(dot, element("span", "pg-item-name", leafOf(example.name)), element("span", "pg-hidden", describeStatus(status)));
          const item = element("li");
          item.append(link);
          return item;
        }),
      );
      details.append(heading, list);

      // The overview's control sits on the heading but outside the summary, which
      // collapses the group and would hide a control inside it from screen readers.
      const opener = element("a", "pg-opener") as HTMLAnchorElement;
      opener.href = `#${key}/`;
      opener.title = `Overview: every render in ${groupLabel(key)}`;
      opener.setAttribute("aria-label", `Overview of ${groupLabel(key)}`);
      if (key === overview) opener.setAttribute("aria-current", "page");
      opener.append(gridIcon());
      const group = element("div", "pg-group-wrap");
      group.append(opener, details);
      return group;
    }),
  );
  if (examples.length === 0) groupList.append(element("p", "pg-none", "No examples yet."));
}

/** Four squares, the overview's icon. */
function gridIcon(): SVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const squares = document.createElementNS(SVG, "path");
  squares.setAttribute("d", "M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z");
  svg.append(squares);
  return svg;
}

// A group's overview: a tile per example, in the sidebar's order, each the render
// of its saved source in the host the toggle chooses.

/** A group's overview in place of the editor and render while one shows. */
function showOverview(): void {
  panes.hidden = overview !== undefined;
  overviewPane.hidden = overview === undefined;
  // The form saves the editor's source, which an overview hides.
  addForm.hidden = overview !== undefined;
  if (overview === undefined) {
    tiles.replaceChildren();
    return;
  }
  const group = overview;
  const members = examples.filter((example) => groupOf(example.name) === group);
  overviewTitle.textContent = groupLabel(group);
  overviewCount.textContent = members.length === 1 ? "1 example" : `${members.length} examples`;
  overviewHint.textContent =
    members.length === 0
      ? "No examples in this group."
      : "Each example's saved source, rendered in the host above. Open one to edit or approve it.";
  tiles.replaceChildren(...members.map(tile));
  fitTiles();
}

/** An example's tile: its name, status and warnings over the render of its saved source. */
function tile(example: Example): HTMLElement {
  const rendered = renderSaved(example);
  const status = statusOf(rendered?.markup ?? null, stylesheet, example.approval);
  const warnings = parseWireframe(example.source).diagnostics.filter(({ severity }) => severity === "warning").length;

  const link = element("a", "pg-tile") as HTMLAnchorElement;
  link.href = `#${example.name}`;
  const dot = element("span", "pg-dot");
  dot.dataset.state = status.state;
  // Marks that fitTiles shows: how far it scaled the render, and a render that scrolls in its host.
  const scale = element("span", "pg-tile-mark pg-tile-scale");
  scale.title = "Scaled down to fit the tile";
  const scrolls = element("span", "pg-tile-mark pg-tile-scrolls", "Scrolls");
  scrolls.title = "Wider than its host: it scrolls sideways inside the wireframe, and the tile shows its start";
  for (const mark of [scale, scrolls]) {
    mark.setAttribute("aria-hidden", "true");
    mark.hidden = true;
  }
  const head = element("span", "pg-tile-head");
  head.append(dot, element("span", "pg-item-name", leafOf(example.name)), scrolls, scale);
  const facts = element("span", "pg-tile-facts");
  facts.append(element("span", "", describeStatus(status)));
  if (warnings > 0) facts.append(element("span", "pg-tile-warnings", warnings === 1 ? "1 warning" : `${warnings} warnings`));

  // The render pane's hosts. The render is a picture: inert, so it takes no
  // focus and the tile's link takes its clicks.
  const frame = element("div", `pg-tile-frame ${host === "standalone" ? "standalone" : "document"}`);
  frame.inert = true;
  const stage = element("div", "pg-tile-stage");
  if (rendered === null) stage.append(element("p", "pg-empty", "Nothing to show"));
  else if (host === "standalone") stage.append(rendered.element);
  else {
    const column = element("div", "column");
    column.append(rendered.element);
    stage.append(column);
  }
  frame.append(stage);
  link.append(head, facts, frame);
  const item = element("li");
  item.append(link);
  return item;
}

/**
 * Scale each tile's render down to the tile's width where it is wider: the
 * column keeps its 710 px, and on the bare page a render takes the tile's width
 * and whatever more its root would scroll. The tile clips the stage's box, so the
 * page never scrolls sideways.
 */
function fitTiles(): void {
  for (const stage of tiles.querySelectorAll<HTMLElement>(".pg-tile-stage")) {
    stage.style.width = "";
    stage.style.transform = "";
    stage.style.marginBottom = "";
    const available = stage.offsetWidth;
    const column = stage.querySelector<HTMLElement>(".column");
    const root = stage.querySelector<HTMLElement>(".wf-root");
    const scrolling = (): boolean => root !== null && root.scrollWidth > root.clientWidth;
    let width = column?.offsetWidth ?? available;
    // A wider bare page can wrap some content, so measure again until nothing scrolls.
    for (let tries = 0; column === null && root !== null && scrolling() && tries < 3; tries += 1) {
      width += root.scrollWidth - root.clientWidth;
      stage.style.width = `${width}px`;
    }
    const ratio = Math.min(1, available / width);
    const tile = stage.closest(".pg-tile");
    const scale = tile?.querySelector<HTMLElement>(".pg-tile-scale");
    if (scale) {
      scale.hidden = ratio === 1;
      scale.textContent = `${Math.floor(ratio * 100)}%`;
    }
    const scrolls = tile?.querySelector<HTMLElement>(".pg-tile-scrolls");
    if (scrolls) scrolls.hidden = !scrolling();
    if (ratio === 1) continue;
    stage.style.width = `${width}px`;
    stage.style.transform = `scale(${ratio})`;
    // The transform leaves the stage's box as tall as before; take up only what shows.
    stage.style.marginBottom = `${(ratio - 1) * stage.offsetHeight}px`;
  }
}

function refresh(): void {
  update();
  showReview();
  showSidebar();
  showOverview();
}

// Opening, saving, adding and approving.

function openExample(example: Example | undefined): void {
  overview = undefined;
  current = example;
  editor.value = example === undefined ? "" : saved(example);
  editor.scrollTop = 0;
  lastGood = null;
  say("");
  refresh();
}

/** Show a group's overview, with nothing open in the editor until a tile or the sidebar opens an example. */
function openOverview(group: string): void {
  overview = group;
  current = undefined;
  editor.value = "";
  lastGood = null;
  say("");
  refresh();
}

async function save(): Promise<void> {
  if (current === undefined || !isDirty()) return;
  const example = current;
  try {
    const { source } = await request<{ source: string }>("PUT", `/api/examples/${example.name}`, { source: editor.value });
    example.source = source;
    say(`Saved examples/${example.name}.wireframe.`);
  } catch (error) {
    say(`Not saved: ${error instanceof Error ? error.message : error}`, true);
  }
  refresh();
}

async function approve(): Promise<void> {
  if (current === undefined || isDirty() || !result.renderable) return;
  const example = current;
  const rendered = renderSaved(example);
  if (rendered === null) return;
  try {
    example.approval = await request<Approval>("PUT", `/api/approvals/${example.name}`, {
      source: example.source,
      markup: rendered.markup,
      stylesheet,
    });
    say(`Approved ${example.name}: examples/${example.name}.approval.json records what you saw. Commit it with the example.`);
  } catch (error) {
    say(`Not approved: ${error instanceof Error ? error.message : error}`, true);
  }
  refresh();
}

async function add(name: string): Promise<void> {
  try {
    const created = await request<{ name: string; source: string }>("POST", "/api/examples", { name, source: editor.value });
    const example: Example = { ...created, approval: null };
    examples = [...examples, example].sort((a, b) => (a.name < b.name ? -1 : 1));
    newName.value = "";
    // The editor already holds its source.
    current = example;
    history.pushState(null, "", `#${example.name}`);
    say(`Added examples/${example.name}.wireframe.`);
  } catch (error) {
    say(`Not added: ${error instanceof Error ? error.message : error}`, true);
  }
  refresh();
}

/**
 * What the address names: GROUP/ for a group's overview, / alone for the
 * ungrouped examples' overview, otherwise an example, such as reference/vocabulary.
 */
function addressed(): string {
  const hash = location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function openFromHash(): void {
  const target = addressed();
  const group = target.endsWith("/") ? target.slice(0, -1) : undefined;
  if (group === undefined ? overview === undefined && target === current?.name : group === overview) return;
  if (isDirty() && !confirm(`Discard the unsaved edits to ${current?.name}?`)) {
    history.replaceState(null, "", current === undefined ? location.pathname : `#${current.name}`);
    return;
  }
  if (group === undefined) openExample(examples.find((example) => example.name === target));
  else openOverview(group);
}

// The toggles, remembered between visits.

function choose<T extends string>(name: string, values: readonly T[], fallback: T, apply: (value: T) => void): void {
  const stored = localStorage.getItem(`wireframe-playground-${name}`) as T | null;
  const initial = stored !== null && values.includes(stored) ? stored : fallback;
  for (const input of document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
    input.checked = input.value === initial;
    input.addEventListener("change", () => {
      localStorage.setItem(`wireframe-playground-${name}`, input.value);
      apply(input.value as T);
    });
  }
  apply(initial);
}

async function start(): Promise<void> {
  const styles = document.createElement("style");
  styles.textContent = getEmbedStyles();
  document.head.append(styles);
  stylesheet = await fingerprint(getEmbedStyles());

  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  choose<Scheme>("scheme", ["light", "dark"], dark ? "dark" : "light", (scheme) => {
    document.documentElement.style.colorScheme = scheme;
  });
  choose<Host>("host", ["standalone", "column"], "standalone", (value) => {
    host = value;
    showPreview(!result.renderable && lastGood !== null);
    showOverview();
  });

  editor.addEventListener("input", update);
  editor.addEventListener("scroll", () => {
    gutter.scrollTop = editor.scrollTop;
  });
  saveButton.addEventListener("click", () => void save());
  approveButton.addEventListener("click", () => void approve());
  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void add(newName.value.trim());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    }
  });
  window.addEventListener("hashchange", openFromHash);
  window.addEventListener("beforeunload", (event) => {
    if (isDirty()) event.preventDefault();
  });
  // A tile's render changes size with the overview's width and with the font.
  let tilesWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry === undefined || entry.contentRect.width === tilesWidth) return;
    tilesWidth = entry.contentRect.width;
    fitTiles();
  }).observe(tiles);
  document.fonts.addEventListener("loadingdone", fitTiles);

  try {
    ({ examples } = await request<{ examples: Example[] }>("GET", "/api/examples"));
  } catch (error) {
    say(`The examples didn't load: ${error instanceof Error ? error.message : error}`, true);
  }
  const target = addressed();
  if (target.endsWith("/")) {
    openOverview(target.slice(0, -1));
    return;
  }
  openExample(examples.find((example) => example.name === target) ?? examples[0]);
  if (current !== undefined) history.replaceState(null, "", `#${current.name}`);
}

void start();
