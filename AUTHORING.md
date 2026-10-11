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

`dialog`, `banner` and `page` are roots: they stand at the top level and hold the
rest.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral`, the default: a plain strip; `.info`: news, tinted blue; `.warning`: a state to notice, tinted amber; `.danger`: a problem, tinted red | none: its text goes on a `text` line |
| `page` | at the top level | none | none: its title goes on a `text.title` line |
| `text` | directly inside a root | `.muted`: secondary text, in grey; `.strong`: bold; `.title`: a page's title | the text |
| `row` | directly inside a root or a `table` | `.end`: aligns its buttons to the right; `.head`: a table's header row, in grey | none |
| `button` | directly inside a `row` or a `cell` | `.primary`: the filled main action; `.danger`: the destructive colour; `.link`: a text button with no box; `.focus`: shows a focus ring | the caption |
| `icon` | directly inside a root | none | its name: `archive`, the only icon in v0.1 |
| `input` | directly inside a root or a `row` | none | the placeholder |
| `select` | directly inside a root or a `row` | none | the chosen value |
| `toggle` | directly inside a root or a `row` | none | none: its choices are `option` lines |
| `option` | directly inside a `toggle` | `.current`: the chosen one | the caption |
| `table` | directly inside a root | none | none: it holds rows |
| `cell` | directly inside a table `row` | `.end`: right-aligned, for times and figures | its text, or none for an empty cell |
| `chip` | directly inside a `row` or a `cell` | `.more`: the count of the rest, such as `+2` | the tag |

A `dialog` draws as a modal card on a faint scrim. A `banner` draws as a full-width
strip with its icon, text and buttons on one line. A `page` draws as a framed
screen whose children stack at full width. A `button` with no variant is a
secondary button. `button.primary.danger` is a filled destructive button, and
`button.link.danger` a destructive text button.

An `input` is an empty bordered field showing its placeholder in muted. A
`select` is a closed select with the same border, radius, height and padding as
an input, with no fill, its chosen value in ink and a muted stroked chevron-down
at the end. The chevron belongs to select and is not an `icon` name. Both fields
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
        button.link pin
    row
      cell Card blocks
      cell
      cell
        chip markdown
      cell.end 3 days ago
      cell
        button.link pin
```

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
`line 3: warning: button must be directly inside row or cell`.

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

Wrong:

```text
dialog Leave the workspace?
  text You lose access to its documents.
  button Cancel
  button.danger Leave
```

Diagnostics:

```text
line 3: warning: button must be directly inside row or cell
line 4: warning: button must be directly inside row or cell
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
      button.link pin
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
        button.link pin
```

### A root inside another node

`dialog`, `banner` and `page` stand only at the top level. Wrong:

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
  icon lock
  text.small Read-only. Ask the owner for access.
  row.end
    link Request access
```

Diagnostics:

```text
line 2: warning: unknown icon "lock": expected archive
line 3: warning: unknown variant ".small" on text: expected .muted, .strong or .title
line 5: warning: unknown kind "link": expected dialog, banner, page, text, row, button, icon, input, select, toggle, option, table, cell or chip
```

Fixed, leaving out the icon, since v0.1 has only `archive`:

```wireframe
banner.warning
  text.muted Read-only. Ask the owner for access.
  row.end
    button.link Request access
```

## Credit

The idea of a primer for agents comes from Wireloom's
[`AGENTS.md`](https://github.com/StardockCorp/Wireloom/blob/main/AGENTS.md) (MIT,
© 2026 Brad Wardell). This primer is written for wireframe-md's own format and
copies none of its text.
