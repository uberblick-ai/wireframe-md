# Changelog

Changes to `@uberblick/wireframe` a package user can notice. Throughout 0.x the
format, the vocabulary and the rendering may change in any minor version.

## Unreleased

- The development playground groups examples into families and entry pages,
  with compact independent editors, family overviews and a Scratch page.
  Human approvals share `examples/approvals.json` and track source, stylesheet
  and markup changes; entries and families show partial approval counts.
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
