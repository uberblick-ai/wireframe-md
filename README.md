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
  `button must be inside row`) and `renderable`, which is false when any
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

One node per line, `kind.variant Label`; two spaces of indentation make a
child. A block can hold several roots, drawn one after another.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral` (default), `.info`, `.warning`, `.danger` | none; its text goes on a `text` line |
| `text` | directly inside a root | `.muted`, `.strong` | the text |
| `row` | directly inside a root | `.end` aligns its buttons right | none |
| `button` | directly inside a `row` | `.primary`, `.danger`, `.link`, `.focus` | the caption |
| `icon` | directly inside a root | none | its name: `archive` |

## Theming

A wireframe takes the font family from its host and resets the other text
styles a host passes down. Its colours, strokes, radii and type sizes come from
`--wf-*` custom properties, which a host sets on any ancestor. Every colour has
a light and a dark default, picked by the `color-scheme` the wireframe
inherits.

| Property | Controls | Light default | Dark default |
| --- | --- | --- | --- |
| `--wf-ink` | text, and the secondary button's caption | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--wf-muted` | `text.muted`, a neutral banner's icon, an icon outside a banner, an unknown kind's name | `oklch(0.511 0 0)` | `oklch(0.708 0 0)` |
| `--wf-paper` | the dialog's card and the secondary button's fill | `oklch(1 0 0)` | `oklch(0.215 0 0)` |
| `--wf-line` | borders: the card, buttons, a banner's base border, unknown boxes | `oklch(0.86 0.004 75)` | `oklch(1 0 0 / 20%)` |
| `--wf-scrim` | the faint backdrop behind a dialog's card | `oklch(0.145 0 0 / 9%)` | `oklch(0 0 0 / 40%)` |
| `--wf-shadow` | the dialog card's `box-shadow` | `0 6px 20px oklch(0 0 0 / 10%)` | `0 6px 20px oklch(0 0 0 / 45%)` |
| `--wf-primary` | `button.primary`'s fill, and `button.link.primary`'s caption | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--wf-primary-ink` | `button.primary`'s caption | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--wf-danger` | the destructive colour: `button.danger`, and `banner.danger`'s icon and border | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--wf-danger-ink` | the caption on a filled `button.primary.danger` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--wf-focus` | `button.focus`'s ring | `oklch(0.72 0.16 65)` | `oklch(0.8 0.18 65)` |
| `--wf-info` | `banner.info`'s icon and border | `oklch(0.55 0.15 250)` | `oklch(0.75 0.12 250)` |
| `--wf-warning` | `banner.warning`'s icon and border | `oklch(0.66 0.13 70)` | `oklch(0.78 0.14 75)` |
| `--wf-neutral-tint` | a neutral banner's fill | `oklch(0.985 0.002 75)` | `oklch(0.2 0.004 65)` |
| `--wf-info-tint` | `banner.info`'s fill | `oklch(0.965 0.02 250)` | `oklch(0.24 0.035 250)` |
| `--wf-warning-tint` | `banner.warning`'s fill | `oklch(0.975 0.022 85)` | `oklch(0.24 0.035 75)` |
| `--wf-danger-tint` | `banner.danger`'s fill | `oklch(0.96 0.025 27.325)` | `oklch(0.25 0.04 22.216)` |

The sizes are the same in light and dark.

| Property | Controls | Default |
| --- | --- | --- |
| `--wf-stroke` | border width; icon strokes are one and a half times it | `1px` |
| `--wf-focus-width` | the focus ring's width | `2px` |
| `--wf-radius` | buttons, banners and unknown boxes | `6px` |
| `--wf-radius-lg` | the dialog's card and scrim | `10px` |
| `--wf-text-size` | the base type size; spacing scales with it | `0.875rem` |
| `--wf-title-size` | the dialog's title | `1rem` |

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

It starts a server on `localhost`, port 4610 or a free one when that is taken,
and prints its URL. It renders with the package's sources, transpiled on each
request, so a reload shows the current code without a build.

- Edit a source on the left. On the right are its render, its diagnostics and
  its `summarizeWireframe` line. A source with an error keeps its last good
  render, marked stale. The toggles switch between light and dark, and between a
  bare page and Uberblick's 710 px document column.
- The gallery shows the examples in `examples/`: one `.wireframe` file each,
  holding the body of a ```` ```wireframe ```` block without its fences. Open
  one to edit it, save it with **Save** (Ctrl+S or ⌘S), or save the editor's
  source as a new example. `mise run test` fails when an example has an error;
  a warning is fine.

### Approval

**Approve** records what you saw in `examples/NAME.approval.json`, next to the
example: its saved source, the rendered markup, one element per line, and a
fingerprint of the stylesheet. Commit it with the example. It approves the
source as saved, so save first, and it refuses a source with an error. Scheme
and host change neither the markup nor the stylesheet, so one approval covers
every toggle: look at each before approving.

The gallery marks each example approved, changed since approval (its markup,
the stylesheet, or both), or not yet approved. When a change to the parser, the
renderer or the stylesheet alters how an approved example looks, it shows as
changed. Open it to read its approved markup beside the current markup, look at
the render, and approve it again if it is right.

Approval files belong to people: agents never create, change or delete them.

## Credits

The format borrows ideas from [Wireloom](https://www.npmjs.com/package/wireloom)
(MIT, © 2026 Brad Wardell). Any code taken from it is listed in
`THIRD_PARTY_NOTICES.md`.

## Licence

MIT
