# Writing a wireframe

A primer for agents who write ```` ```wireframe ```` blocks in Format v0.1 of
`@uberblick/wireframe`. Read it before you write a block. Throughout 0.x the format
may change in any minor version, and this primer changes with it. A test checks
every example here against the parser.

## The block

A wireframe is a fenced code block whose info string is exactly `wireframe`, with
nothing else on the fence line. Options never go on the fence line.

````markdown
```wireframe
dialog Delete “Q3 launch draft”?
  text It will be gone for everyone, with its comments and history. This can't be undone.
  row.end
    button.focus Cancel
    button.danger Delete
```
````

Line 1 is the first line inside the fence. Diagnostics count lines from there.

## Lines

Each line is one node:

```text
kind.variant#id key=value Label
```

- **kind** is the first word, from the table under [Kinds](#kinds).
- **.variant** is a dot class on the kind, from that kind's list. Variants combine:
  `button.link.danger`.
- **#id** is optional and comes last in the first word: `button.danger#delete`. It
  uses letters, digits, `-` and `_`, names the node for later tooling and doesn't
  change the drawing.
- **key=value** is an attribute between the first word and the line's label.
  v0.1 defines `label` on `input` and `select`: `label=Role` or
  `label="Work email"`. Values with spaces use quotes and the same escapes as a
  quoted label; a quoted attribute must be followed by a space or the line's end.
  Other attributes get a warning. A repeated `label=` warns and uses the first
  value; `label=` on any other kind warns and doesn't change its drawing.
- **Label** is the rest of the line, as plain text, without trailing spaces.
  Markdown isn't formatted, so `*draft*` shows its asterisks. Typographic quotes
  such as “ ” and ’ are plain text.

**Quotes.** A label needs quotes only where it would be read as an attribute: when
it starts with `word=`, meaning a letter, then letters, digits, `-` or `_`, then
`=`. A label that starts with `"` is a quoted label, so quote all of it. Inside
quotes, `\"` stands for `"` and `\\` for `\`, and any other backslash stays as
written. The closing quote must be on the same line and must end it.

```wireframe
dialog "width=2 is the default"
  text "\"Draft\" pages stay private."
  text Outside quotes, \ and “curly quotes” are plain text.
```

**Indentation.** Two spaces make a child. Indent with spaces only, in steps of two,
at most one level deeper than the line above. The first line has none. A line may
come back out any number of levels.

**Blank lines and several roots.** Blank lines are skipped, but they count toward
line numbers. A block may hold several roots, drawn one after another. An empty
block draws nothing.

```wireframe
banner.info
  text Changes save as you type.

dialog Rename document
  text Everyone with access sees the new name.
  row.end
    button Cancel
    button.primary Rename
```

**Limits.** A block holds at most 64,000 characters, 200 lines (blank lines count)
and 8 levels of nesting. A root is level 1, so a line indented 16 spaces is level 9,
one too deep. A block over a limit gets an error and doesn't render.

## Kinds

`dialog`, `banner`, `page` and `frame` are roots: they stand at the top level and hold the
rest. A `card` may also stand at the top level, but holds only text lines.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral`, the default: a plain strip; `.info`: news, tinted blue; `.warning`: a state to notice, tinted amber; `.danger`: a problem, tinted red; `.success`: a positive outcome, tinted green | none: its text goes on a `text` line |
| `page` | at the top level | none | none: its title goes on a `text.title` line |
| `frame` | at the top level | none | the caption: the block's name, then its title |
| `card` | at the top level or directly inside a root | none | none: its text goes on `text` lines |
| `text` | directly inside a root or a `card` or a `row` | `.muted`: secondary text, in grey; `.strong`: bold; `.title`: a page's title, or a card's title directly inside a card; `.small`: the size of a chip's caption | the text |
| `row` | directly inside a root or a `table` | `.end`: aligns its children to the right; `.head`: a table's header row, in grey | none |
| `button` | directly inside a `row` or a `cell` or a `frame` | `.primary`: the filled main action; `.danger`: the destructive colour; `.link`: a text button with no box; `.focus`: shows a focus ring | the caption |
| `icon` | directly inside a root or a `cell` or a `button` | `.filled`: solid shapes; outline by default | its exact kebab-case Tabler name, such as `pin`, `dots-vertical` or `archive` |
| `input` | directly inside a root or a `row` | none | the placeholder |
| `select` | directly inside a root or a `row` | none | the chosen value |
| `toggle` | directly inside a root or a `row` | none | none: its choices are `option` lines |
| `option` | directly inside a `toggle` | `.current`: the chosen one | the caption |
| `table` | directly inside a root | none | none: it holds rows |
| `cell` | directly inside a table `row` | `.end`: right-aligned, for times and figures; `.sortable`: muted ↕; `.ascending`: ink ↑; `.descending`: ink ↓ | its text, or none for an empty cell |
| `chip` | directly inside a `row` or a `cell` | `.more`: the count of the rest, such as `+2` | the tag |

A `dialog` draws as a modal card on a faint scrim. A `banner` draws as a full-width
strip with its icon, text and buttons on one line. A `page` draws as a framed
screen whose children stack at full width. A `button` with no variant is a
secondary button. `button.primary.danger` is a filled destructive button, and
`button.link.danger` a destructive text button.

`banner.success` marks a positive outcome, such as Saved or Restored. Its fill is
a green tint, its icon uses the green tone and that tone is mixed into its border,
with light and dark defaults. A host sets `--wf-success` and `--wf-success-tint`
to restyle it. Its summary reads `success banner “…”`. There is no `.alert`;
use `.danger` for a problem. Use `icon archive` only when archiving or restoring
from the archive makes sense; other banners need no icon.

Icons use every name in the bundled Tabler Icons 3.49.0 catalog, without aliases
or lookup at runtime. `icon pin` draws outline and `icon.filled pin` draws filled.
Use the base name, not `pin-filled`. If a name lacks the requested style, it warns
and draws the available style instead. An unknown name warns and draws a dashed
box showing the name; `pin-filled` also suggests `icon.filled pin`.

An icon may stand directly inside a root, a cell or a button. It is muted on its
own, uses a banner's tone and inherits a button's colour. Outline icons match
the controls' stroke weight; filled icons draw solid shapes. Each icon's text
alternative is its name with hyphens read as spaces, so `dots-vertical` is read
as “dots vertical”. The root's accessible summary stays the same.

A button holding an icon and no caption is an icon-only mock action. With a
caption, the icon draws before it. `button.link` draws a bare icon; a plain button
draws a border. Both remain non-focusable spans. Icons in cells line up beside
text, chips and buttons. Icons in rows, cards or text warn and still draw.

```wireframe
page
  table
    row
      cell Pinned document
        icon pin
      cell
        button.link
          icon.filled pin
        button Archive
          icon archive
```

A `frame` draws the shared block frame: a neutral 3 px left bar and faint neutral
tint, the base radius on the right-hand corners and no other border. Its caption
row holds the label on the left, muted and medium weight, and direct `button`
children on the right in source order. The caption and its actions wrap when
needed. Without a label or direct buttons there is no caption row. Every other
child stacks below at full width; buttons inside a `row` stay in the body.
A frame's summary names its label, for example `Wireframe: frame “Figma · Payment, mobile”`;
without a label it is `Wireframe: frame`.

A `card` is a box on the paper ground with a 1 px border in the line colour, the
base radius and no shadow. Only `text` lines belong in a card; they stack inside
at full width. Any other child warns and still draws where it was written.
Neither `frame` nor `card` takes variants, and a card takes no label.
A card at the top level is still not a root for placement: a row, icon, control
or another card inside it warns. Adjacent cards stack at full width with a small
gap. Directly inside a card, `text.title` is bold at a dialog title's size,
larger than body text and smaller than a page's title. Elsewhere it keeps the
page title's size. `text.small` changes only the size and combines with other
variants, such as `text.small.muted`; write capitals in the source itself.

An `input` is an empty bordered field showing its placeholder in muted. A
`select` is a closed select with the same border, radius, height and padding as
an input, with no fill, its chosen value in ink and a muted stroked chevron-down
at the end. The select's chevron is separate from the icon catalog. Both fields
take the full width on their own. `label=` names either field above its control,
in ink; the line's label stays the placeholder or chosen value. In a `row`,
labelled fields share the width equally unless a control needs a wider column,
and their controls line up even when a label wraps. Long field labels wrap within
their column and never widen it.
An unlabelled select keeps its content's width and an unlabelled input fills the
room left. A long select value stays on one line; overflow scrolls inside the
wireframe, never the page.

```wireframe
page
  input label="Work email" you@company.com
  row
    input label="First name" First
    select label=Role Editor
```

A `toggle` draws its options on one line, separated by `·`. A `chip` is a small
neutral tag, and `chip.more` the count of the tags that don't show.

A `row` directly inside a `table` is a table row: it holds only `cell` lines, and
each `cell` holds its text, `chip` lines or `button` lines. A table draws with
rules under the header and between rows, and no other lines. Give every row the
same number of cells, an empty `cell` where a column has nothing. `.head` is for
a table row and `.end` for a row anywhere else.

Header cells may take one of `.sortable`, `.ascending` or `.descending`. The
stroked arrow follows the caption, which keeps the header row's muted colour.
These combine with `.end`: `cell.end.descending` stays right-aligned with its
arrow after the caption. The arrows belong to the cell and are not `icon` names.
Mark at most one sorted column per table; the other sortable columns use
`.sortable`. Two sorted columns do not warn. A sort variant outside a `row.head`
directly inside a `table` warns, as does more than one sort variant on a cell;
both still draw the first sort variant written.

Outside a table row, `text` may stand directly inside a `row`. It draws on the
row's line in source order and keeps its text variants. Text in a row does not
name its root in the accessible summary. Long text wraps between words beside
the other children. A pagination row goes below the table
as its sibling, using existing text and buttons:

```wireframe
page
  table
    row.head
      cell.ascending Name
      cell.end.sortable Documents
    row
      cell Ada Lovelace
      cell.end 12
  row.end
    text.muted 1–10 of 24
    button Previous
    button.primary 1
    button 2
    button 3
    button Next
```

Sort indicators and pagination draw a static state; sorting and paging behaviour
are outside the format.

## A page

The document list from Uberblick's web UI: a title and a count, a search field, a
filter row and a table.

```wireframe
page
  text.title All documents
  text.muted 24 documents
  input Search titles
  row
    toggle
      option.current Documents
      option Decisions
    select Any tag
  table
    row.head
      cell Title
      cell Group
      cell Tags
      cell.end Changed
      cell
    row
      cell Web UI system
      cell Getting started
      cell
        chip web
        chip spec
        chip.more +2
      cell.end 2 hours ago
      cell
        button.link
          icon pin
    row
      cell Card blocks
      cell
      cell
        chip markdown
      cell.end 3 days ago
      cell
        button.link
          icon pin
```

## Figma blocks

The reading and private states from Uberblick's "Figma blocks" page. `·` separates
the block name from its title in a single caption label.

```wireframe
frame Figma · Payment, mobile
  button.link Expand
  button.link Open in Figma
  card
    text.muted (the frame, live from Figma)
    text Click to interact
  text Card form after the address step. Error states are on the next frame.
```

```wireframe
frame Figma · Checkout flow
  button.link Open in Figma
  text Figma can't show this file publicly. If you have access, load it to sign in.
  row
    button Load
```

## Card block

The recommendation from Uberblick's "Card blocks" page. The small muted label
and footer are plain text; issue numbers keep the footer's muted colour.

```wireframe
card
  text.small.muted MORE AUTONOMY
  text.title Let the launcher install dependencies
  text Add the documented block to ub-agents.yaml: …
  text.small.muted UB-AGENTS.YAML · 2 RUNS STARTED WITHOUT THE CORPUS · #1072 #1304
```

A top-level card's summary names its first `text.title`, or its first text if it
has no title: `Wireframe: card “Let the launcher install dependencies”`.
Long titles and footers wrap inside the card, which fits the document column at
full size and never widens the page.

## Samples

The two samples from the corpus page "Samples", as written there. A delete
confirmation:

```wireframe
dialog Delete “Q3 launch draft”?
  text It will be gone for everyone, with its comments and history. Links to it will show it was deleted. This can't be undone.
  row.end
    button.focus Cancel
    button.danger Delete
```

The banner on an archived document:

```wireframe
banner.warning
  icon archive
  text Archived. Read-only and hidden from the document list.
  row.end
    button Restore
    button.link.danger Delete…
```

## Errors and warnings

Every problem gives a diagnostic with its line number and what was expected, such as
`line 3: warning: button must be directly inside row, cell or frame`.

- **Errors stop the render.** The block draws nothing, and the host keeps its last
  good render. Bad indentation, an unterminated quote, text after a closing quote
  and an exceeded limit are errors.
- **Warnings still draw.** An unknown kind, variant, attribute or icon, a malformed
  `#id`, a label on a kind that takes none, `label=` on the wrong kind, a repeated
  `label=` and a node in the wrong place are
  warnings. The node draws where it was written, and an unknown kind draws as a
  dashed box showing its name. Fix warnings too: they mean the block doesn't say
  what you meant.

## Common mistakes

Each mistake shows the wrong source, the parser's diagnostics for it and the fix.

### A tab in the indentation

Wrong (line 2 is indented with a tab):

```text
dialog Discard changes?
	text Your edits since the last save will be lost.
```

Diagnostics:

```text
line 2: error: indentation must be spaces, not tabs
```

Fixed:

```wireframe
dialog Discard changes?
  text Your edits since the last save will be lost.
```

### An odd number of spaces

Wrong:

```text
dialog Discard changes?
   text Your edits since the last save will be lost.
```

Diagnostics:

```text
line 2: error: indentation must be a multiple of two spaces, found 3
```

Fixed:

```wireframe
dialog Discard changes?
  text Your edits since the last save will be lost.
```

### A jump of more than one level

Wrong:

```text
dialog Discard changes?
  row.end
      button Cancel
```

Diagnostics:

```text
line 3: error: indented 6 spaces: expected at most 4, one level below line 2
```

Fixed:

```wireframe
dialog Discard changes?
  row.end
    button Cancel
```

### An indented first line

The first line inside the fence starts where the fence starts. Wrong:

```text
  dialog Discard changes?
    text Your edits since the last save will be lost.
```

Diagnostics:

```text
line 1: error: expected no indentation on the first line
line 2: error: indented 4 spaces: expected at most 2, one level below line 1
```

Fixed:

```wireframe
dialog Discard changes?
  text Your edits since the last save will be lost.
```

### An unterminated quote

Wrong:

```text
dialog Rename document
  row.end
    button "Save
```

Diagnostics:

```text
line 3: error: unterminated quote: expected a closing "
```

Fixed, without quotes, since the label doesn't start with `word=`:

```wireframe
dialog Rename document
  row.end
    button Save
```

### Text after a closing quote

A label that starts with `"` is quoted, so its closing quote must end the line.
Wrong:

```text
dialog Publish the page?
  text "Publish" makes it public.
```

Diagnostics:

```text
line 2: error: expected the line to end after the closing quote
```

Fixed with typographic quotes, which are plain text. Quoting the whole label,
`"\"Publish\" makes it public."`, works too.

```wireframe
dialog Publish the page?
  text “Publish” makes it public.
```

### A label that starts with `word=`

The parser reads `format=PDF` as an attribute, so the label is only the rest of the
line. Only `label=` on `input` and `select` is defined. Quote any line label that
starts with `word=`, including a placeholder that starts with `label=`. Wrong:

```text
dialog Export
  text format=PDF is the only choice.
```

Diagnostics:

```text
line 2: warning: unknown attribute "format": expected label on input or select (quote a label that starts with word=)
```

Fixed:

```wireframe
dialog Export
  text "format=PDF is the only choice."
```

### A button outside a row

A button may also stand in a `cell` or directly in a `frame`'s caption. Other
roots require a body `row` for their buttons.

Wrong:

```text
dialog Leave the workspace?
  text You lose access to its documents.
  button Cancel
  button.danger Leave
```

Diagnostics:

```text
line 3: warning: button must be directly inside row, cell or frame
line 4: warning: button must be directly inside row, cell or frame
```

Fixed:

```wireframe
dialog Leave the workspace?
  text You lose access to its documents.
  row.end
    button Cancel
    button.danger Leave
```

### A label on a banner or a row

Wrong:

```text
banner.warning Archived. Read-only and hidden from the document list.
  row.end Actions
    button Restore
```

Diagnostics:

```text
line 1: warning: banner takes no label
line 2: warning: row takes no label
```

Fixed:

```wireframe
banner.warning
  text Archived. Read-only and hidden from the document list.
  row.end
    button Restore
```

### Anything but a cell in a table row

A row directly inside a `table` holds only cells. Wrong:

```text
page
  table
    row
      cell Web UI system
      chip web
      button.link
        icon pin
```

Diagnostics:

```text
line 5: warning: chip in a table row: expected cell
line 6: warning: button in a table row: expected cell
```

Fixed, with each in a cell of its own:

```wireframe
page
  table
    row
      cell Web UI system
      cell
        chip web
      cell
        button.link
          icon pin
```

### A root inside another node

`dialog`, `banner`, `page` and `frame` stand only at the top level. Wrong:

```text
dialog Delete “Q3 launch draft”?
  banner.danger
    text This can't be undone.
  row.end
    button.danger Delete
```

Diagnostics:

```text
line 2: warning: banner must be at the top level
```

Fixed with a `text` line. A banner of its own would go at the top level, as a
second root.

```wireframe
dialog Delete “Q3 launch draft”?
  text.strong This can't be undone.
  row.end
    button.danger Delete
```

### An unknown kind, variant or icon

Use only the kinds, variants and icons in [Kinds](#kinds). Wrong:

```text
banner.warning
  icon pinn
  text.big Read-only. Ask the owner for access.
  row.end
    link Request access
```

Diagnostics:

```text
line 2: warning: unknown icon "pinn": expected a Tabler icon name
line 3: warning: unknown variant ".big" on text: expected .muted, .strong, .title or .small
line 5: warning: unknown kind "link": expected dialog, banner, page, frame, card, text, row, button, icon, input, select, toggle, option, table, cell or chip
```

Fixed with the catalog name `lock`:

```wireframe
banner.warning
  icon lock
  text.muted Read-only. Ask the owner for access.
  row.end
    button.link Request access
```

## Credit

The idea of a primer for agents comes from Wireloom's
[`AGENTS.md`](https://github.com/StardockCorp/Wireloom/blob/main/AGENTS.md) (MIT,
© 2026 Brad Wardell). This primer is written for wireframe-md's own format and
copies none of its text.
