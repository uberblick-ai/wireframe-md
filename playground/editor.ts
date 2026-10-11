import { parseWireframe, renderWireframe, summarizeWireframe, type WireframeParseResult } from "../src/index.js";
import { type Approval, approvalFingerprint, describeStatus, diffLines, formatMarkup, type Status, statusOf } from "./approval.js";
import { leafOf } from "./catalog.js";

export interface Example {
  name: string;
  source: string;
  approval: Approval | null;
  fingerprint: string | null;
}

export type Host = "standalone" | "column";

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  created.textContent = text;
  return created;
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `${method} ${path} failed: ${response.status}`);
  return value as T;
}

export function renderSaved(example: Example): { element: HTMLElement; markup: string } | null {
  const rendered = renderWireframe(parseWireframe(example.source));
  return rendered === null ? null : { element: rendered, markup: formatMarkup(rendered) };
}

export async function refreshFingerprint(example: Example, stylesheet: string): Promise<void> {
  const rendered = renderSaved(example);
  example.fingerprint = rendered === null ? null : await approvalFingerprint(example.source, stylesheet, rendered.markup);
}

/** One editor owns its draft, last good render and requests, independently of its neighbours. */
export class ExampleEditor {
  readonly section = element("section", "pg-example");
  readonly textarea = element("textarea");
  readonly preview = element("div", "pg-preview");
  readonly diagnostics = element("ol", "pg-diagnostics");
  private readonly gutter = element("pre", "pg-gutter");
  private readonly editor = element("div", "pg-editor");
  private readonly status = element("span", "pg-badge");
  private readonly dirtyMark = element("span", "pg-dirty", "Unsaved edits");
  private readonly staleMark = element("span", "pg-stale", "Stale render");
  private readonly saveButton = element("button", "", "Save");
  private readonly approveButton = element("button", "", "Approve");
  private readonly reviewButton = element("button", "pg-review-button", "Review");
  private readonly review = element("div", "pg-review");
  private readonly summary = element("span", "pg-summary", "ⓘ");
  private readonly notice = element("p", "pg-notice");
  private lastGood: HTMLElement | null = null;
  private result: WireframeParseResult = parseWireframe("");
  private busy = false;
  private host: Host;

  constructor(
    readonly example: Example | undefined,
    private readonly stylesheet: string,
    host: Host,
    private readonly changed: () => void,
  ) {
    this.host = host;
    const id = example?.name ?? "scratch";
    this.section.id = id;
    const heading = element("h3", "", example === undefined ? "Scratch" : leafOf(id));
    heading.id = `${id}-title`;
    this.section.setAttribute("aria-labelledby", heading.id);
    const bar = element("div", "pg-bar");
    bar.append(heading, this.status, this.dirtyMark, this.staleMark, this.summary, this.saveButton, this.approveButton, this.reviewButton);
    this.summary.tabIndex = 0;
    this.saveButton.title = "Save this example (Ctrl+S or ⌘S in its editor)";
    this.review.id = `${id}-review`;
    this.review.hidden = true;
    this.reviewButton.setAttribute("aria-controls", this.review.id);
    this.reviewButton.setAttribute("aria-expanded", "false");
    this.reviewButton.addEventListener("click", () => {
      this.review.hidden = !this.review.hidden;
      this.reviewButton.setAttribute("aria-expanded", String(!this.review.hidden));
      if (!this.review.hidden) this.showReview();
    });
    for (const button of [this.saveButton, this.approveButton, this.reviewButton]) button.type = "button";
    this.textarea.setAttribute("aria-labelledby", heading.id);
    this.textarea.spellcheck = false;
    this.textarea.autocapitalize = "off";
    this.textarea.autocomplete = "off";
    this.textarea.wrap = "off";
    this.textarea.value = this.saved;
    this.gutter.setAttribute("aria-hidden", "true");
    this.editor.append(this.gutter, this.textarea);
    const panes = element("div", "pg-panes");
    panes.append(this.editor, this.preview);
    this.preview.setAttribute("role", "img");
    this.notice.setAttribute("role", "status");
    this.section.append(bar, panes, this.diagnostics, this.review, this.notice);
    this.textarea.addEventListener("input", () => {
      this.update();
      this.changed();
    });
    this.textarea.addEventListener("scroll", () => { this.gutter.scrollTop = this.textarea.scrollTop; });
    this.textarea.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.save();
      }
    });
    this.saveButton.addEventListener("click", () => void this.save());
    this.approveButton.addEventListener("click", () => void this.approve());
    this.update();
  }

  private get saved(): string { return this.example?.source.replace(/\r\n?/g, "\n") ?? ""; }
  get dirty(): boolean { return this.textarea.value !== this.saved; }
  get pending(): boolean { return this.busy; }
  get currentStatus(): Status {
    return !this.result.renderable ? { state: "error" } : this.example === undefined ? { state: "unapproved" } : statusOf(this.example.fingerprint, this.example.approval);
  }

  setHost(host: Host): void {
    this.host = host;
    this.showPreview();
  }

  private update(): void {
    this.result = parseWireframe(this.textarea.value);
    const rendered = renderWireframe(this.result);
    if (rendered !== null) this.lastGood = rendered;
    this.showPreview();
    const count = this.textarea.value.split("\n").length;
    // 20px lines plus one line of breathing room; past 40 lines, scroll.
    this.editor.style.height = `${(Math.min(count, 40) + 1) * 20}px`;
    const marks = new Map<number, string>();
    for (const { line, severity } of this.result.diagnostics) if (marks.get(line) !== "error") marks.set(line, severity);
    this.gutter.replaceChildren(...Array.from({ length: count }, (_, index) =>
      element("span", marks.has(index + 1) ? `pg-${marks.get(index + 1)}` : "", `${index + 1}\n`),
    ));
    this.gutter.scrollTop = this.textarea.scrollTop;
    this.diagnostics.hidden = this.result.diagnostics.length === 0;
    this.diagnostics.replaceChildren(...this.result.diagnostics.map(({ line, severity, message }) => {
      const button = element("button", "pg-diagnostic");
      button.type = "button";
      button.title = `Select line ${line}`;
      button.append(element("span", "pg-line", `line ${line}`), element("span", `pg-severity pg-${severity}`, severity), element("span", "pg-message", message));
      button.addEventListener("click", () => this.selectLine(line));
      const item = element("li");
      item.append(button);
      return item;
    }));
    const summary = summarizeWireframe(this.result);
    this.summary.title = summary;
    this.summary.setAttribute("aria-label", summary);
    this.preview.setAttribute("aria-label", summary);
    this.showControls();
  }

  private showPreview(): void {
    const stale = !this.result.renderable && this.lastGood !== null;
    this.staleMark.hidden = !stale;
    this.staleMark.title = "The source has an error; this is its last render without one.";
    this.preview.classList.toggle("pg-is-stale", stale);
    const content = this.lastGood ?? element("p", "pg-empty", "Nothing to show: the source has an error.");
    const frame = element("div", this.host === "standalone" ? "standalone" : "document");
    if (this.host === "standalone") frame.append(content);
    else {
      const column = element("div", "column");
      column.append(content);
      frame.append(column);
    }
    this.preview.replaceChildren(frame);
  }

  private selectLine(line: number): void {
    const lines = this.textarea.value.split("\n");
    const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
    this.textarea.focus();
    this.textarea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    this.textarea.scrollTop = Math.max(0, (line - 1) * 20 - this.textarea.clientHeight / 3);
    this.gutter.scrollTop = this.textarea.scrollTop;
  }

  private showControls(): void {
    this.dirtyMark.hidden = !this.dirty;
    this.saveButton.disabled = this.example === undefined || !this.dirty || this.busy;
    this.approveButton.disabled = this.example === undefined || this.dirty || !this.result.renderable || this.busy || this.currentStatus.state === "approved";
    this.approveButton.title = !this.result.renderable ? "Fix errors before approving." : this.dirty ? "Save before approving." : "Review light and dark, the bare page and the document column, then approve the saved source.";
    const status = this.currentStatus;
    this.status.textContent = this.example === undefined ? "Scratch" : describeStatus(status);
    this.status.dataset.state = this.example === undefined ? "scratch" : status.state;
    if (!this.review.hidden) this.showReview();
  }

  private say(message: string, failed = false): void {
    this.notice.textContent = message;
    this.notice.classList.toggle("pg-failed", failed);
  }

  private showReview(): void {
    this.review.replaceChildren();
    const approval = this.example?.approval;
    const rendered = this.example === undefined ? this.lastGood : renderSaved(this.example)?.element;
    const markup = rendered === null || rendered === undefined ? null : formatMarkup(rendered);
    if (approval?.approved && approval.markup !== undefined && markup !== null && markup !== approval.markup) {
      const diff = diffLines(approval.markup, markup);
      const sides = element("div", "pg-sides");
      for (const [heading, lines, changed] of [
        ["Approved markup", diff.before, "pg-removed"],
        ["Saved markup", diff.after, "pg-added"],
      ] as const) {
        const column = element("div", "pg-side");
        const pre = element("pre");
        pre.append(...lines.map((line) => element("span", line.changed ? changed : "", line.text)));
        column.append(element("h4", "", heading), pre);
        sides.append(column);
      }
      this.review.append(sides);
    } else if (approval?.approved && approval.markup !== undefined) {
      this.review.append(element("h4", "", "Approved markup"), element("pre", "", approval.markup));
    } else if (markup !== null) {
      this.review.append(element("h4", "", "Markup an approval records"), element("pre", "", markup));
    }
    if (this.currentStatus.state === "changed") {
      this.review.prepend(element("p", "pg-hint", "The saved source, stylesheet or markup changed since approval. Review the render in every scheme and host before approving again."));
      if (approval?.markup === undefined) this.review.append(element("p", "pg-hint", "This approval has only a fingerprint; no previous markup snapshot is available."));
    }
    if (this.dirty) this.review.prepend(element("p", "pg-hint", "This review compares the saved source. Save your edits before approving."));
  }

  async save(): Promise<void> {
    if (this.example === undefined || !this.dirty || this.busy) return;
    this.busy = true;
    this.showControls();
    try {
      const { source } = await request<{ source: string }>("PUT", `/api/examples/${this.example.name}`, { source: this.textarea.value });
      this.example.source = source;
      await refreshFingerprint(this.example, this.stylesheet);
      this.say(`Saved examples/${this.example.name}.wireframe.`);
    } catch (error) {
      this.say(`Not saved: ${error instanceof Error ? error.message : error}`, true);
    } finally {
      this.busy = false;
      this.showControls();
      this.changed();
    }
  }

  private async approve(): Promise<void> {
    if (this.example === undefined || this.dirty || !this.result.renderable || this.busy) return;
    const rendered = renderSaved(this.example);
    if (rendered === null) return;
    this.busy = true;
    this.showControls();
    try {
      this.example.approval = await request<Approval>("PUT", `/api/approvals/${this.example.name}`, {
        source: this.example.source, markup: rendered.markup, stylesheet: this.stylesheet,
      });
      this.say(`Approved ${this.example.name} in examples/approvals.json. Commit the mapping with the example.`);
    } catch (error) {
      this.say(`Not approved: ${error instanceof Error ? error.message : error}`, true);
    } finally {
      this.busy = false;
      this.showControls();
      this.changed();
    }
  }
}
