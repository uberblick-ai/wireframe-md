# Changelog

Changes to `@uberblick/wireframe` a package user can notice. Throughout 0.x the
format, the vocabulary and the rendering may change in any minor version.

## Unreleased

- `tabs` draws an inert tab strip directly inside roots and cards, with an ink
  underline on the first `option.current`. Options may hold an icon. Overflow
  scrolls inside the strip with a native keyboard stop and a visible focus ring.
  Banner strips take their own line while surrounding content keeps its normal
  spacing, word wrapping and long-word scrolling beside icons and actions.

- Plain rows can group content inside a non-table row. An author, icon and
  timestamp stay together beside a trailing action in `row.between`, with text
  wrapping inside the group at narrow widths. Layout variants on the inner row
  warn and draw a plain group.

- Pages support decorative browser chrome with an address (`page.browser`) and
  macOS window chrome with a centred title (`page.window`). Both keep the page's
  content, width and fit rules, use the existing theme properties and remain
  inert. Long chrome labels ellipsize; accessible summaries name the variant.

- Cards accept `padding=0` through `padding=64` for an equal inset in CSS pixels
  on all four sides. Sized cards cap border plus padding at half their width;
  cards without the attribute keep their 1em inset. Invalid, misplaced and
  repeated padding warns. The home-feed Now playing card uses `padding=8`.

## 0.3.0

Wireframes gain a broader visual vocabulary: Tabler icons, named colours, inline
monospace, table sort indicators, dividers and explicit page widths. Phone
layouts add a decorated scrollable screen, image placeholders, sideways card
rows and a bottom dock. The authoring guide covers the new vocabulary; mock
controls remain inert.

- Phone home screens support `image` placeholders (`.square`, `.round`),
  `row.between`, native sideways `row.scroll`, cards in rows, and a final opaque
  bottom `dock`. Cards hold images and rows and share `width=` with pages and
  images. Options accept one icon; a dock's direct toggle draws a tab bar with
  equal-width options. Layout variants and shapes use the first when competing.
  A valid image width overrides its default size, including round avatars in
  rows. Image labels and dock contents leave summaries unchanged. The home-feed
  example shows the additions in light and dark, using existing theme properties:
  four 96 px cards in the first `row.scroll` and three 144 px cards in the second,
  both overflowing the screen, with shorter collection captions.

- `phone` draws a greyscale iPhone-like frame with an even thin bezel, deep
  concentric corners and a 393 × 852 CSS px screen. A fixed 54 px top band holds
  a dark island pill, time, reception, Wi-Fi and battery; a 34 px bottom band
  holds a home indicator. Content scrolls only between the bands and fits
  narrower parents without growing or scaling; narrow status items are clipped
  beside the island. Decoration is hidden from assistive technology.
  It holds the same content as a page, with no label, variants or attributes.
  Native scrolling chains to the document; an overflowing screen takes one
  keyboard stop with one visible themed focus ring around the paper screen.
  Summaries and placement warnings include phones, and the examples show short
  and tall screens in both themes.

- The README is a short entry point. Hosts now find the `--wf-*` theming
  reference in [THEMING.md](https://github.com/uberblick-ai/wireframe-md/blob/main/THEMING.md)
  in the repository; it no longer lives in the shipped README, and `THEMING.md`
  does not ship in the package.

- A static showcase build in `site/` pairs curated example sources with light
  and dark renders, including full-page designs. Deployment requires matching
  human playground approvals; a separate preview build marks examples awaiting
  review. The site stays outside the npm package.

- `divider` draws an inert horizontal separator directly inside a dialog, page
  or frame. It spans the content width using `--wf-line` and `--wf-stroke`, with
  the container's usual gaps. It takes only an optional `#id`; misplaced or
  unsupported source warns and still draws.

- `page width=256` gives a page an optional width in CSS pixels, including its
  border and padding and capped at its parent's space. Text wraps and content
  that cannot fit still scrolls inside the wireframe. Widths are digits from 1
  to 9999; invalid, misplaced and repeated widths warn. Pages without a width
  stay fluid. The Uberblick sidebar joins the page examples.

- Paired single backticks in `text` labels draw inline monospace spans, including
  small metadata in rows. Spans keep the line's size, weight, colour and wrapping
  and use the new `--wf-mono-font` host property with a system monospace default.
  Summaries omit paired markers. Unmatched or empty pairs and all non-text
  labels keep their backticks as written, without new diagnostics.
- Icons and text accept `.red`, `.amber`, `.green` and `.blue`, reusing the
  existing danger, warning, success and info theme properties. Icons override
  their context's colour and name the hue in their text alternative. Text keeps
  its other variants; light amber text derives a darker shade for contrast.
  Competing colours warn and draw the first, including `.muted` on text.
- `button.link` captions are underlined in their variant colour at `--wf-stroke`
  thickness, including wrapped lines. Icons, icon-only links and other buttons
  draw as before; every mock action stays inert.
- Icons accept the full Tabler Icons 3.49.0 catalog in outline or `.filled`,
  directly inside roots, cells and buttons. Buttons may draw an icon alone or
  before their caption, staying inert. Icons have name-based text alternatives,
  inherit their context's colour and warn with a fallback for missing styles.
  Icon-only and captioned icon buttons align with text and chips in table cells.
  The package bundles generated drawings and Tabler's MIT notice, with no runtime
  dependency or network lookup. `icon archive` now uses Tabler's drawing.
- Table cells accept `.sortable`, `.ascending` and `.descending` to draw stroked
  sort indicators, including with `.end`. Misplaced or competing sort variants
  warn and still draw the first. Text may stand in a non-table row, allowing
  static pagination with existing buttons. Long row text wraps between words
  beside the other children.

## 0.2.0

The vocabulary grows from a dialog and a banner to whole pages: tables, form
fields with labels, toggles, chips, frames, cards and a success banner. Nothing
that 0.1.0 accepted changes meaning; only some warning texts are reworded.

- `banner.success` marks a positive outcome with a green tint, icon tone and
  border in light and dark, themed through `--wf-success` and `--wf-success-tint`.
  Its accessible summary names it as a success banner. The Banners playground
  entry now shows every tone, actions, wrapping text and banners above a page.
- `card` may stand at the top level, still holding only text. `text.small` uses
  the size of a chip's caption, and a card's direct `text.title` uses the dialog
  title size, controlled by `--wf-title-size`. A top-level card's summary names
  its title before its other text.
  These draw the Card block's label, title, body and footer in light and dark.
- `frame` draws a neutral block frame with a caption label and direct buttons
  on the right; body children stack below it. `card` draws a bordered paper box
  holding only text. Both support light and dark; caption actions wrap without
  widening the page. These draw the Figma block's reading and private states.
- `input` and `select` accept `label=Role` or `label="Work email"` to name a field
  above its placeholder or chosen value. Labelled fields share a row equally,
  with aligned controls and wrapping labels. Long control values can widen their
  columns and surrounding boxes, scrolling inside the wireframe. A repeated
  label or one on another kind warns; other attributes still warn.
- `select` draws as a bordered closed form control with the input's geometry,
  its chosen value in ink and a muted stroked chevron-down. It stretches on its
  own, keeps its content's width in a row, and scrolls long values inside the
  wireframe.
- `AUTHORING.md`, a primer for agents writing ```` ```wireframe ```` blocks,
  ships in the package as `@uberblick/wireframe/AUTHORING.md`: the grammar,
  every kind, both samples and the common mistakes, each with the diagnostic it
  gets and its fix.
- The vocabulary draws a page with a table, enough for the "Web UI: document
  list" page: `page`, a third root, framed, whose title is a `text.title` line;
  `input`, `select`, and `toggle` with its `option` lines (`.current`); `table`,
  whose rows (`row.head` for the header) hold `cell` lines (`.end`); and `chip`
  (`.more`). A `button` may also stand in a `cell`. A table row holds only
  cells, and anything else in one, a `cell` anywhere else, `row.head` outside a
  table and `row.end` inside one get a warning.
- A misplaced button's warning now reads `button must be directly inside row or
  cell`, and the lists in other placement and unknown-kind warnings name the new
  kinds.

## 0.1.0

The first release: Format v0.1, enough to sketch a confirmation dialog and a page
banner in a ```` ```wireframe ```` block of an Uberblick document.

- `parseWireframe(source)` parses a block's body into a tree of nodes and
  line-numbered warnings and errors. A block over the limits (64,000
  characters, 200 lines, 8 levels of nesting) gets an error and never renders.
- `renderWireframe(result)` draws a result as static, inert DOM under one
  `.wf-root` element. It returns `null` for a result with an error, so the host
  can keep its last good render.
- `summarizeWireframe(result)` gives one line of plain text for the host's
  accessible label.
- `getEmbedStyles()` returns the scoped stylesheet, which also ships as
  `@uberblick/wireframe/styles.css`. Its colours, strokes, radii and type sizes
  come from `--wf-*` custom properties, with light and dark defaults that follow
  the inherited `color-scheme`.
- The vocabulary: `dialog` and `banner` (`.neutral`, `.info`, `.warning`,
  `.danger`) at the top level, holding `text` (`.muted`, `.strong`), `row`
  (`.end`) with `button` (`.primary`, `.danger`, `.link`, `.focus`), and `icon`
  (`archive`).
- An ES module with type declarations and no runtime dependencies, published
  from CI with npm provenance.
