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
  `label="Work email"`, `width` on `page`, `card` and `image`: `width=256`,
  and `padding` on `card`: `padding=8`.
  Values with spaces use quotes and the same escapes as a
  quoted label; a quoted attribute must be followed by a space or the line's end.
  Other attributes get a warning. A repeated `label=`, `width=` or `padding=`
  warns and uses the first value, even when invalid; an attribute on a kind
  that does not accept it warns and doesn't change its drawing.
- **Label** is the rest of the line, without trailing spaces. On `text` lines,
  paired single backticks mark inline monospace spans; every other kind keeps
  its backticks as written. Other Markdown isn't formatted, so `*draft*` shows
  its asterisks. Typographic quotes such as “ ” and ’ are plain text.

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

**Inline monospace.** On `text` lines only, single backticks pair from the left
and draw the text between them in monospace, without the markers. Several spans
may share a label, quoted or unquoted. An unmatched single backtick, an empty
pair or a run of two or more backticks stays literal, without a diagnostic.
This works inside roots, cards and non-table rows, with every text variant.
Use mono for text people copy, such as a revision id or a command.

```wireframe
page
  row
    text.small.muted Edited 3 minutes ago
    text.small.muted rev `e9faf4df`
  text "Run `npm test` then `npm run build`."
```

Each span changes only the font family: it keeps the line's size, weight and
colour, has no box, background or padding, and wraps between words like the
rest of the line. Its contents draw as text, never markup. The host sets
`--wf-mono-font` on an ancestor, for example to Geist Mono; the default is
`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Other text keeps the
host's UI font. When a text line names a root in the accessible summary, its
paired markers are omitted and the span is not announced: a `card` holding
`` text Run `npm test` `` is summarized as `Wireframe: card “Run npm test”`.

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

`dialog`, `banner`, `page`, `frame` and `phone` are roots: they stand at the top level and hold the
rest. A `card` may also stand at the top level, but holds text, images, rows and tabs.

| Kind | Where | Variants | Label |
| --- | --- | --- | --- |
| `dialog` | at the top level | none | the title |
| `banner` | at the top level | `.neutral`, the default: a plain strip; `.info`: news, tinted blue; `.warning`: a state to notice, tinted amber; `.danger`: a problem, tinted red; `.success`: a positive outcome, tinted green | none: its text goes on a `text` line |
| `page` | at the top level | `.browser`: browser toolbar; `.window`: macOS title bar; plain by default | the address on `.browser`, the window title on `.window`; none on a plain page; its content title goes on a `text.title` line |
| `frame` | at the top level | none | the caption: the block's name, then its title |
| `phone` | at the top level | none | none: its title goes on a `text.title` line |
| `dock` | directly inside a `phone` | none | none |
| `card` | at the top level or directly inside a root or a `dock` or a `row` | none | none: it holds text, images, rows and tabs; optional `width=` and `padding=` |
| `image` | directly inside a root or a `dock` or a `card` or a `row` | `.square`: 1:1; `.round`: a small circle | what the image shows; optional `width=` |
| `text` | directly inside a root or a `dock` or a `card` or a `row` | `.muted`: secondary text, in grey; `.strong`: bold; `.title`: a page's title, or a card's title directly inside a card; `.small`: the size of a chip's caption; `.red`, `.amber`, `.green`, `.blue`: named colours | the text |
| `row` | directly inside a root, a `dock`, a `card` or a non-table `row`; or inside a `table` as a table row | `.end`: aligns its children to the right; `.between`: spreads its children; `.scroll`: scrolls sideways; these three belong only in roots, docks and cards; `.head`: a table's header row, in grey | none |
| `divider` | directly inside a `dialog` or a `page` or a `frame` or a `phone` or a `dock` | none | none |
| `button` | directly inside a `row` or a `cell` or a `frame` | `.primary`: the filled main action; `.danger`: the destructive colour; `.link`: an underlined text button with no box; `.focus`: shows a focus ring | the caption, or none when it holds an icon |
| `icon` | directly inside a root or a `dock` or a `cell` or a `button` or an `option` | `.filled`: solid shapes; outline by default; `.red`, `.amber`, `.green`, `.blue`: named colours | its exact kebab-case Tabler name, such as `pin`, `dots-vertical` or `archive` |
| `input` | directly inside a root or a `dock` or a `row` | none | the placeholder |
| `select` | directly inside a root or a `dock` or a `row` | none | the chosen value |
| `toggle` | directly inside a root or a `dock` or a `row` | none | none: its choices are `option` lines |
| `tabs` | directly inside a root or a `card` | none | none: its tabs are `option` lines |
| `option` | directly inside a `toggle` or a `tabs` | `.current`: the chosen one | the caption; it may hold one icon |
| `table` | directly inside a root or a `dock` | none | none: it holds rows |
| `cell` | directly inside a table `row` | `.end`: right-aligned, for times and figures; `.sortable`: muted ↕; `.ascending`: ink ↑; `.descending`: ink ↓ | its text, or none for an empty cell |
| `chip` | directly inside a `row` or a `cell` | `.more`: the count of the rest, such as `+2` | the tag |

A `dialog` draws as a modal card on a faint scrim. A `banner` draws as a full-width
strip with its icon, text and buttons on one line; tabs take a full-width line.
A `page` draws as a framed
screen whose children stack at full width. A `button` with no variant is a
secondary button. `button.primary.danger` is a filled destructive button, and
`button.link.danger` an underlined destructive text button. A `.link` caption's
underline follows its colour and uses `--wf-stroke` for its thickness, including
on every wrapped line. Icons and the gap before the caption are not underlined;
an icon-only `.link` stays a bare icon.

`divider` draws a horizontal line directly inside a `dialog`, `page`, `frame`, `phone` or `dock`.
It takes no variants, label, attributes or children; an optional `#id` works as
on any kind. A `row` arranges content side by side; a divider holds no content.
Banners lay out on one line; neither banners nor cards take a divider.

The line uses `--wf-line`, like table rules, at `--wf-stroke` thickness. It spans
the container's full content width inside its padding, with no margin: the
container's usual gap supplies the space above and below. It never widens the
container or wireframe, and follows the wider width when other content widens
the container. The defaults are visible in light and dark; hosts restyle it
through those two properties. It is an inert separator for assistive technology
and adds nothing to its root's accessible summary.

```wireframe
page width=256
  text Dashboard
  text All documents
  divider
  text Workspace settings
  row
    text user card
```

In any other place, including the top level, a banner, card, row, table or cell,
it warns `divider must be directly inside dialog, page, frame, phone or dock` and still draws
a visible line where written. A label, variant, attribute or child gives the
usual warning and fallback drawing: a label draws as text, an unknown variant
or attribute adds no styling, and a child still draws where written.

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

An icon may stand directly inside a root, dock, cell, button or option. It is muted on its
own, uses a banner's tone and inherits a button's or option's colour. Outline icons match
the controls' stroke weight; filled icons draw solid shapes. Each icon's text
alternative is its name with hyphens read as spaces, so `dots-vertical` is read
as “dots vertical”. The root's accessible summary stays the same.

Only `icon` and `text` accept the named colours `.red`, `.amber`, `.green` and
`.blue`. They reuse the existing theme properties: red is `--wf-danger`, amber
is `--wf-warning`, green is `--wf-success`, and blue is `--wf-info`. Hosts restyle
the hues through those properties; no theme property is added. Icons use the
tones unchanged, overriding their banner, button or option colour. Coloured text keeps
its other variants, in any order, such as `text.small.amber` or
`text.green.strong`. With the default theme, each text colour reaches 4.5:1
contrast against paper in light and dark. Light amber text mixes 80% warning
with 20% ink for contrast; dark amber text uses warning unchanged.

Use one colour per node. Competing colours warn and the first written draws;
on `text`, `.muted` counts as a colour too. Other hues and colours on other kinds
get the usual unknown-variant warning and add no colour. A coloured icon's text
alternative names its colour before its name: `icon.filled.red point` is read
as “red point”. Text colour is not announced, and the summary stays the same.
Pair every coloured state with words so colour is not its only meaning:

```wireframe
page
  table
    row.head
      cell Document
      cell Sync
    row
      cell Q3 launch plan
      cell Synced
        icon.filled.green point
    row
      cell Research notes
      cell Offline
        icon.filled.red point
  text Offline. Changes are saved on this device.
```

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
base radius and no shadow. `text`, `image`, `row` and `tabs` lines belong in a card and stack inside at full width.
Other children warn and still draw where written. Cards may also stand inside a
non-table row. Their text wraps between words within their width.
Neither `frame` nor `card` takes variants, and a card takes no label.
A card at the top level is still not a root for placement: an icon, other control
or another card directly inside it warns. Adjacent cards stack at full width with a small
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

`tabs` draws a left-aligned line of `option` captions without separators, above
a hairline rule across the container's content width inside its padding. The
rule uses `--wf-line` at `--wf-stroke`. `option.current` draws in ink with a short
ink underline on the rule under that tab; other tabs are muted. An option may
hold one icon, drawn before its caption as in a toggle. Without a current option,
all tabs are muted and there is no warning. Tabs remain inert in light and dark,
using the existing theme properties; they do not switch content or name roots
in summaries.

```wireframe
page.window width=480 Settings
  tabs
    option.current General
    option Accounts
    option Sync
  input label=Name Uberblick
  select label=Appearance Match system
  row.end
    button Cancel
    button.primary Save
```

When tabs do not fit, the strip scrolls sideways inside itself, like `row.scroll`,
while the rule still spans the container. Nothing widens the card, wireframe or
document. An overflowing strip is one native Tab stop with a visible ring;
fitting strips add none and individual tabs cannot take focus. In a phone, tabs
scroll with the screen content. A `toggle` directly inside a `dock` keeps drawing
the phone's bottom tab bar.

Warnings retain the source and still draw:

| Source | Diagnostic | Drawing |
| --- | --- | --- |
| A later `option.current` in one `tabs` | `tabs takes one current option: the first is used` | later current options draw muted |
| `text` directly in `tabs` (other non-option children get their usual placement warning) | `text must be directly inside dialog, banner, page, frame, phone, dock, card or row` | child still draws |
| `tabs` outside a root or card, including in a dock or row | `tabs must be directly inside dialog, banner, page, frame, phone or card` | strip still draws |
| `option` outside a toggle or tabs | `option must be directly inside toggle or tabs` | option still draws |
| `tabs.pills` | `unknown variant ".pills": tabs takes no variants` | plain tabs |
| `tabs Sections` | `tabs takes no label` | label still draws as text |

A `row` directly inside a `table` is a table row: it holds only `cell` lines, and
each `cell` holds its text, `chip` lines or `button` lines. A table draws with
rules under the header and between rows, and no other lines. Give every row the
same number of cells, an empty `cell` where a column has nothing. `.head` is for
a table row; `.end`, `.between` and `.scroll` are for rows elsewhere. Use only
one of these three layout variants; more than one warns and the first is used.

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

## Page widths

A `page` may take one `width=` in CSS pixels: a whole number from 1 to 9999,
written in digits only, with no unit, sign or decimal point. It combines with
an `#id` and either chrome variant. A plain page takes no label.

```wireframe
page#sidebar width=256
  text Dashboard
  text All documents
```

The width includes the page's border and padding. The page sits at the
wireframe's start edge and is capped at its parent's available space; without
`width=`, it stays fluid. CSS pixels do not scale with `--wf-text-size`. Text
wraps inside the narrower page. Content that cannot fit, such as an unbreakable
row of buttons, still widens the page and scrolls inside the wireframe, never
the document. Nothing is scaled or clipped, and the accessible summary stays
the same.

These warnings still render:

| Source | Diagnostic | Drawing |
| --- | --- | --- |
| `dialog width=256` (any kind other than `page`, `card` or `image`, whatever the value) | `attribute "width" is only allowed on page, card or image` | unchanged |
| `page width=240px` (also `50%`, `0`, `12.5` or an empty value) | `invalid width "240px": expected a whole number of pixels from 1 to 9999, such as width=240` | fluid page |
| `page width=256 width=400` | `repeated attribute "width": the first value is used` | the first width; a first invalid value stays fluid |
| `page format=PDF` | `unknown attribute "format": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)` | unchanged |

## Card padding

`card padding=N` sets an equal inset between the border and content on all four
sides. Use a whole number from 0 to 64, written in digits only, without a unit,
sign or decimal point. The unit is CSS pixels and does not scale with
`--wf-text-size`. It combines with `#id` and `width=` wherever a card stands:

```wireframe
card#now-playing width=240 padding=8
  text Now playing · 32:44
```

Without `padding=`, a card keeps its 1em padding (14 px at the default text size),
including sized cards, scroll-row cards and cards sharing a row. Only the inset
changes: the border, radius, background and gap between children stay the same.
At `padding=0`, content starts directly inside the visible border. Summaries
stay unchanged.

`width=` still declares the outer width including border and padding: capped at
the available width outside `row.scroll`, exact inside one. On a sized card,
border plus padding on each side is capped at half the card's width, as for
default padding. `card width=8 padding=8` stays 8 px wide with no content width;
`card width=40 padding=64` stays 40 px wide. Padding never widens a phone,
wireframe or document. Content that cannot fit, such as several padded cards
sharing a narrow row, scrolls inside the phone screen or wireframe.

These warnings keep the block renderable and report the source line:

| Source | Diagnostic | Drawing |
| --- | --- | --- |
| `page padding=8` (any kind other than `card`, whatever the value) | `attribute "padding" is only allowed on card` | unchanged |
| `card padding=8px` (also `-1`, `8.5`, `65`, `1em` or an empty value) | `invalid padding "8px": expected a whole number of pixels from 0 to 64, such as padding=8` | default padding |
| `card padding=8 padding=4` | `repeated attribute "padding": the first value is used` | the first padding; an invalid first value keeps the default padding |
| `card format=PDF` | `unknown attribute "format": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)` | unchanged |

## Page wrappers

A `page` draws content in a plain bordered box, a browser (`page.browser`) or a
macOS app window (`page.window`). All three hold the same children, with the
same placement rules, optional `width=` and `text.title` for the content title.
`frame` keeps its block caption and actions; `phone` keeps its device screen.

`page.browser` draws one toolbar strip with back, forward and reload marks,
then a rounded address field showing the line's label. It has no tabs or window
controls. The address is plain text drawn as written: it is never a link,
loaded or checked. Without a label the field is empty.

```wireframe
page.browser acme.example/pricing
  row.between
    text.strong Acme
    toggle
      option Product
      option.current Pricing
      option Docs
  text.title Pricing that grows with your team
  text.muted Start free. Upgrade when you need more.
  row
    card
      text.title Free
      text $0 per month
      row
        button Start free
    card
      text.title Team
      text $12 per seat a month
      row
        button.primary Try Team
    card
      text.title Enterprise
      text Custom pricing
      row
        button Contact sales
  divider
  row.between
    text.small.muted © 2026 Acme
    text.small.muted Privacy · Terms
```

`page.window` draws one title-bar strip with three traffic-light circles at the
start and the line's label centred in the whole window. The circles reuse
`--wf-danger`, `--wf-warning` and `--wf-success`. Without a label there is no
title. All chrome uses the existing `--wf-*` properties in light and dark.
Chrome is decorative and inert: the marks and circles are hidden from
assistive technology, and nothing in the strip takes focus.

```wireframe
page.window width=480 Settings
  toggle
    option.current General
      icon settings
    option Accounts
      icon user
    option Sync
      icon refresh
  input label=Name Uberblick
  select label=Appearance Match system
  divider
  row.end
    button Cancel
    button.primary Save
```

A plain page keeps its general wrapper behavior, with no chrome:

```wireframe
page width=360
  text.title Sign in
  input label=Email you@company.com
  input label=Password Password
  row.end
    button.primary Continue
```

Below the strip, content draws exactly as in a plain page. Page height follows
content, with no fixed viewport or internal scrolling. The page fills the
available width or uses `width=N` under [Page widths](#page-widths). Content
that cannot fit can still widen it and scroll inside the wireframe, never the
document. The strip spans that wider page too. A long chrome label stays on one
line, cut with an ellipsis, and never widens the page. In a narrow parent the
address field and title shrink while the marks and circles keep their size.

The accessible summary names the variant, then its label, or its first direct
text when there is no label: `Wireframe: browser “acme.example/pricing”` and
`Wireframe: window “Settings”`. A plain page keeps `Wireframe: page “Sign in”`.
With neither a label nor direct text, the summary is `Wireframe: browser`,
`Wireframe: window` or `Wireframe: page`.

These warnings still draw:

| Source | Diagnostic | Drawing |
| --- | --- | --- |
| `page.browser.window` | `page takes one of .browser or .window: the first is used` | browser chrome; reversing the variants draws window chrome |
| `page.x` | `unknown variant ".x" on page: expected .browser or .window` | plain page |
| `page Sign in` | `page takes no label` | plain page with the unsupported label drawn as text; use `text.title` |

## Phones

A `phone` is a root at the top level. It holds the same text, rows, dividers,
cards, images, controls, tables and icons as a page, stacked at the screen's full width.
It takes no label, variants or attributes; `#id` is optional. Put its title on
a `text.title` line. Buttons belong in rows or cells, as on a page.

```wireframe
phone
  text.title General
  input label=Name Uberblick
  row.end
    button Save
  divider
  text.muted Hub
  text hub.uberblick.ai
```

The frame looks like a modern iPhone in greyscale: an even 8 px bezel with deep,
concentric corners, a dark island pill beside `9:41`, reception, Wi-Fi and
battery icons, and a bottom home indicator. The decoration is the same on every
phone, hidden from assistive technology and absent from the summary. In narrow
phones, status items are cut off beside the island rather than overlapping it.
The screen is 393 × 852 CSS px on `--wf-paper`, at the wireframe's start
edge. Its size does not scale with `--wf-text-size` and content is never scaled.
It reserves a fixed 54 px status band at the top and a 34 px home indicator band
at the bottom. Short content leaves the screen at full height; tall and wide
content scrolls inside the area between the bands, never behind decoration and
never widening the phone. In a narrower parent the whole phone fits the
available width, and the screen narrows while staying 852 px tall.

Scrolling is native: wheel and touch scrolling continue to the document at
either end. An overflowing screen is one Tab stop, with a visible focus ring,
so arrow and Page keys scroll it. A fitting screen adds no Tab stop and no mock
control takes focus. A screen with an overflowing scroll row or tab strip is
reached through that strip: browsers focus a scroll container only when no
descendant takes focus. Up, Down and Page keys there still scroll the screen. The summary uses
the first direct text, like a page:
`Wireframe: phone “General”`, or `Wireframe: phone` without text.

A phone below the top level warns `phone must be at the top level` and still
draws as a phone. A label warns `phone takes no label` and still draws inside
the screen. A variant warns `unknown variant ".x": phone takes no variants`.
Attributes get the existing warnings. Other roots inside a phone also keep
their top-level warnings and still draw; write them as separate roots instead.
A final `dock` pins content to the bottom of the screen; see below. Image labels
and dock contents never name the phone, so a home screen whose title is inside
a row summarizes as `Wireframe: phone`. Screen-size options, other device frames,
configurable or author-written status bars, notches, fixed top headers and other
floating elements are outside the vocabulary.

## Images, card rows and docks

`image` draws a neutral tinted placeholder with a muted decorative photo mark.
Its label is its text alternative, or “image” without a label. A small, muted
caption appears inside larger boxes on one line, clipped with an ellipsis.
Boxes narrower than 80 px, round avatars and images directly in rows show only
the mark. The label never determines the box's width or height.

Inside a root, dock or card, an image fills the available width at 16:9;
`.square` makes it 1:1. Inside a non-table row it is 48 px wide beside text.
In a banner, a fluid image shares the line's available width with text and
actions; a declared width caps at the available content width. Content that
cannot fit beside the capped image widens the banner, which encloses the line.
`.round` is a 40 px circle by default, including at the start of a root or card.
A valid `width=` overrides the default, and the ratio determines the height.
Use only one shape variant: `.square.round` warns and uses the first.

`width=` on a card or image uses the page's rule: digits from 1 to 9999 CSS px,
independent of `--wf-text-size`. An invalid first width leaves the default size;
repeated widths warn and use the first. Outside a scroll row the width is capped
at the available space. Inside a scroll row it is exact. A card without a width
is 144 px in a scroll row; in another row unsized cards share the room equally.

`row.between` puts the first child at the start and the last at the end.
A plain `row` directly inside a non-table `row` is an invisible group: it counts
as one child of the outer row, takes its content's width, and holds anything a
non-table row holds. Its children sit side by side, vertically centred, with the
usual row gap. The group has no border, fill, padding or margin. In a narrow
card, text wraps between words inside the group while a trailing action stays
at the end; the header does not widen the card or wireframe. Text keeps its
variants and does not name the root in its accessible summary.

Use a group to keep an icon, author and timestamp together beside an action:

```wireframe
card width=400
  row.between
    row
      button.link
        icon user-circle
      text.strong Ana Lopez
      text.small.muted 2 h ago
    button.link ✓ Resolve
  text Ten feels low. Could we do twenty?
```

This also fits at `card width=240`. `.end`, `.between` or `.scroll` on the inner
row warns that it must be directly inside `dialog`, `banner`, `page`, `frame`,
`phone`, `dock` or `card`, and draws a plain group. `.head` still warns that it
must be directly inside a table. A row in a cell or any other unsupported place
still warns; a table row continues to hold only cells.

`row.scroll` keeps children on one line at their own width without shrinking.
Only the row scrolls sideways; it never widens its root, screen or wireframe.
Overflowing children are cut at the row's edge. Directly inside a phone it runs
to the screen's side edges, keeping the first child aligned with content above.
Scrolling is native and chains to the screen and document at either end. An
overflowing row is one Tab stop with a visible ring; a fitting row adds none.

```wireframe
phone
  row.between
    text.title Home
    image.round Profile photo
  row.scroll
    card width=144
      image.square Cover
      text First collection
    card width=144
      image.square Cover
      text Second collection
    card width=144
      image.square Cover
      text Third collection
  card
    image Promo artwork
  dock
    card padding=8
      row
        image.square Cover
        text Latest item
        button.link
          icon.filled player-play
    toggle
      option.current Home
        icon home
      option Library
        icon books
      option Search
        icon search
```

`dock` stands directly inside a phone as its last child, with no label or variants.
It holds the phone vocabulary with the same placement rules. It is opaque and
stays across the full screen width at the bottom while content scrolls behind it
in either direction. Its height is reserved in the scroll range, so the last
content line clears it at the end. It sits above the decorative home indicator.
Docks elsewhere warn `dock must be directly inside phone`. A dock
followed by another child warns `dock must be its phone's last child` and draws
at its source position; this includes the first of two docks.

An `option` may hold one `icon`, before its caption, inheriting the option's
colour unless it has a hue. A second icon warns `option takes only one icon`
and still draws. A `toggle` directly inside a dock is a tab bar: equal-width
options, icon above caption, no middle-dot separators, current option in ink
and other options muted. Controls stay inert and summaries stay unchanged.

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
  `#id`, a label on a kind that takes none, `label=`, `width=` or `padding=` on
  the wrong kind, a repeated attribute, an invalid width or padding and a node in the wrong place are
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
line. Attributes are `label=` on `input` and `select`, `width=` on `page`, `card`
and `image`, and `padding=` on `card`. Quote any line label that starts with
`word=`, including a placeholder that starts with `label=`. Wrong:

```text
dialog Export
  text format=PDF is the only choice.
```

Diagnostics:

```text
line 2: warning: unknown attribute "format": expected label on input or select, width on page, card or image, or padding on card (quote a label that starts with word=)
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

`dialog`, `banner`, `page`, `frame` and `phone` stand only at the top level. Wrong:

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
line 3: warning: unknown variant ".big" on text: expected .muted, .strong, .title, .small, .red, .amber, .green or .blue
line 5: warning: unknown kind "link": expected dialog, banner, page, frame, phone, dock, card, image, text, row, divider, button, icon, input, select, toggle, tabs, option, table, cell or chip
```

Fixed without an icon, since this banner is not about archiving:

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
