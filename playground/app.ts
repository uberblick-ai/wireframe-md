import { getEmbedStyles, parseWireframe } from "../src/index.js";
import { describeStatus, fingerprint, type Status, statusOf } from "./approval.js";
import { compareFolders, compareNames, entryOf, familyOf, folderLabel, leafOf, validName } from "./catalog.js";
import { element, type Example, ExampleEditor, type Host, refreshFingerprint, renderSaved, request } from "./editor.js";

// Families contain entries; each entry is a page of independent editors.
type Route = { page: string; kind: "scratch" | "entry" | "family" | "missing"; key: string; example?: string };
const COLLAPSED = "wireframe-playground-collapsed";
const SVG = "http://www.w3.org/2000/svg";

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`the page lacks #${id}`);
  return found as T;
}

const groupList = byId("pg-groups");
const page = byId("pg-page");
const pageTitle = byId("pg-page-title");
const content = byId("pg-content");
const notice = byId("pg-notice");
const addForm = byId<HTMLFormElement>("pg-add");
const newFamily = byId<HTMLInputElement>("pg-new-family");
const newEntry = byId<HTMLInputElement>("pg-new-entry");
const newName = byId<HTMLInputElement>("pg-new-name");
const families = byId<HTMLDataListElement>("pg-families");
const entries = byId<HTMLDataListElement>("pg-entries");
const names = byId<HTMLDataListElement>("pg-names");

let examples: Example[] = [];
let editors: ExampleEditor[] = [];
let active: Route = { page: "", kind: "scratch", key: "scratch" };
let stylesheet = "";
let host: Host = "standalone";
let historyIndex = 0;
let acceptedHash = "";
let returning = false;
let adding = false;

const membersOf = (key: string): Example[] => examples.filter((example) => entryOf(example.name) === key);
const familyMembers = (key: string): Example[] => examples.filter((example) => familyOf(example.name) === key);
const entryKeys = (members: Example[]): string[] => [...new Set(members.map((example) => entryOf(example.name)))].sort((a, b) => compareFolders(leafOf(a), leafOf(b)));
const statusOfExample = (example: Example): Status => editors.find((editor) => editor.example === example)?.currentStatus ?? statusOf(example.fingerprint, example.approval);

function say(message: string, failed = false): void {
  notice.textContent = message;
  notice.classList.toggle("pg-failed", failed);
}

function collapsedFamilies(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function reviewCounts(members: Example[], target: HTMLElement): Status["state"] {
  const states = members.map((example) => statusOfExample(example).state);
  const approved = states.filter((state) => state === "approved").length;
  const state = states.includes("error") ? "error" : states.includes("changed") ? "changed" : approved === members.length ? "approved" : "unapproved";
  target.append(element("span", "pg-approved-count", `${approved} of ${members.length} approved`));
  if (approved < members.length) {
    const badge = element("span", "pg-badge", `${members.length - approved} to review`);
    badge.dataset.state = state;
    target.append(badge);
  }
  return state;
}

function showSidebar(): void {
  const keys = [...new Set(examples.map((example) => familyOf(example.name)))].sort(compareFolders);
  const collapsed = collapsedFamilies();
  groupList.replaceChildren(...keys.map((key) => {
    const members = familyMembers(key);
    const details = element("details", "pg-group");
    details.open = !collapsed.has(key);
    const heading = element("summary", "pg-group-head");
    heading.append(element("span", "pg-group-name", folderLabel(key)), element("span", "pg-count", String(members.length)));
    reviewCounts(members, heading);
    // Persist in the activation itself: the native toggle event is deferred,
    // so an immediate reload could otherwise lose the last collapse.
    heading.addEventListener("click", (event) => {
      event.preventDefault();
      details.open = !details.open;
      const stored = collapsedFamilies();
      if (details.open) stored.delete(key);
      else stored.add(key);
      localStorage.setItem(COLLAPSED, JSON.stringify([...stored]));
    });
    const list = element("ul", "pg-items");
    list.append(...entryKeys(members).map((entry) => {
      const link = element("a", "pg-item");
      link.href = `#${entry}`;
      if (active.page === `entry:${entry}`) link.setAttribute("aria-current", "page");
      const dot = element("span", "pg-dot");
      dot.setAttribute("aria-hidden", "true");
      link.append(dot, element("span", "pg-item-name", folderLabel(leafOf(entry))));
      const state = reviewCounts(membersOf(entry), link);
      dot.dataset.state = state;
      link.title = `${folderLabel(leafOf(entry))}: ${describeStatus({ state })}`;
      const item = element("li"); item.append(link); return item;
    }));
    details.append(heading, list);
    const opener = element("a", "pg-opener");
    opener.href = `#${key}/`;
    opener.title = `Overview of ${folderLabel(key)}`;
    opener.setAttribute("aria-label", opener.title);
    if (active.page === `family:${key}`) opener.setAttribute("aria-current", "page");
    opener.append(gridIcon());
    const wrap = element("div", "pg-group-wrap"); wrap.append(opener, details); return wrap;
  }));
  const scratch = byId<HTMLAnchorElement>("pg-scratch");
  if (active.kind === "scratch") scratch.setAttribute("aria-current", "page");
  else scratch.removeAttribute("aria-current");
}

function gridIcon(): SVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true");
  const squares = document.createElementNS(SVG, "path");
  squares.setAttribute("d", "M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z");
  svg.append(squares); return svg;
}

/** Tiles grouped by entry, rendered from saved sources. */
function showOverview(key: string): void {
  content.replaceChildren(...entryKeys(familyMembers(key)).map((entry) => {
    const section = element("section", "pg-overview-entry");
    const list = element("ul", "pg-tiles"); list.append(...membersOf(entry).map(tile));
    section.append(element("h3", "", folderLabel(leafOf(entry))), list); return section;
  }));
  fitTiles();
}

function tile(example: Example): HTMLElement {
  const rendered = renderSaved(example);
  const status = statusOfExample(example);
  const warnings = parseWireframe(example.source).diagnostics.filter(({ severity }) => severity === "warning").length;
  const link = element("a", "pg-tile"); link.href = `#${example.name}`;
  const dot = element("span", "pg-dot"); dot.dataset.state = status.state;
  const scale = element("span", "pg-tile-mark pg-tile-scale"); scale.title = "Scaled down to fit the tile";
  const scrolls = element("span", "pg-tile-mark pg-tile-scrolls", "Scrolls"); scrolls.title = "Wider than its host: the wireframe scrolls sideways";
  for (const mark of [scale, scrolls]) { mark.hidden = true; mark.setAttribute("aria-hidden", "true"); }
  const heading = element("span", "pg-tile-head"); heading.append(dot, element("span", "pg-item-name", leafOf(example.name)), scrolls, scale);
  const facts = element("span", "pg-tile-facts", describeStatus(status));
  if (warnings > 0) facts.append(element("span", "pg-tile-warnings", warnings === 1 ? "1 warning" : `${warnings} warnings`));
  const frame = element("div", `pg-tile-frame ${host === "standalone" ? "standalone" : "document"}`); frame.inert = true;
  const stage = element("div", "pg-tile-stage");
  if (rendered === null) stage.append(element("p", "pg-empty", "Nothing to show"));
  else if (host === "standalone") stage.append(rendered.element);
  else { const column = element("div", "column"); column.append(rendered.element); stage.append(column); }
  frame.append(stage); link.append(heading, facts, frame);
  const item = element("li"); item.append(link); return item;
}

function fitTiles(): void {
  for (const stage of content.querySelectorAll<HTMLElement>(".pg-tile-stage")) {
    stage.style.width = ""; stage.style.transform = ""; stage.style.marginBottom = "";
    const available = stage.offsetWidth;
    const column = stage.querySelector<HTMLElement>(".column");
    const root = stage.querySelector<HTMLElement>(".wf-root");
    const scrolling = (): boolean => root !== null && root.scrollWidth > root.clientWidth;
    let width = column?.offsetWidth ?? available;
    for (let tries = 0; column === null && root !== null && scrolling() && tries < 3; tries += 1) {
      width = Math.max(width, root.scrollWidth); stage.style.width = `${width}px`;
    }
    const ratio = Math.min(1, available / width);
    const scale = stage.closest(".pg-tile")?.querySelector<HTMLElement>(".pg-tile-scale");
    if (scale) { scale.hidden = ratio === 1; scale.textContent = `${Math.floor(ratio * 100)}%`; }
    const scrolls = stage.closest(".pg-tile")?.querySelector<HTMLElement>(".pg-tile-scrolls");
    if (scrolls) scrolls.hidden = !scrolling();
    if (ratio === 1) continue;
    stage.style.width = `${width}px`; stage.style.transform = `scale(${ratio})`;
    stage.style.marginBottom = `${(ratio - 1) * stage.offsetHeight}px`;
  }
}

function resolve(target: string): Route {
  if (target === "scratch") return { kind: "scratch", page: "scratch", key: target };
  if (target.endsWith("/") && familyMembers(target.slice(0, -1)).length > 0) {
    const key = target.slice(0, -1); return { kind: "family", page: `family:${key}`, key };
  }
  if (validName(target) && examples.some((example) => example.name === target)) return { kind: "entry", page: `entry:${entryOf(target)}`, key: entryOf(target), example: target };
  if (target.split("/").length === 2 && membersOf(target).length > 0) return { kind: "entry", page: `entry:${target}`, key: target };
  return { kind: "missing", page: `missing:${target}`, key: target };
}

function addressed(): string {
  try { return decodeURIComponent(location.hash.slice(1)); }
  catch { return location.hash.slice(1); }
}

function show(next: Route): void {
  if (next.page !== active.page) {
    editors = []; content.replaceChildren(); say("");
    addForm.hidden = next.kind !== "scratch";
    if (next.kind === "entry") {
      pageTitle.textContent = `${folderLabel(familyOf(next.key))} / ${folderLabel(leafOf(next.key))}`;
      editors = membersOf(next.key).map((example) => new ExampleEditor(example, stylesheet, host, showSidebar));
      content.append(...editors.map((editor) => editor.section));
    } else if (next.kind === "scratch") {
      pageTitle.textContent = "Scratch";
      editors = [new ExampleEditor(undefined, stylesheet, host, showSidebar)];
      const scratch = editors[0]; if (scratch !== undefined) content.append(scratch.section);
      suggestNames();
    } else if (next.kind === "family") {
      pageTitle.textContent = `${folderLabel(next.key)} overview`; showOverview(next.key);
    } else {
      pageTitle.textContent = "View not found";
      say(`No entry or example at #${next.key}. Choose an entry or Scratch in the sidebar.`, true);
    }
    window.scrollTo(0, 0);
  }
  active = next; showSidebar();
  if (next.example !== undefined) document.getElementById(next.example)?.scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
}

function mayLeave(next: Route): boolean {
  if (next.page === active.page) return true;
  if (adding || editors.some((editor) => editor.pending)) { say("Wait for the save or approval to finish."); return false; }
  return !editors.some((editor) => editor.dirty) || confirm("Discard the unsaved edits on this page?");
}

function navigate(target: string): void {
  const next = resolve(target);
  if (!mayLeave(next)) return;
  if (`#${target}` === acceptedHash) { show(next); return; }
  historyIndex += 1; acceptedHash = `#${target}`;
  history.pushState({ playgroundIndex: historyIndex }, "", acceptedHash); show(next);
}

/** Cancelled Back/Forward restores the history position, preserving both views. */
function fromHistory(): void {
  if (returning) { if (location.hash === acceptedHash) returning = false; return; }
  if (location.hash === acceptedHash) {
    if (typeof history.state?.playgroundIndex === "number") historyIndex = history.state.playgroundIndex;
    return;
  }
  const next = resolve(addressed());
  const index: number = typeof history.state?.playgroundIndex === "number" ? history.state.playgroundIndex : historyIndex + 1;
  if (!mayLeave(next)) { returning = true; history.go(historyIndex - index); return; }
  historyIndex = index; acceptedHash = location.hash;
  history.replaceState({ playgroundIndex: index }, "", location.href); show(next);
}

function suggestNames(): void {
  const options = (values: string[]): HTMLOptionElement[] => [...new Set(values)].sort(compareFolders).map((value) => {
    const option = element("option"); option.value = value; return option;
  });
  families.replaceChildren(...options(examples.map((example) => familyOf(example.name))));
  entries.replaceChildren(...options(familyMembers(newFamily.value).map((example) => example.name.split("/")[1] ?? "")));
  names.replaceChildren(...options(membersOf(`${newFamily.value}/${newEntry.value}`).map((example) => leafOf(example.name))));
}

async function add(): Promise<void> {
  const scratch = editors[0];
  if (active.kind !== "scratch" || scratch === undefined || adding) return;
  const name = `${newFamily.value}/${newEntry.value}/${newName.value}`;
  if (!validName(name)) { say("Use lowercase letters and digits joined by hyphens, at most 64 characters for each family, entry and name.", true); return; }
  adding = true;
  scratch.textarea.readOnly = true;
  const button = addForm.querySelector("button"); if (button !== null) button.disabled = true;
  try {
    const created = await request<{ name: string; source: string }>("POST", "/api/examples", { name, source: scratch.textarea.value });
    const example: Example = { ...created, approval: null, fingerprint: null };
    await refreshFingerprint(example, stylesheet);
    examples.push(example); examples.sort((a, b) => compareNames(a.name, b.name)); newName.value = "";
    // Add saved the draft; navigate without a discard prompt for that source.
    adding = false; editors = []; navigate(name); say(`Added examples/${name}.wireframe.`);
  } catch (error) { say(`Not added: ${error instanceof Error ? error.message : error}`, true); }
  finally { adding = false; scratch.textarea.readOnly = false; if (button !== null) button.disabled = false; }
}

function choose<T extends string>(name: string, values: readonly T[], fallback: T, apply: (value: T) => void): void {
  const stored = localStorage.getItem(`wireframe-playground-${name}`) as T | null;
  const initial = stored !== null && values.includes(stored) ? stored : fallback;
  for (const input of document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
    input.checked = input.value === initial;
    input.addEventListener("change", () => { localStorage.setItem(`wireframe-playground-${name}`, input.value); apply(input.value as T); });
  }
  apply(initial);
}

async function start(): Promise<void> {
  document.head.append(element("style", "", getEmbedStyles()));
  stylesheet = await fingerprint(getEmbedStyles());
  choose("scheme", ["light", "dark"], matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", (scheme) => { document.documentElement.style.colorScheme = scheme; });
  choose<Host>("host", ["standalone", "column"], "standalone", (value) => {
    host = value; for (const editor of editors) editor.setHost(host);
    if (active.kind === "family") showOverview(active.key);
  });
  addForm.addEventListener("submit", (event) => { event.preventDefault(); void add(); });
  newFamily.addEventListener("input", suggestNames); newEntry.addEventListener("input", suggestNames);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (link === null) return;
    event.preventDefault(); navigate(link.hash.slice(1));
  });
  window.addEventListener("popstate", fromHistory); window.addEventListener("hashchange", fromHistory);
  window.addEventListener("beforeunload", (event) => { if (adding || editors.some((editor) => editor.dirty || editor.pending)) event.preventDefault(); });
  let width = 0;
  new ResizeObserver(([entry]) => {
    if (entry === undefined || entry.contentRect.width === width) return;
    width = entry.contentRect.width; fitTiles();
  }).observe(page);
  document.fonts.addEventListener("loadingdone", fitTiles);
  try {
    const listed = await request<{ examples: Omit<Example, "fingerprint">[] }>("GET", "/api/examples");
    examples = listed.examples.map((example) => ({ ...example, fingerprint: null }));
    await Promise.all(examples.map((example) => refreshFingerprint(example, stylesheet)));
  } catch (error) { say(`The examples didn't load: ${error instanceof Error ? error.message : error}`, true); return; }
  const target = addressed() || (examples[0] === undefined ? "scratch" : entryOf(examples[0].name));
  historyIndex = typeof history.state?.playgroundIndex === "number" ? history.state.playgroundIndex : 0;
  acceptedHash = `#${target}`;
  history.replaceState({ playgroundIndex: historyIndex }, "", acceptedHash); show(resolve(target));
}

void start();
