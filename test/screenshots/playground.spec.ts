import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { createPlayground, listen } from "../../playground/server.js";

// Real browser interactions against a server whose writes go only to private
// synthetic fixtures. Human approval files in the repository are never used.
let scratch: string;
let folder: string;
let server: Server;
let url: string;
const INPUT = "page\n  row\n    input Search";
const SELECT = "page\n  row\n    select Any tag";

test.beforeEach(async ({ page }) => {
  scratch = mkdtempSync(join(tmpdir(), "wireframe-browser-"));
  folder = join(scratch, "examples");
  for (const [name, source] of Object.entries({
    "forms/1-basic-inputs/input": INPUT,
    "forms/1-basic-inputs/long-labels": "page\n  input Long label",
    "forms/1-basic-inputs/select": SELECT,
    "forms/2-simple-forms/two-fields": "page\n  row\n    input First\n    input Second",
    "tables/1-basic-tables/table": "page\n  table\n    row\n      cell Title",
  })) {
    const path = join(folder, `${name}.wireframe`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  server = createPlayground(folder);
  url = await listen(server, 0);
  await page.goto(`${url}#forms/1-basic-inputs`);
  await expect(page.locator("#pg-page-title")).toHaveText("Forms / Basic inputs");
});

test.afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(scratch, { recursive: true, force: true });
});

test("the Banners entry shows every saved example without diagnostics", async ({ page }) => {
  const sources = new URL("../../examples/badges-and-banners/2-banners/", import.meta.url);
  const destination = join(folder, "badges-and-banners/2-banners");
  mkdirSync(destination, { recursive: true });
  for (const file of readdirSync(sources)) {
    if (file.endsWith(".wireframe")) writeFileSync(join(destination, file), readFileSync(new URL(file, sources)));
  }
  await page.goto(`${url}#badges-and-banners/2-banners`);
  await page.reload();
  await expect(page.locator("#pg-page-title")).toHaveText("Badges & banners / Banners");
  await expect(page.locator(".pg-example h3")).toHaveText([
    "archived-banner", "banner-with-actions", "danger-banner", "info-banner", "neutral-banner",
    "stacked-above-page", "success-banner", "warning-banner", "wrapping-text",
  ]);
  await expect(page.locator(".pg-diagnostics:visible")).toHaveCount(0);
  await expect(page.locator(".pg-example .wf-root")).toHaveCount(9);
  await expect(page.locator('.pg-example[id$="/success-banner"] .wf-banner')).toHaveClass("wf-banner wf-success");
  await expect(page.locator('.pg-example[id$="/success-banner"] .wf-icon')).toHaveCount(1);
});

test("entry pages have ordered independent compact editors and collapsed reviews", async ({ page }) => {
  await expect(page.locator(".pg-example h3")).toHaveText(["input", "long-labels", "select"]);
  await expect(page.locator(".pg-items .pg-item-name")).toHaveText(["Basic inputs", "Simple forms", "Basic tables"]);
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  await expect(input.locator(".pg-diagnostics")).toBeHidden();
  await expect(input.locator(".pg-review")).toBeHidden();
  await expect(input.locator(".pg-summary")).toHaveAttribute("title", /Wireframe/);
  await expect(input.locator(".pg-editor")).toHaveCSS("height", "98px");
  const shortHeight = (await input.boundingBox())!.height;
  expect(shortHeight).toBeLessThan(173);
  await input.locator("textarea").fill("page");
  await expect(input.locator(".pg-editor")).toHaveCSS("height", "58px");
  await input.locator("textarea").fill(`page\n${"  text Line\n".repeat(45)}`);
  await expect(input.locator(".pg-editor")).toHaveCSS("height", "838px");
  expect(await input.locator("textarea").evaluate((editor) => editor.scrollHeight > editor.clientHeight)).toBe(true);
  await input.locator("textarea").fill(INPUT);
  await expect(input.locator(".pg-editor")).toHaveCSS("height", "98px");
  await input.locator("textarea").fill(`${INPUT}\n`);
  await expect(input.locator(".pg-editor")).toHaveCSS("height", "118px");
  await input.locator("textarea").fill(INPUT);
  await input.getByRole("button", { name: "Review", exact: true }).click();
  await expect(input.locator(".pg-review")).toBeVisible();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.getByRole("radio", { name: "Document column, 710 px" }).check();
  await expect(page.locator(".pg-preview .column")).toHaveCount(3);
});

test("editors fit every line up to the cap and keep gutters aligned when scrolling", async ({ page }) => {
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  const textarea = input.locator("textarea");
  const gutter = input.locator(".pg-gutter");
  for (const lines of [1, 3, 39, 40]) {
    const source = ["page", ...Array.from({ length: lines - 1 }, () => "  text Line")].join("\n");
    for (const ending of ["", "\n"]) {
      await textarea.fill(source + ending);
      const size = await textarea.evaluate((editor) => ({ client: editor.clientHeight, scroll: editor.scrollHeight }));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
      await expect(gutter.locator("span")).toHaveCount(lines + (ending === "" ? 0 : 1));
      await textarea.evaluate((editor) => { editor.scrollTop = editor.scrollHeight; });
      await expect.poll(() => textarea.evaluate((editor) => editor.scrollTop)).toBe(0);
    }
  }
  for (const ending of ["", "\n"]) {
    await textarea.fill(["page", ...Array.from({ length: 45 }, () => "  text Line")].join("\n") + ending);
    await textarea.evaluate((editor) => { editor.scrollTop = editor.scrollHeight; });
    const bottom = await textarea.evaluate((editor) => editor.scrollHeight - editor.clientHeight);
    expect(bottom).toBeGreaterThan(0);
    await expect.poll(() => textarea.evaluate((editor) => editor.scrollTop)).toBe(bottom);
    await expect.poll(() => gutter.evaluate((editor) => editor.scrollTop)).toBe(bottom);
  }
  await textarea.fill(`${INPUT}\n`);
  await textarea.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await textarea.evaluate((editor) => editor.scrollTop)).toBe(0);
  expect(await gutter.evaluate((editor) => editor.scrollTop)).toBe(0);
});

test("committed examples fit the editor until its documented 40-line cap", async ({ page }) => {
  const textarea = page.locator('[id="forms/1-basic-inputs/input"] textarea');
  const examples = join(import.meta.dirname, "../../examples");
  const files = readdirSync(examples, { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith(".wireframe"));
  expect(files.length).toBeGreaterThan(0);
  for (const path of files) {
    const source = readFileSync(join(examples, path), "utf8");
    await textarea.fill(source);
    const size = await textarea.evaluate((editor) => ({ client: editor.clientHeight, scroll: editor.scrollHeight }));
    if (source.split("\n").length > 40) expect(size.scroll, path).toBeGreaterThan(size.client);
    else expect(size.scroll, path).toBeLessThanOrEqual(size.client);
  }
});

test("save buttons and editor shortcuts save only their own example", async ({ page }) => {
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  const select = page.locator('[id="forms/1-basic-inputs/select"]');
  await input.locator("textarea").fill(`${INPUT} changed`);
  await select.locator("textarea").fill(`${SELECT} changed`);
  await input.locator("textarea").press("Control+s");
  await expect(input.locator(".pg-dirty")).toBeHidden();
  await expect(select.locator(".pg-dirty")).toBeVisible();
  expect(readFileSync(join(folder, "forms/1-basic-inputs/input.wireframe"), "utf8")).toBe(`${INPUT} changed`);
  expect(readFileSync(join(folder, "forms/1-basic-inputs/select.wireframe"), "utf8")).toBe(SELECT);
  await select.locator("textarea").press("Meta+s");
  await expect(select.locator(".pg-dirty")).toBeHidden();
  await input.locator("textarea").fill(INPUT);
  await input.getByRole("button", { name: "Save", exact: true }).click();
  await expect(input.locator(".pg-dirty")).toBeHidden();
  expect(readFileSync(join(folder, "forms/1-basic-inputs/input.wireframe"), "utf8")).toBe(INPUT);
});

test("errors retain each editor's own last good render and diagnostics select their line", async ({ page }) => {
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  const before = await input.locator(".wf-root").textContent();
  await input.locator("textarea").fill('page\n  input "Unclosed');
  await expect(input.locator(".pg-stale")).toBeVisible();
  await expect(input.locator(".wf-root")).toHaveText(before!);
  await expect(input.getByRole("button", { name: "Approve", exact: true })).toBeDisabled();
  await expect(page.locator('[id="forms/1-basic-inputs/select"] .pg-stale')).toBeHidden();
  await input.locator(".pg-diagnostic").click();
  expect(await input.locator("textarea").evaluate((node) => {
    const editor = node as HTMLTextAreaElement;
    return editor.value.slice(editor.selectionStart, editor.selectionEnd);
  })).toBe('  input "Unclosed');
  await input.locator("textarea").fill(INPUT);
  await expect(input.locator(".pg-diagnostics")).toBeHidden();
  await expect(input.locator(".pg-stale")).toBeHidden();
});

test("approval counts, source-only changes and persisted markup diffs", async ({ page }) => {
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  await input.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(input.locator(".pg-badge")).toHaveText("Approved");
  const entry = page.locator('a[href="#forms/1-basic-inputs"]');
  await expect(entry).toContainText("1 of 3 approved");
  await expect(entry.locator(".pg-dot")).toHaveAttribute("data-state", "partial");
  await expect(entry.locator(".pg-badge")).toHaveCount(0);
  const mapping = JSON.parse(readFileSync(join(folder, "approvals.json"), "utf8"));
  expect(mapping["forms/1-basic-inputs/input"].approved).toBe(true);
  expect(mapping["forms/1-basic-inputs/input"].fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  await input.locator("textarea").fill(`${INPUT} `);
  await input.getByRole("button", { name: "Save", exact: true }).click();
  await expect(input.locator(".pg-badge")).toHaveText("Changed since approval");
  await input.locator("textarea").fill(`${INPUT} changed`);
  await input.getByRole("button", { name: "Save", exact: true }).click();
  await expect(input.locator(".pg-dirty")).toBeHidden();
  await page.reload();
  await expect(input.locator(".pg-badge")).toHaveText("Changed since approval");
  await expect(input.locator(".pg-review")).toBeHidden();
  await input.getByRole("button", { name: "Review", exact: true }).click();
  await expect(input.locator(".pg-removed")).toContainText("Search");
  await expect(input.locator(".pg-added")).toContainText("Search changed");
});

test("entry, example and overview addresses survive reload, Back and Forward", async ({ page }) => {
  await page.getByRole("link", { name: "Overview of Forms", exact: true }).click();
  await expect(page).toHaveURL(`${url}#forms/`);
  await expect(page.locator(".pg-overview-entry > h3")).toHaveText(["Basic inputs", "Simple forms"]);
  await expect(page.locator(".pg-tile")).toHaveCount(4);
  await page.locator('a.pg-tile[href="#forms/1-basic-inputs/select"]').click();
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs/select`);
  await expect(page.locator(".pg-example")).toHaveCount(3);
  await page.reload();
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs/select`);
  await expect(page.locator(".pg-example")).toHaveCount(3);
  await page.goBack();
  await expect(page.locator("#pg-page-title")).toHaveText("Forms overview");
  await page.goBack();
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs`);
  await page.goForward();
  await expect(page).toHaveURL(`${url}#forms/`);
});

test("leaving guards any draft; cancellation preserves browser history and all drafts", async ({ page }) => {
  await page.locator('a[href="#forms/2-simple-forms"]').click();
  await page.locator("textarea").fill("page\n  input Draft");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(`${url}#forms/2-simple-forms`);
  await expect(page.locator("textarea")).toHaveValue("page\n  input Draft");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs`);
  await page.locator('[id="forms/1-basic-inputs/select"] textarea').fill("page\n  select Draft");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs`);
  await expect(page.locator('[id="forms/1-basic-inputs/select"] textarea')).toHaveValue("page\n  select Draft");
  await page.evaluate(() => { location.hash = "forms/1-basic-inputs/input"; });
  await expect(page).toHaveURL(`${url}#forms/1-basic-inputs/input`);
  await expect(page.locator('[id="forms/1-basic-inputs/select"] textarea')).toHaveValue("page\n  select Draft");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(page.locator("#pg-page-title")).toHaveText("Scratch");
});

test("Scratch adds new or existing folders, rejects duplicates, and guards unsaved source", async ({ page }) => {
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(page.locator("#pg-add")).toBeVisible();
  await page.locator("textarea").fill(INPUT);
  await expect(page.locator(".pg-scratch-summary")).toBeVisible();
  await expect(page.locator(".pg-scratch-summary")).toHaveText("Wireframe: page");
  await page.locator("#pg-new-family").fill("forms");
  await expect(page.locator("#pg-entries option")).toHaveCount(2);
  await page.locator("#pg-new-entry").fill("1-basic-inputs");
  await page.locator("#pg-new-name").fill("input");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator("#pg-notice")).toContainText("exists");
  await expect(page.locator("textarea")).toHaveValue(INPUT);
  await page.locator("#pg-new-family").fill("new-family");
  await page.locator("#pg-new-entry").fill("1-basic");
  await page.locator("#pg-new-name").fill("new-input");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(`${url}#new-family/1-basic/new-input`);
  expect(readFileSync(join(folder, "new-family/1-basic/new-input.wireframe"), "utf8")).toBe(INPUT);
  await expect(page.locator("#pg-add")).toBeHidden();
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await page.locator("textarea").fill("page Draft");
  await expect(page.locator(".pg-scratch-summary")).toHaveText("Wireframe: page “Draft”");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.locator(".pg-group-head").filter({ hasText: "Forms" }).click();
  await page.locator('a[href="#forms/1-basic-inputs"]').click();
  await expect(page).toHaveURL(`${url}#scratch`);
});

test("families default to collapsed and only hand openings are remembered", async ({ page }) => {
  const forms = page.locator(".pg-group").filter({ has: page.locator('a[href="#forms/1-basic-inputs"]') });
  const tables = page.locator(".pg-group").filter({ has: page.locator('a[href="#tables/1-basic-tables"]') });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("wireframe-playground-opened") ?? "[]"));
  // Old values cannot open a family, and an unaddressed first visit opens only
  // the family containing the default first entry.
  await page.evaluate(() => localStorage.setItem("wireframe-playground-collapsed", "[]"));
  await page.goto(url);
  await expect(page.locator("#pg-page-title")).toHaveText("Forms / Basic inputs");
  await expect(forms).toHaveAttribute("open", "");
  await expect(tables).not.toHaveAttribute("open");
  expect(await stored()).toEqual([]);
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(page.locator(".pg-group[open]")).toHaveCount(0);
  await tables.locator("summary").click();
  expect(await stored()).toEqual(["tables"]);
  await page.reload();
  await expect(page.locator("#pg-page-title")).toHaveText("Scratch");
  await expect(tables).toHaveAttribute("open", "");
  await expect(forms).not.toHaveAttribute("open");
  // The click handler persists before the browser's deferred toggle event.
  await tables.locator("summary").click();
  await page.reload();
  await expect(page.locator("#pg-page-title")).toHaveText("Scratch");
  await expect(tables).not.toHaveAttribute("open");
  expect(await stored()).toEqual([]);
});

test("navigation opens the current family without storing it", async ({ page }) => {
  const forms = page.locator(".pg-group").filter({ has: page.locator('a[href="#forms/1-basic-inputs"]') });
  const tables = page.locator(".pg-group").filter({ has: page.locator('a[href="#tables/1-basic-tables"]') });
  for (const target of ["tables/1-basic-tables", "tables/1-basic-tables/table", "tables/"]) {
    await page.goto(`${url}#${target}`);
    await expect(tables).toHaveAttribute("open", "");
    await expect(forms).not.toHaveAttribute("open");
    await page.reload();
    await expect(tables).toHaveAttribute("open", "");
    expect(await page.evaluate(() => localStorage.getItem("wireframe-playground-opened"))).toBeNull();
  }
  await page.getByRole("link", { name: "Overview of Forms", exact: true }).click();
  await expect(forms).toHaveAttribute("open", "");
  await expect(tables).not.toHaveAttribute("open");
  await page.goBack();
  await expect(tables).toHaveAttribute("open", "");
  await expect(forms).not.toHaveAttribute("open");
  await page.goForward();
  await expect(forms).toHaveAttribute("open", "");
  await expect(tables).not.toHaveAttribute("open");
  // A hand opening survives navigation away from its family.
  await tables.locator("summary").click();
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(tables).toHaveAttribute("open", "");
  await expect(forms).not.toHaveAttribute("open");
});

test("a hand collapse holds through edits, saving and approval until another page is shown", async ({ page }) => {
  const forms = page.locator(".pg-group").filter({ has: page.locator('a[href="#forms/1-basic-inputs"]') });
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  await forms.locator("summary").click();
  await input.locator("textarea").fill(`${INPUT} changed`);
  await expect(forms).not.toHaveAttribute("open");
  await input.getByRole("button", { name: "Save", exact: true }).click();
  await expect(input.locator(".pg-dirty")).toBeHidden();
  await expect(forms).not.toHaveAttribute("open");
  await input.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(input.locator(".pg-badge")).toHaveText("Approved");
  await expect(forms).not.toHaveAttribute("open");
  await page.reload();
  await expect(forms).toHaveAttribute("open", "");
  await forms.locator("summary").click();
  await page.getByRole("link", { name: "Overview of Forms", exact: true }).click();
  await expect(forms).toHaveAttribute("open", "");
});

test("a later family is only opened while its page is shown", async ({ page }) => {
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await page.locator("textarea").fill(INPUT);
  await page.locator("#pg-new-family").fill("later-family");
  await page.locator("#pg-new-entry").fill("1-basic");
  await page.locator("#pg-new-name").fill("input");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const later = page.locator(".pg-group").filter({ has: page.locator('a[href="#later-family/1-basic"]') });
  await expect(later).toHaveAttribute("open", "");
  await page.getByRole("link", { name: "Scratch", exact: true }).click();
  await expect(page.locator(".pg-group[open]")).toHaveCount(0);
  await page.reload();
  await expect(later).not.toHaveAttribute("open");
});

test("sidebar dots show none, some, all and errors with accessible status and counts", async ({ page }) => {
  const family = page.locator(".pg-group-head").filter({ hasText: "Forms" });
  const entry = page.locator('a[href="#forms/1-basic-inputs"]');
  for (const row of [family, entry]) {
    await expect(row.locator(".pg-dot")).toHaveAttribute("data-state", "unapproved");
    await expect(row.locator(".pg-dot")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(row.locator(".pg-dot")).toHaveCSS("border-style", "solid");
    await expect(row).toHaveAccessibleName(/None approved; 0 of \d approved/);
  }
  const input = page.locator('[id="forms/1-basic-inputs/input"]');
  for (const name of ["input", "long-labels", "select"]) {
    await page.locator(`[id="forms/1-basic-inputs/${name}"]`).getByRole("button", { name: "Approve", exact: true }).click();
    await expect(entry.locator(".pg-approved-count")).toHaveText(`${["input", "long-labels", "select"].indexOf(name) + 1} of 3 approved`);
    if (name === "input") {
      for (const row of [family, entry]) {
        await expect(row.locator(".pg-dot")).toHaveAttribute("data-state", "partial");
        await expect(row.locator(".pg-dot")).toHaveCSS("background-image", /linear-gradient\(.*50%.*50%\)/);
        await expect(row).toHaveAccessibleName(/Partly approved; 1 of \d approved/);
      }
    }
  }
  await expect(entry.locator(".pg-dot")).toHaveAttribute("data-state", "approved");
  await expect(entry).toHaveAccessibleName("Basic inputs: All approved; 3 of 3 approved");
  await expect(family.locator(".pg-dot")).toHaveAttribute("data-state", "partial");
  await page.locator('a[href="#forms/2-simple-forms"]').click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(family.locator(".pg-dot")).toHaveAttribute("data-state", "approved");
  await expect(family).toHaveAccessibleName("Forms: All approved; 4 of 4 approved");
  const green = await family.locator(".pg-dot").evaluate((dot) => getComputedStyle(dot).backgroundColor);
  expect(green).not.toBe("rgba(0, 0, 0, 0)");
  await expect(family.locator(".pg-dot")).toHaveCSS("border-color", green);
  // Changed approvals count as unapproved, even for an entry with no other examples.
  await page.locator("textarea").fill("page\n  input Changed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const simple = page.locator('a[href="#forms/2-simple-forms"]');
  await expect(simple.locator(".pg-dot")).toHaveAttribute("data-state", "unapproved");
  await expect(simple.locator(".pg-approved-count")).toHaveText("0 of 1 approved");
  await expect(family.locator(".pg-dot")).toHaveAttribute("data-state", "partial");
  await page.locator('a[href="#forms/1-basic-inputs"]').click();
  await input.locator("textarea").fill('page\n  input "Unclosed');
  for (const row of [family, entry]) {
    await expect(row.locator(".pg-dot")).toHaveAttribute("data-state", "error");
    await expect(row).toHaveAccessibleName(/Has errors; 2 of \d approved/);
    const errorColour = await row.locator(".pg-dot").evaluate((dot) => getComputedStyle(dot).backgroundColor);
    expect(errorColour).not.toBe(green);
    expect(errorColour).not.toBe("rgba(0, 0, 0, 0)");
    await expect(row.locator(".pg-dot")).toHaveCSS("border-color", errorColour);
  }
  await input.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(family.locator(".pg-dot")).toHaveAttribute("data-state", "error");
  await expect(entry.locator(".pg-dot")).toHaveAttribute("data-state", "error");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(family.locator(".pg-dot")).toHaveCSS("border-color", await family.locator(".pg-dot").evaluate((dot) => getComputedStyle(dot).backgroundColor));
});

test("sidebar rows stay on one line and truncate long names without truncating counts", async ({ page }) => {
  const longFamily = "a-family-with-a-very-long-name-that-cannot-fit-in-the-sidebar";
  const longEntry = "an-entry-with-a-very-long-name-that-cannot-fit-in-the-sidebar";
  const path = join(folder, `${longFamily}/${longEntry}/input.wireframe`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, INPUT);
  await page.goto(`${url}#${longFamily}/${longEntry}`);
  await page.reload();
  const family = page.locator(".pg-group-head").filter({ hasText: "A family with" });
  const entry = page.locator(`a[href="#${longFamily}/${longEntry}"]`);
  await expect(family).toHaveAttribute("title", "A family with a very long name that cannot fit in the sidebar: None approved; 0 of 1 approved");
  await expect(entry).toHaveAttribute("title", "An entry with a very long name that cannot fit in the sidebar: None approved; 0 of 1 approved");
  for (const row of [family, entry]) {
    await expect(row).toHaveAccessibleName(await row.getAttribute("title") ?? "");
    const name = row.locator(".pg-group-name, .pg-item-name");
    await expect(name).toHaveCSS("text-overflow", "ellipsis");
    await expect(name).toHaveCSS("white-space", "nowrap");
    expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  }
  // Measure every visible heading and entry, including the long names. Each
  // dot, name and whole count must share the row's vertical centre and fit inside it.
  const rows = page.locator(".pg-group-head:visible, .pg-items .pg-item:visible");
  for (const row of await rows.all()) {
    const layout = await row.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return [...node.children].map((child) => {
        const box = child.getBoundingClientRect();
        return { centre: box.top + box.height / 2, inside: box.left >= rect.left && box.right <= rect.right, whole: child.scrollWidth <= child.clientWidth, count: child.classList.contains("pg-approved-count") };
      });
    });
    expect(Math.max(...layout.map(({ centre }) => centre)) - Math.min(...layout.map(({ centre }) => centre))).toBeLessThan(1);
    expect(layout.every(({ inside }) => inside)).toBe(true);
    expect(layout.find(({ count }) => count)?.whole).toBe(true);
  }
  await expect(page.locator("#pg-groups .pg-badge, #pg-groups .pg-count")).toHaveCount(0);
  await page.getByRole("link", { name: `Overview of ${longFamily.replaceAll("-", " ").replace(/^a/, "A")}`, exact: true }).click();
  await expect(page.locator("#pg-page-title")).toHaveText("A family with a very long name that cannot fit in the sidebar overview");
});

test("unknown addresses are explicit", async ({ page }) => {
  await page.goto(`${url}#forms/missing`);
  await expect(page.locator("#pg-page-title")).toHaveText("View not found");
  await expect(page.locator("#pg-notice")).toContainText("No entry or example");
});
