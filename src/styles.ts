// The renderer's stylesheet, adapted from the uberblick-2 spike. Every rule sits
// under `.wf-root`, the class on the element renderWireframe returns, and nothing
// styles html, body or bare elements.
//
// Theming: a host sets the public `--wf-*` properties on any ancestor, often by
// pointing them at its own tokens. The root reads each one into a private
// `--_wf-*` property with a default, so its own declarations never shadow the
// host's. Colour defaults pair a light and a dark value in light-dark(), which
// follows the color-scheme the root inherits. The font family is inherited too.
//
// Public properties:
//   --wf-ink           text, and the secondary button's caption
//   --wf-muted         text.muted, a neutral banner's icon, an icon outside a banner, an unknown kind's name,
//                      an input's placeholder, a select's chevron-down, options but the current one, a table's
//                      header row, cell.sortable's arrows and chip.more
//   --wf-paper         cards, a page and the secondary button's fill
//   --wf-line          borders: cards, a page, buttons, inputs, selects, the banner's base and unknown boxes;
//                      a table's rules; mixed into a chip's fill
//   --wf-scrim         the faint backdrop behind a dialog's card
//   --wf-shadow        the dialog card's box-shadow
//   --wf-primary       button.primary's fill; --wf-primary-ink is its caption
//   --wf-danger        the destructive colour: button.danger and banner.danger's icon
//   --wf-danger-ink    the caption on a filled button.primary.danger
//   --wf-focus         button.focus's ring
//   --wf-info, --wf-warning, --wf-success       a banner's icon, also mixed into its border
//   The named icon/text hues reuse danger (red), warning (amber), success (green)
//   and info (blue). Light amber text mixes warning with ink for contrast.
//   --wf-neutral-tint  a neutral banner's and a frame's fill; --wf-muted is the frame's left bar and caption
//   --wf-info-tint,
//   --wf-warning-tint, --wf-danger-tint,
//   --wf-success-tint                          a banner's fill
//   --wf-stroke        border width; icon, select chevron and cell sort strokes are one and a half times it
//   --wf-focus-width   the focus ring's width
//   --wf-radius        cards, a frame's right corners, buttons, banners, inputs, selects, chips and unknown boxes
//   --wf-radius-lg     the dialog's card and scrim, and a page
//   --wf-text-size     the base type size; spacing, chips and text.small scale with it
//   --wf-title-size    the dialog's title and a card's direct text.title; other text.title is one and a half
//                      times it, unless combined with .small

const STYLES = `.wf-root {
  --_wf-ink: var(--wf-ink, light-dark(oklch(0.145 0 0), oklch(0.985 0 0)));
  --_wf-muted: var(--wf-muted, light-dark(oklch(0.511 0 0), oklch(0.708 0 0)));
  --_wf-paper: var(--wf-paper, light-dark(oklch(1 0 0), oklch(0.215 0 0)));
  --_wf-line: var(--wf-line, light-dark(oklch(0.86 0.004 75), oklch(1 0 0 / 20%)));
  --_wf-scrim: var(--wf-scrim, light-dark(oklch(0.145 0 0 / 9%), oklch(0 0 0 / 40%)));
  --_wf-shadow: var(--wf-shadow, 0 6px 20px light-dark(oklch(0 0 0 / 10%), oklch(0 0 0 / 45%)));
  --_wf-primary: var(--wf-primary, light-dark(oklch(0.205 0 0), oklch(0.922 0 0)));
  --_wf-primary-ink: var(--wf-primary-ink, light-dark(oklch(0.985 0 0), oklch(0.205 0 0)));
  --_wf-danger: var(--wf-danger, light-dark(oklch(0.577 0.245 27.325), oklch(0.704 0.191 22.216)));
  --_wf-danger-ink: var(--wf-danger-ink, light-dark(oklch(1 0 0), oklch(0.145 0 0)));
  --_wf-focus: var(--wf-focus, light-dark(oklch(0.72 0.16 65), oklch(0.8 0.18 65)));
  --_wf-info: var(--wf-info, light-dark(oklch(0.55 0.15 250), oklch(0.75 0.12 250)));
  --_wf-warning: var(--wf-warning, light-dark(oklch(0.66 0.13 70), oklch(0.78 0.14 75)));
  --_wf-success: var(--wf-success, light-dark(oklch(0.55 0.15 150), oklch(0.75 0.14 150)));
  --_wf-neutral-tint: var(--wf-neutral-tint, light-dark(oklch(0.985 0.002 75), oklch(0.2 0.004 65)));
  --_wf-info-tint: var(--wf-info-tint, light-dark(oklch(0.965 0.02 250), oklch(0.24 0.035 250)));
  --_wf-warning-tint: var(--wf-warning-tint, light-dark(oklch(0.975 0.022 85), oklch(0.24 0.035 75)));
  --_wf-danger-tint: var(--wf-danger-tint, light-dark(oklch(0.96 0.025 27.325), oklch(0.25 0.04 22.216)));
  --_wf-success-tint: var(--wf-success-tint, light-dark(oklch(0.965 0.025 150), oklch(0.24 0.035 150)));
  --_wf-stroke: var(--wf-stroke, 1px);
  --_wf-focus-width: var(--wf-focus-width, 2px);
  --_wf-radius: var(--wf-radius, 6px);
  --_wf-radius-lg: var(--wf-radius-lg, 10px);
  --_wf-text-size: var(--wf-text-size, 0.875rem);
  --_wf-title-size: var(--wf-title-size, 1rem);

  /* Roots stack one after another. Content wider than the host's box scrolls
     inside the root, never the page. A minmax(0, 1fr) column gives the root no
     min-content width of its own, so a host that sizes to content, such as a
     flex item or an auto grid column, doesn't grow to the widest row. The
     padding keeps room for a focus ring at the edge, which the scroller clips. */
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: start;
  gap: 0.75em;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: calc(2 * var(--_wf-focus-width));
  border: 0;
  overflow: auto hidden;
  overscroll-behavior-x: contain;

  /* Reset what a host passes down, as a code block or an editor does. */
  color: var(--_wf-ink);
  font-size: var(--_wf-text-size);
  font-style: normal;
  font-variant: normal;
  font-weight: 400;
  font-stretch: normal;
  font-feature-settings: normal;
  font-variation-settings: normal;
  line-height: 1.4;
  letter-spacing: normal;
  word-spacing: normal;
  text-align: start;
  text-indent: 0;
  text-transform: none;
  text-shadow: none;
  white-space: normal;
  text-wrap: wrap;
  line-break: auto;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: manual;
  cursor: default;
}

/* An empty block draws an empty root, which takes no space. */
.wf-root:empty {
  padding: 0;
}

/* In a column, block kinds take the full width, but never less than their
   content needs: a row of many buttons, a wide table or a long word widens its
   box, and the root scrolls. */
.wf-root > :is(.wf-dialog, .wf-banner, .wf-page, .wf-frame, .wf-card, .wf-text, .wf-row, .wf-input, .wf-select, .wf-table, .wf-unknown),
.wf-root :is(.wf-dialog-card, .wf-page, .wf-frame, .wf-card, .wf-unknown) > :is(.wf-dialog, .wf-banner, .wf-page, .wf-frame, .wf-card, .wf-text, .wf-row, .wf-input, .wf-select, .wf-table, .wf-unknown) {
  justify-self: stretch;
  align-self: stretch;
  min-width: min-content;
}

.wf-root .wf-dialog {
  display: flex;
  justify-content: center;
  box-sizing: border-box;
  margin: 0;
  padding: 1.75em 1.25em;
  border-radius: var(--_wf-radius-lg);
  background: var(--_wf-scrim);
}

.wf-root .wf-dialog-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75em;
  box-sizing: border-box;
  width: min(32em, 100%);
  min-width: min-content;
  margin: 0;
  padding: 1.25em 1.5em;
  border: var(--_wf-stroke) solid var(--_wf-line);
  border-radius: var(--_wf-radius-lg);
  background: var(--_wf-paper);
  box-shadow: var(--_wf-shadow);
}

.wf-root .wf-dialog-title {
  margin: 0;
  font-size: var(--_wf-title-size);
  font-weight: 600;
  line-height: 1.3;
}

.wf-root .wf-dialog-card > .wf-row {
  margin-top: 0.5em;
}

.wf-root .wf-banner {
  --_wf-tone: var(--_wf-muted);
  --_wf-tint: var(--_wf-neutral-tint);
  display: flex;
  align-items: center;
  gap: 0.625em;
  box-sizing: border-box;
  margin: 0;
  padding: 0.5em 0.75em;
  border: var(--_wf-stroke) solid color-mix(in oklab, var(--_wf-tone) 30%, var(--_wf-line));
  border-radius: var(--_wf-radius);
  background: var(--_wf-tint);
}

.wf-root .wf-banner.wf-success {
  --_wf-tone: var(--_wf-success);
  --_wf-tint: var(--_wf-success-tint);
}

.wf-root .wf-banner.wf-info {
  --_wf-tone: var(--_wf-info);
  --_wf-tint: var(--_wf-info-tint);
}

.wf-root .wf-banner.wf-warning {
  --_wf-tone: var(--_wf-warning);
  --_wf-tint: var(--_wf-warning-tint);
}

.wf-root .wf-banner.wf-danger {
  --_wf-tone: var(--_wf-danger);
  --_wf-tint: var(--_wf-danger-tint);
}

.wf-root .wf-banner > .wf-icon {
  color: var(--_wf-tone);
}

.wf-root .wf-banner > .wf-row.wf-end {
  margin-inline-start: auto;
}

/* A screen in a frame. Its title is a text.title line. */
.wf-root .wf-page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.875em;
  box-sizing: border-box;
  margin: 0;
  padding: 1.5em 1.75em 1.75em;
  border: var(--_wf-stroke) solid var(--_wf-line);
  border-radius: var(--_wf-radius-lg);
  background: var(--_wf-paper);
}

/* The neutral shared block frame. Only its left edge has a border. */
.wf-root .wf-frame {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75em;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0.75em 1em;
  border-left: calc(3 * var(--_wf-stroke)) solid var(--_wf-muted);
  border-top-right-radius: var(--_wf-radius);
  border-bottom-right-radius: var(--_wf-radius);
  background: var(--_wf-neutral-tint);
}

.wf-root .wf-frame-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em 1em;
  min-width: 0;
}

.wf-root .wf-frame-label {
  flex: 1 1 12em;
  min-width: 0;
  color: var(--_wf-muted);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.wf-root .wf-frame-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5em;
  min-width: 0;
  max-width: 100%;
  margin-inline-start: auto;
}

.wf-root .wf-frame-actions > .wf-button {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

/* A text-only box on paper, with the base radius and no shadow. */
.wf-root .wf-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75em;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 1em;
  border: var(--_wf-stroke) solid var(--_wf-line);
  border-radius: var(--_wf-radius);
  background: var(--_wf-paper);
}

.wf-root .wf-text {
  margin: 0;
}

.wf-root .wf-text.wf-muted {
  color: var(--_wf-muted);
}

.wf-root .wf-text.wf-strong {
  font-weight: 600;
}

/* A page's title, larger than a dialog's. */
.wf-root .wf-text.wf-title {
  font-size: calc(1.5 * var(--_wf-title-size));
  font-weight: 600;
  line-height: 1.25;
}

/* A direct card title has the dialog title's size; titles elsewhere keep the
   page size. :where keeps .small free to change only the size when combined. */
.wf-root :where(.wf-card) > .wf-text.wf-title {
  font-size: var(--_wf-title-size);
  line-height: 1.3;
}

.wf-root .wf-text.wf-small {
  font-size: calc(0.85 * var(--_wf-text-size));
}

.wf-root .wf-row {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5em;
  margin: 0;
}

.wf-root .wf-row.wf-end {
  justify-content: flex-end;
}

.wf-root .wf-row > .wf-text {
  flex: 0 1 auto;
}

/* Field labels wrap instead of setting column widths. Controls keep their
   minimum content width, widening the surrounding boxes when needed. In a row,
   columns stretch together and label tracks absorb any extra wrapped lines. */
.wf-root .wf-field {
  display: grid;
  grid-template-columns: minmax(min-content, 1fr);
  grid-template-rows: 1fr auto;
  gap: 0.5em;
  min-width: min-content;
  align-self: stretch;
  justify-self: stretch;
}

.wf-root .wf-row > .wf-field {
  flex: 1 1 0;
}

.wf-root .wf-field-label {
  min-width: 0;
  color: var(--_wf-ink);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.wf-root .wf-field > :is(.wf-input, .wf-select) {
  min-width: min-content;
}

/* Buttons are secondary unless a variant says otherwise. Variant rules share
   one specificity, so their order decides: .link beats a fill, .danger colours
   any of them, and .focus adds a ring to all. */
.wf-root .wf-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 0.375em;
  box-sizing: border-box;
  min-width: 2.5em;
  margin: 0;
  padding: 0.3125em 0.875em;
  border: var(--_wf-stroke) solid var(--_wf-line);
  border-radius: var(--_wf-radius);
  background: var(--_wf-paper);
  color: var(--_wf-ink);
  font-weight: 500;
  white-space: nowrap;
}

.wf-root .wf-button:where(.wf-primary) {
  border-color: var(--_wf-primary);
  background: var(--_wf-primary);
  color: var(--_wf-primary-ink);
}

.wf-root .wf-button:where(.wf-danger) {
  border-color: var(--_wf-danger);
  color: var(--_wf-danger);
}

.wf-root .wf-button:where(.wf-primary.wf-danger) {
  background: var(--_wf-danger);
  color: var(--_wf-danger-ink);
}

.wf-root .wf-button:where(.wf-link) {
  padding-inline: 0.375em;
  border-color: transparent;
  background: transparent;
  color: var(--_wf-ink);
}

/* Decorate only the caption, leaving icons and the flex gap untouched. */
.wf-root .wf-button.wf-link > .wf-button-caption {
  text-decoration-line: underline;
  text-decoration-color: currentColor;
  text-decoration-thickness: var(--_wf-stroke);
}

.wf-root .wf-button:where(.wf-link.wf-primary) {
  color: var(--_wf-primary);
}

.wf-root .wf-button:where(.wf-link.wf-danger) {
  color: var(--_wf-danger);
}

.wf-root .wf-button:where(.wf-focus) {
  outline: var(--_wf-focus-width) solid var(--_wf-focus);
  outline-offset: var(--_wf-focus-width);
}

/* Fields share their border, radius, padding and height, with no fill. They
   hold the line height of text even when empty. */
.wf-root .wf-input,
.wf-root .wf-select {
  box-sizing: border-box;
  min-height: calc(2.15em + 2 * var(--_wf-stroke));
  margin: 0;
  padding: 0.375em 0.625em;
  border: var(--_wf-stroke) solid var(--_wf-line);
  border-radius: var(--_wf-radius);
  background: transparent;
}

/* An input shows its placeholder and takes the room a row leaves. */
.wf-root .wf-input {
  color: var(--_wf-muted);
}

.wf-root .wf-row > .wf-input {
  flex: 1 1 12em;
}

/* A closed select: its value in ink and a chevron at the far end. It takes its
   content's width in a row; a long value stays on one line and widens the box. */
.wf-root .wf-select {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.5em;
  color: var(--_wf-ink);
  white-space: nowrap;
}

/* A borderless toggle keeps apart from the next control. */
.wf-root .wf-row > .wf-toggle:not(:last-child) {
  margin-inline-end: 0.75em;
}

.wf-root .wf-select-caret {
  display: block;
  flex: none;
  width: 1em;
  height: 1em;
  margin-inline-start: auto;
  color: var(--_wf-muted);
}

/* Options on one line, a middle dot between each two, wrapping only where the
   line doesn't fit. The current one stands out in ink. */
.wf-root .wf-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25em 0.5em;
  margin: 0;
}

.wf-root .wf-option {
  color: var(--_wf-muted);
  white-space: nowrap;
}

.wf-root .wf-option.wf-current {
  color: var(--_wf-ink);
  font-weight: 500;
}

.wf-root .wf-toggle > .wf-option + .wf-option::before {
  content: "\\b7";
  margin-inline-end: 0.5em;
  color: var(--_wf-muted);
  font-weight: 400;
}

/* Rows of cells with a rule under each row but the last: no vertical lines and
   no outer box. Columns take the width their content needs, and text in a cell
   wraps between words. */
.wf-root .wf-table {
  display: table;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
  empty-cells: show;
}

.wf-root .wf-table > .wf-row {
  display: table-row;
}

.wf-root .wf-table > .wf-row.wf-head {
  color: var(--_wf-muted);
}

.wf-root .wf-table > .wf-row > .wf-cell {
  display: table-cell;
  padding: 0.5em 0.75em;
  vertical-align: baseline;
}

.wf-root .wf-table > .wf-row > .wf-cell:first-child {
  padding-inline-start: 0;
}

.wf-root .wf-table > .wf-row > .wf-cell:last-child {
  padding-inline-end: 0;
}

.wf-root .wf-table > .wf-row:not(:first-child) > .wf-cell {
  border-top: var(--_wf-stroke) solid var(--_wf-line);
}

.wf-root .wf-cell {
  margin: 0;
}

.wf-root .wf-cell-sort {
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-inline-start: 0.375em;
  vertical-align: -0.125em;
  color: var(--_wf-ink);
}

.wf-root .wf-cell.wf-sortable > .wf-cell-sort {
  color: var(--_wf-muted);
}

/* Times and figures: they line up on the right and keep to one line. */
.wf-root .wf-cell.wf-end {
  text-align: end;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.wf-root .wf-cell > :is(.wf-chip, .wf-button, .wf-icon):not(:last-child) {
  margin-inline-end: 0.375em;
}

/* An icon's block SVG supplies the inline-flex button's baseline. Centre the
   button beside cell text instead of resting the SVG's bottom on that baseline. */
.wf-root .wf-cell > .wf-button.wf-has-icon {
  vertical-align: middle;
}

/* A small neutral tag. .more, the count of the rest, is text with no box. */
.wf-root .wf-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 0.0625em 0.5em;
  border-radius: var(--_wf-radius);
  background: color-mix(in oklab, var(--_wf-line) 50%, transparent);
  font-size: calc(0.85 * var(--_wf-text-size));
  white-space: nowrap;
}

.wf-root .wf-chip.wf-more {
  padding-inline: 0;
  background: transparent;
  color: var(--_wf-muted);
}

.wf-root .wf-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.375em;
  color: var(--_wf-muted);
  vertical-align: middle;
}

.wf-root .wf-button > .wf-icon {
  color: inherit;
}

/* Named hues override an icon's context. Uncoloured icons still inherit it. */
.wf-root :is(.wf-icon, .wf-text).wf-red {
  color: var(--_wf-danger);
}

.wf-root .wf-icon.wf-amber {
  color: var(--_wf-warning);
}

/* Keep the warning tone intact for icons and banners. Only light amber text
   needs a darker shade to reach 4.5:1 against the default paper ground. */
.wf-root .wf-text.wf-amber {
  color: light-dark(color-mix(in oklab, var(--_wf-warning) 80%, var(--_wf-ink)), var(--_wf-warning));
}

.wf-root :is(.wf-icon, .wf-text).wf-green {
  color: var(--_wf-success);
}

.wf-root :is(.wf-icon, .wf-text).wf-blue {
  color: var(--_wf-info);
}

.wf-root .wf-button.wf-icon-only {
  min-width: 0;
  padding-inline: 0.3125em;
}

.wf-root .wf-icon-glyph {
  display: block;
  width: 1.15em;
  height: 1.15em;
}

.wf-root .wf-select-caret,
.wf-root .wf-cell-sort {
  fill: none;
  stroke: currentColor;
  stroke-width: calc(1.5 * var(--_wf-stroke));
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Tabler's 24-unit grid uses the same stroke as the controls' 16-unit grid. */
.wf-root .wf-icon-glyph {
  fill: none;
  stroke: currentColor;
  stroke-width: calc(2.25 * var(--_wf-stroke));
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wf-root .wf-icon-glyph.wf-icon-filled {
  fill: currentColor;
  stroke: none;
}

.wf-root .wf-icon-glyph > .wf-path-fill {
  fill: currentColor;
}

.wf-root .wf-icon-glyph > .wf-path-no-stroke {
  stroke: none;
}

.wf-root .wf-icon-glyph > .wf-path-half-opacity {
  opacity: 0.5;
}

.wf-root .wf-icon-unknown,
.wf-root .wf-unknown {
  box-sizing: border-box;
  margin: 0;
  border: var(--_wf-stroke) dashed var(--_wf-line);
  border-radius: var(--_wf-radius);
}

.wf-root .wf-icon-unknown {
  min-width: 1.4em;
  min-height: 1.4em;
  padding: 0 0.25em;
  color: var(--_wf-muted);
}

.wf-root .wf-unknown {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5em;
  padding: 0.5em 0.75em;
}

.wf-root .wf-unknown-head {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  margin: 0;
}

.wf-root .wf-unknown-kind {
  color: var(--_wf-muted);
}
`;

/**
 * The renderer's whole stylesheet. Add it to the page once; it styles every
 * wireframe renderWireframe draws, and nothing outside them.
 */
export function getEmbedStyles(): string {
  return STYLES;
}
