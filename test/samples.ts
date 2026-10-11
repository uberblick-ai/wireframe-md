// The two sources on the corpus page "Samples", and the properties a host can
// set, shared by the unit tests and the browser checks.

export const deleteConfirmation = [
  "dialog Delete “Q3 launch draft”?",
  "  text It will be gone for everyone, with its comments and history. Links to it will show it was deleted. This can't be undone.",
  "  row.end",
  "    button.focus Cancel",
  "    button.danger Delete",
].join("\n");

export const archivedBanner = [
  "banner.warning",
  "  icon archive",
  "  text Archived. Read-only and hidden from the document list.",
  "  row.end",
  "    button Restore",
  "    button.link.danger Delete…",
].join("\n");

/** Every kind and variant in Format v0.1. */
export const vocabulary = [
  "dialog Every kind and variant",
  "  icon archive",
  "  text Plain text",
  "  text.muted Muted text",
  "  text.strong Strong text",
  "  row",
  "    button Secondary",
  "    button.primary Primary",
  "    button.danger Danger",
  "    button.primary.danger Primary danger",
  "  row.end",
  "    button.link Link",
  "    button.link.danger Link danger",
  "    button.focus Focus",
  "banner",
  "  icon archive",
  "  text Neutral banner",
  "banner.info",
  "  icon archive",
  "  text Info banner",
  "  row.end",
  "    button.primary Primary",
  "banner.warning",
  "  icon archive",
  "  text Warning banner",
  "banner.danger",
  "  icon archive",
  "  text Danger banner",
  "  row.end",
  "    button.link.danger Delete…",
].join("\n");

/** The public custom properties, which a host sets on any ancestor. */
export const PROPERTIES = [
  "--wf-ink",
  "--wf-muted",
  "--wf-paper",
  "--wf-line",
  "--wf-scrim",
  "--wf-shadow",
  "--wf-primary",
  "--wf-primary-ink",
  "--wf-danger",
  "--wf-danger-ink",
  "--wf-focus",
  "--wf-info",
  "--wf-warning",
  "--wf-neutral-tint",
  "--wf-info-tint",
  "--wf-warning-tint",
  "--wf-danger-tint",
  "--wf-stroke",
  "--wf-focus-width",
  "--wf-radius",
  "--wf-radius-lg",
  "--wf-text-size",
  "--wf-title-size",
] as const;
