# wireframe-md

A small text format for wireframes, rendered as clean, themed HTML. Agents write
it in a few lines; people see a wireframe. It is published as
`@uberblick/wireframe` and is built first for
[Uberblick](https://github.com/uberblick-ai/uberblick-2) documents, where a
```` ```wireframe ```` code block shows as a live preview.

````markdown
```wireframe
dialog Delete “Q3 launch draft”?
  text It will be gone for everyone, with its comments and history. This can't be undone.
  row.end
    button.focus Cancel
    button.danger Delete
```
````

Throughout 0.x the format may change in any minor version;
[CHANGELOG.md](CHANGELOG.md) says what changed.

## Install

```sh
pnpm add @uberblick/wireframe
```

The package is an ES module with type declarations and no runtime dependencies.
Rendering needs a DOM, and the stylesheet needs a browser with CSS
`light-dark()` and `color-mix()`: Chrome and Edge 123, Firefox 120, Safari 17.5
or later.

## Usage

Pass the body of a ```` ```wireframe ```` block, without its fences, to
`parseWireframe`. Line 1 of its diagnostics is the first line inside the fence.

```ts
import { parseWireframe, renderWireframe, summarizeWireframe } from "@uberblick/wireframe";
import "@uberblick/wireframe/styles.css";

const source = `banner.warning
  icon archive
  text Archived. Read-only and hidden from the document list.
  row.end
    button Restore
    button.link.danger Delete…`;

const result = parseWireframe(source);

// Every problem, with its line. A warning still renders; an error doesn't.
for (const { line, severity, message } of result.diagnostics) {
  console.warn(`line ${line}: ${severity}: ${message}`);
}

const figure = document.querySelector("figure")!;
// null when the result has an error: keep the last good render and show the diagnostics.
const wireframe = renderWireframe(result);
if (wireframe !== null) figure.replaceChildren(wireframe);
// Wireframe: warning banner “Archived. Read-only and hidden from the document list.”
figure.setAttribute("aria-label", summarizeWireframe(result));
```

- `parseWireframe(source)` never throws. It returns the `nodes`, the
  `diagnostics` (each with `line`, `severity` and `message`, such as
  `button must be directly inside row, cell or frame`) and `renderable`, which is false when any
  diagnostic is an error. An unknown kind, variant or attribute, or a node in
  the wrong place, is a warning, and it still draws. Bad indentation, a broken
  quote or an exceeded limit is an error.
- `renderWireframe(result, document?)` returns a detached `.wf-root` element
  holding static, inert DOM: no scripts, links or focusable controls. It returns
  `null` for a result that isn't renderable.
- `summarizeWireframe(result)` gives one line for the host's accessible label.

### The stylesheet

Every rule sits under `.wf-root`, so the stylesheet styles nothing outside a
wireframe. Add it to the page once, in either of two ways:

- with a bundler that handles CSS: `import "@uberblick/wireframe/styles.css";`
- as a string, for example into a shadow root: `getEmbedStyles()` returns the
  same stylesheet.

```ts
import { getEmbedStyles } from "@uberblick/wireframe";

const style = document.createElement("style");
style.textContent = getEmbedStyles();
document.head.append(style);
```

## The format

One node per line, `kind.variant key=value Label`; two spaces of indentation make a
child. A block can hold several roots, drawn one after another.

Agents writing a block should read [AUTHORING.md](AUTHORING.md) first: the
grammar, every kind and the common mistakes, each with the diagnostic it gets
and its fix. The package ships it as `@uberblick/wireframe/AUTHORING.md`, so a
host can resolve it from the installed package, for example with
`import.meta.resolve("@uberblick/wireframe/AUTHORING.md")`.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral` (default), `.info`, `.warning`, `.danger` | none; its text goes on a `text` line |
| `page` | at the top level | none | none; its title goes on a `text.title` line |
| `text` | directly inside a root, a `card` or a non-table `row` | `.muted`, `.strong`, `.title`, `.small` | the text |
| `row` | directly inside a root, or a `table` as a table row of cells | `.end` aligns its children right; `.head` is a table's header row | none |
| `button` | directly inside a `row` or a `cell` | `.primary`, `.danger`, `.link`, `.focus` | the caption |
| `icon` | directly inside a root, a `cell` or a `button` | `.filled`, outline by default | its exact Tabler name, such as `pin` or `archive` |
| `input` | directly inside a root or a `row` | none | the placeholder |
| `select` | directly inside a root or a `row` | none | the chosen value, in a bordered closed select with a chevron-down |
| `toggle` | directly inside a root or a `row` | none | none; its options are `option` lines |
| `option` | directly inside a `toggle` | `.current` | the caption |
| `table` | directly inside a root | none | none |
| `cell` | directly inside a table row | `.end` right-aligns, with tabular figures; `.sortable`, `.ascending`, `.descending` draw sort arrows | its text, or none |
| `chip` | directly inside a `row` or a `cell` | `.more` is the count of the rest | the tag, or the count |

A `select` shares the input's border, radius, height and padding, with no fill,
its value in ink and a muted stroked chevron-down at the end. The chevron belongs
to select, separate from the icon catalog. Like an input, a select on its own takes the
full width. `label=Role` or `label="Work email"` on an input or select names the
field above its control in ink, while the line's label remains its placeholder
or chosen value. Labelled fields share a row equally unless a control needs a
wider column, with their controls aligned even when a label wraps; long labels
wrap within their column without widening it. An unlabelled select takes its
content's width in a row while an unlabelled input fills the room left. A long
value stays on one line; overflow scrolls inside the wireframe, never the page.
Other attributes, `label=` on the wrong kind and repeated `label=` values warn;
the first field label draws.

A header cell's `.sortable` draws a muted stroked ↕ after its caption;
`.ascending` draws ↑ and `.descending` draws ↓ in ink. The caption stays muted,
and the variants combine with `.end`. A sort variant outside a table's header
row or more than one sort variant on a cell warns and still draws the first.
Mark at most one sorted column per table. Long row text wraps between words
beside the other children. Text in a non-table row keeps its
variants and source order without naming the root in its summary. A sibling
`row.end` below a table can draw pagination with `text.muted`, page buttons and
`button.primary` for the current page. Sorting and paging remain static drawings.

## Theming

A wireframe takes the font family from its host and resets the other text
styles a host passes down. Its colours, strokes, radii and type sizes come from
`--wf-*` custom properties, which a host sets on any ancestor. Every colour has
a light and a dark default, picked by the `color-scheme` the wireframe
inherits.

| Property | Controls | Light default | Dark default |
| --- | --- | --- | --- |
| `--wf-ink` | text, the secondary button's caption, ascending and descending sort arrows | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--wf-muted` | `text.muted`, a frame's bar and caption label, a neutral banner's icon, an icon outside a banner or button, an unknown kind's name, an input's placeholder, a select's chevron-down, options but the current one, a table's header row, sortable arrows, `chip.more` | `oklch(0.511 0 0)` | `oklch(0.708 0 0)` |
| `--wf-paper` | cards, a page, and the secondary button's fill | `oklch(1 0 0)` | `oklch(0.215 0 0)` |
| `--wf-line` | borders: cards, a page, buttons, inputs, selects, a banner's base border, unknown boxes; a table's rules; mixed into a chip's fill | `oklch(0.86 0.004 75)` | `oklch(1 0 0 / 20%)` |
| `--wf-scrim` | the faint backdrop behind a dialog's card | `oklch(0.145 0 0 / 9%)` | `oklch(0 0 0 / 40%)` |
| `--wf-shadow` | the dialog card's `box-shadow` | `0 6px 20px oklch(0 0 0 / 10%)` | `0 6px 20px oklch(0 0 0 / 45%)` |
| `--wf-primary` | `button.primary`'s fill, and `button.link.primary`'s caption | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--wf-primary-ink` | `button.primary`'s caption | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--wf-danger` | the destructive colour: `button.danger`, and `banner.danger`'s icon and border; red icons and text | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--wf-danger-ink` | the caption on a filled `button.primary.danger` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--wf-focus` | `button.focus`'s ring | `oklch(0.72 0.16 65)` | `oklch(0.8 0.18 65)` |
| `--wf-info` | `banner.info`'s icon and border; blue icons and text | `oklch(0.55 0.15 250)` | `oklch(0.75 0.12 250)` |
| `--wf-warning` | `banner.warning`'s icon and border; amber icons and text (light text mixes 80% warning with 20% ink) | `oklch(0.66 0.13 70)` | `oklch(0.78 0.14 75)` |
| `--wf-success` | `banner.success`'s icon and border; green icons and text | `oklch(0.55 0.15 150)` | `oklch(0.75 0.14 150)` |
| `--wf-neutral-tint` | a neutral banner's and a frame's fill | `oklch(0.985 0.002 75)` | `oklch(0.2 0.004 65)` |
| `--wf-info-tint` | `banner.info`'s fill | `oklch(0.965 0.02 250)` | `oklch(0.24 0.035 250)` |
| `--wf-warning-tint` | `banner.warning`'s fill | `oklch(0.975 0.022 85)` | `oklch(0.24 0.035 75)` |
| `--wf-danger-tint` | `banner.danger`'s fill | `oklch(0.96 0.025 27.325)` | `oklch(0.25 0.04 22.216)` |
| `--wf-success-tint` | `banner.success`'s fill | `oklch(0.965 0.025 150)` | `oklch(0.24 0.035 150)` |

The sizes are the same in light and dark.

| Property | Controls | Default |
| --- | --- | --- |
| `--wf-stroke` | border width; a frame's left bar is three times it; select chevron and cell sort strokes are one and a half times it on a 16-unit grid, and icons match on Tabler's 24-unit grid | `1px` |
| `--wf-focus-width` | the focus ring's width | `2px` |
| `--wf-radius` | cards, a frame's right corners, buttons, banners, inputs, selects, chips and unknown boxes | `6px` |
| `--wf-radius-lg` | the dialog's card and scrim, and a page | `10px` |
| `--wf-text-size` | the base type size; spacing, chips and `text.small` scale with it | `0.875rem` |
| `--wf-title-size` | the dialog's title and a card's direct `text.title`; other `text.title` is one and a half times it, unless combined with `.small` | `1rem` |

### Mapping a host's tokens

Point the properties at the host's own tokens on an ancestor of the wireframes,
and set `color-scheme` where the host switches themes, so the defaults you don't
map switch too:

```css
.document {
  color-scheme: light;
  --wf-ink: var(--foreground);
  --wf-muted: var(--muted-foreground);
  --wf-paper: var(--card);
  --wf-line: var(--border);
  --wf-primary: var(--primary);
  --wf-primary-ink: var(--primary-foreground);
  --wf-danger: var(--destructive);
  --wf-radius: var(--radius-sm);
}

.dark .document {
  color-scheme: dark;
}
```

Tokens that already switch with the host's theme need nothing more. A token
that holds one value for both themes takes a pair, with `light-dark()` or a rule
per theme:

```css
.document {
  --wf-info: light-dark(var(--blue-600), var(--blue-300));
}
```

Setting `color-scheme` on an ancestor is also how a host forces one scheme; the
wireframe follows without a re-render.

## Playground

A page in this repository for trying the format and the renderer without
Uberblick. It is a development tool in `playground/`, outside the package.

```sh
mise run playground
```

It installs the dependencies first, then starts a server on `localhost`, port 4610 or a free one when that is taken,
and prints its URL. It renders with the package's sources, transpiled on each
request, so a reload shows the current code without a build.

- The sidebar has collapsible **families** of **entries**, with one line per
  row. Families start collapsed except those you opened by hand and the one
  holding the current page. Hand openings are remembered across reloads; the
  current family's opening is temporary. A hand collapse holds until another
  page is shown. Long names truncate; approval counts stay whole. Opening an entry
  shows all its examples on one scrollable page, each with a compact bar for its
  name, status, unsaved mark, **Save**, **Approve** and **Review**. Its source sits
  beside its render. Editors grow and shrink with the source, with one extra line
  of room, and scroll only past 40 lines. Diagnostics appear only when present;
  clicking one selects its line. The summary is the render accessible label and
  the bar information tooltip. Approval reviews stay collapsed until opened.
- Each example is a block body without fences, saved at
  `examples/FAMILY/ENTRY/NAME.wireframe`. Every segment uses lowercase letters
  and digits joined by hyphens, at most 64 characters. No other depth is listed
  or writable; `mise run test` fails for a file that would be missing from the
  sidebar, or a source with an error. Warnings are allowed.
- Families and entries sort by folder name. A leading number and hyphen orders
  a folder and stays out of its label: `1-basic-inputs` reads "Basic inputs" and
  comes before `2-simple-forms` and `10-advanced-forms`. Numbered folders come
  first, in number order; the rest follow alphabetically. Labels otherwise
  follow the usual convention: `badges-and-banners` reads "Badges & banners".
  Examples within an entry sort by name.
- **Save**, or Ctrl+S / ⌘S in an editor, saves that example. Approve records
  only the saved source and refuses errors. A source with an error keeps its own
  last good render, marked stale. Leaving a page with any unsaved edits asks
  first. The toggles switch light and dark, and the bare page and Uberblick 710 px
  document column.
- The grid button on a family heading opens its **overview**: one tile per
  example, under a heading per entry. Tiles show saved renders, status and
  warning counts, and follow the toggles. A render wider than its tile is scaled
  down and marked with its scale; one that scrolls sideways is marked "Scrolls".
  A tile opens its example on the entry page.
- Each view has an address: `#forms/1-basic-inputs` opens an entry;
  `#forms/1-basic-inputs/select` opens the same page scrolled to Select;
  `#forms/` opens the Forms overview. A reload, shared link, Back and Forward
  return to the same view. An unknown address is shown explicitly.
- **Scratch** (`#scratch`) holds one unsaved editor, render, diagnostics and
  summary. Its Add form asks for family, entry and name, with suggestions from
  existing folders and examples. New folders are created as needed; a name
  already in that entry or any bad segment is refused. Add saves the Scratch
  source and opens the new example on its entry page.

### Approval

**Approve** writes only `examples/approvals.json`, a formatted mapping with
sorted example ids (their paths without `.wireframe`). Each entry has
`{ "approved": true, "fingerprint": "sha256:…" }`; the fingerprint covers the
saved source, stylesheet and markup. The control also stores `markup` and
`stylesheet` review snapshots in the same entry so Review can show approved
markup or a diff against the current saved render. Minimal fingerprint-only
entries are supported, but have no previous markup to diff. `approved: false`
is treated as unapproved. Commit the mapping with the examples.

Each example is approved, changed since approval, not yet approved, or has
errors. Sidebar entries and families show a dot and a count such as "3 of 5
approved" on one line: full green when all are approved, half green when some
are, and an empty outline when none are. Changed examples count as not approved;
any example with an error makes its entry and family dots the error colour.
The full name, dot meaning and count are also in each row's title and accessible
name. Changes to the source, parser, renderer or stylesheet that
alter an approval fingerprint flag the example. One approval covers both
schemes and hosts; look at each before approving.

Approvals belong to people: agents never create, change, move or delete
`examples/approvals.json` or legacy `*.approval.json` files. This layout changes
example ids, so moved examples are not yet approved until a person approves
again. The implementation PR lists every old and new id for local approvals.

## Credits

The format borrows ideas from [Wireloom](https://www.npmjs.com/package/wireloom)
(MIT, © 2026 Brad Wardell). Any code taken from it is listed in
`THIRD_PARTY_NOTICES.md`.

## Licence

MIT
