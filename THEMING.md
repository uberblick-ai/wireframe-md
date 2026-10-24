# Theming @uberblick/wireframe

A wireframe takes the UI font family from its host and resets the other text
styles a host passes down. Paired single backticks on `text` labels draw inline
monospace spans using `--wf-mono-font`, keeping the line's size, weight and
colour. Its colours, strokes, radii, type sizes and mono face come from
`--wf-*` custom properties, which a host sets on any ancestor. Every colour has
a light and a dark default, picked by the `color-scheme` the wireframe
inherits.

| Property | Controls | Light default | Dark default |
| --- | --- | --- | --- |
| `--wf-ink` | text, switch captions, the secondary button's caption, ascending and descending sort arrows | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--wf-muted` | `text.muted`, a frame's bar and caption label, a neutral banner's icon, an icon outside a banner or button, an unknown kind's name, an input's placeholder, a select's chevron-down, options but the current one, a table's header row, sortable arrows, `chip.more` | `oklch(0.511 0 0)` | `oklch(0.708 0 0)` |
| `--wf-paper` | cards, a page, a phone screen including its fixed bands, the secondary button's fill and an off switch's thumb | `oklch(1 0 0)` | `oklch(0.215 0 0)` |
| `--wf-line` | borders: cards, a page, buttons, inputs, selects, a banner's base border, unknown boxes; a table's rules; mixed into a chip's fill; an off switch's track | `oklch(0.86 0.004 75)` | `oklch(1 0 0 / 20%)` |
| `--wf-scrim` | the faint backdrop behind a dialog's card | `oklch(0.145 0 0 / 9%)` | `oklch(0 0 0 / 40%)` |
| `--wf-shadow` | the dialog card's `box-shadow` | `0 6px 20px oklch(0 0 0 / 10%)` | `0 6px 20px oklch(0 0 0 / 45%)` |
| `--wf-primary` | `button.primary`'s fill, `button.link.primary`'s caption and an on switch's track | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--wf-primary-ink` | `button.primary`'s caption and an on switch's thumb | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--wf-danger` | the destructive colour: `button.danger`, and `banner.danger`'s icon and border; red icons and text | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--wf-danger-ink` | the caption on a filled `button.primary.danger`; a phone's island in dark | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--wf-focus` | `button.focus`'s ring | `oklch(0.72 0.16 65)` | `oklch(0.8 0.18 65)` |
| `--wf-info` | `banner.info`'s icon and border; blue icons and text | `oklch(0.55 0.15 250)` | `oklch(0.75 0.12 250)` |
| `--wf-warning` | `banner.warning`'s icon and border; amber icons and text (light text mixes 80% warning with 20% ink) | `oklch(0.66 0.13 70)` | `oklch(0.78 0.14 75)` |
| `--wf-success` | `banner.success`'s icon and border; green icons and text | `oklch(0.55 0.15 150)` | `oklch(0.75 0.14 150)` |
| `--wf-neutral-tint` | a neutral banner's and a frame's fill | `oklch(0.985 0.002 75)` | `oklch(0.2 0.004 65)` |
| `--wf-info-tint` | `banner.info`'s and `text.bg-blue`'s fill | `oklch(0.965 0.02 250)` | `oklch(0.24 0.035 250)` |
| `--wf-warning-tint` | `banner.warning`'s and `text.bg-amber`'s fill | `oklch(0.975 0.022 85)` | `oklch(0.24 0.035 75)` |
| `--wf-danger-tint` | `banner.danger`'s and `text.bg-red`'s fill | `oklch(0.96 0.025 27.325)` | `oklch(0.25 0.04 22.216)` |
| `--wf-success-tint` | `banner.success`'s and `text.bg-green`'s fill | `oklch(0.965 0.025 150)` | `oklch(0.24 0.035 150)` |

The sizes and mono face are the same in light and dark.

Text backgrounds leave text colour independent: ink by default, or the written
text colour. Default ink and muted text reach 4.5:1 on all four tints in light
and dark; other text hue/background combinations have no contrast promise.

Phones use `--wf-muted` for their outline and `--wf-neutral-tint` for their
bezel. The status time, icons and home indicator use `--wf-ink`. The island uses
`--wf-ink` in light and `--wf-danger-ink` in dark, so both defaults are solid
dark against the paper. Its outline radius is six times `--wf-radius-lg`;
the screen subtracts the bezel (5 px plus three times `--wf-stroke`) for
concentric corners. The scrolling area's focus ring uses `--wf-focus` and
`--wf-focus-width`. Screen, band and status glyph sizes are fixed pixels,
independent of `--wf-text-size`.

| Property | Controls | Default |
| --- | --- | --- |
| `--wf-stroke` | border width; a frame's left bar is three times it; select chevron and cell sort strokes are one and a half times it on a 16-unit grid, and icons match on Tabler's 24-unit grid | `1px` |
| `--wf-focus-width` | the focus ring's width | `2px` |
| `--wf-radius` | cards, a frame's right corners, buttons, banners, inputs, selects, chips and unknown boxes | `6px` |
| `--wf-radius-lg` | the dialog's card and scrim, and a page; a phone's outline uses six times it, with concentric screen corners | `10px` |
| `--wf-text-size` | the base type size; spacing, chips, switches and `text.small` scale with it | `0.875rem` |
| `--wf-title-size` | the dialog's title and a card's direct `text.title`; other `text.title` is one and a half times it, unless combined with `.small` | `1rem` |
| `--wf-mono-font` | the font family of paired-backtick spans on `text` lines | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

## Mapping a host's tokens

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
