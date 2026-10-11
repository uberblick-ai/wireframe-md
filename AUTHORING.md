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
- **key=value** is an attribute. v0.1 has no attributes, so every `key=value` gets a
  warning. Don't write any.
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

`dialog` and `banner` are roots: they stand at the top level and hold the rest.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral`, the default: a plain strip; `.info`: news, tinted blue; `.warning`: a state to notice, tinted amber; `.danger`: a problem, tinted red | none: its text goes on a `text` line |
| `text` | directly inside a root | `.muted`: secondary text, in grey; `.strong`: bold | the text |
| `row` | directly inside a root | `.end`: aligns its buttons to the right | none |
| `button` | directly inside a `row` | `.primary`: the filled main action; `.danger`: the destructive colour; `.link`: a text button with no box; `.focus`: shows a focus ring | the caption |
| `icon` | directly inside a root | none | its name: `archive`, the only icon in v0.1 |

A `dialog` draws as a modal card on a faint scrim. A `banner` draws as a full-width
strip with its icon, text and buttons on one line. A `button` with no variant is a
secondary button. `button.primary.danger` is a filled destructive button, and
`button.link.danger` a destructive text button.

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
`line 3: warning: button must be inside row`.

- **Errors stop the render.** The block draws nothing, and the host keeps its last
  good render. Bad indentation, an unterminated quote, text after a closing quote
  and an exceeded limit are errors.
- **Warnings still draw.** An unknown kind, variant, attribute or icon, a malformed
  `#id`, a label on a kind that takes none and a node in the wrong place are
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
line. Wrong:

```text
dialog Export
  text format=PDF is the only choice.
```

Diagnostics:

```text
line 2: warning: unknown attribute "format": v0.1 has none (quote a label that starts with word=)
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
line 3: warning: button must be inside row
line 4: warning: button must be inside row
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

### A root inside another node

`dialog` and `banner` stand only at the top level. Wrong:

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
line 3: warning: unknown variant ".small" on text: expected .muted or .strong
line 5: warning: unknown kind "link": expected dialog, banner, text, row, button or icon
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
