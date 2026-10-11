# Playground

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

## Approval

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
