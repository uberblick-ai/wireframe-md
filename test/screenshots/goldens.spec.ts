import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { archivedBanner, cardBlock, deleteConfirmation, documentList, figmaPrivate, figmaReading } from "../samples.js";
import { type Host, open, type Scheme, show } from "./page.js";

// The goldens: both samples from "Samples", and the document list page from the
// product corpus, which draws every kind and variant that page needs. Each in
// light and dark, on a bare page and inside a 710 px document column. Each must
// show its "Must read at a glance" points.

const samples = [
  ...["settings", "bare", "long-caption"].map((name) => ({
    name: `forms-switches-${name}`,
    source: readFileSync(new URL(`../../examples/forms/4-switches/${name}.wireframe`, import.meta.url), "utf8"),
    intro: "Switches show on/off state with a track and thumb; captions wrap beside the track.",
  })),
  ...["settings", "activity", "overflow"].map((name) => ({
    name: `navigation-tabs-${name}`,
    source: readFileSync(new URL(`../../examples/navigation/4-tab-bars/${name}.wireframe`, import.meta.url), "utf8"),
    intro: "Tabs mark the current section with an ink underline; longer strips scroll inside their container.",
  })),
  ...["browser", "window", "general"].map((name) => ({
    name: `pages-wrappers-${name}`,
    source: readFileSync(new URL(`../../examples/pages/1-wrappers/${name}.wireframe`, import.meta.url), "utf8"),
    intro: "Pages draw web content in a browser, app content in a macOS window, or content in a plain bordered box.",
  })),
  ...[
    ["phones-workspace-general", "phones/uberblick/workspace-general"],
    ["phones-short-screen", "phones/1-screens/short-screen"],
    ["phones-home-feed", "phones/1-screens/home-feed"],
  ].map(([name, path]) => ({
    name: name!,
    source: readFileSync(new URL(`../../examples/${path}.wireframe`, import.meta.url), "utf8"),
    intro: "A phone keeps its screen height; workspace labels sit above their values and tall content scrolls inside.",
  })),
  {
    name: "dividers-stacked-content",
    source: readFileSync(new URL("../../examples/blocks/3-dividers/stacked-content.wireframe", import.meta.url), "utf8"),
    intro: "Dividers separate stacked content in a page, dialog and frame, including a 256 px workspace sidebar.",
  },
  {
    name: "web-ui-sidebar",
    source: readFileSync(new URL("../../examples/pages/uberblick/sidebar.wireframe", import.meta.url), "utf8"),
    intro: "The workspace sidebar keeps its navigation in a 256 px panel at the start of the document column.",
  },
  ...[
    ["web-ui-document-header", "pages/uberblick/document-header"],
    ["text-inline-monospace", "reference/vocabulary/inline-monospace"],
  ].map(([name, path]) => ({
    name: name!,
    source: readFileSync(new URL(`../../examples/${path}.wireframe`, import.meta.url), "utf8"),
    intro: "Inline monospace keeps the line's size and colour; small metadata stays in the UI face around the id.",
  })),
  {
    name: "icons-named-palette",
    source: readFileSync(new URL("../../examples/icons/2-colours/named-palette.wireframe", import.meta.url), "utf8"),
    intro: "Named colours reuse the theme tones; every coloured state also has words.",
  },
  {
    name: "icons-pins-and-actions",
    source: readFileSync(new URL("../../examples/icons/1-styles/pins-and-actions.wireframe", import.meta.url), "utf8"),
    intro: "Outline and filled icons stand alone, in cells and in inert actions with or without captions.",
  },
  ...["sorted-ascending", "sorted-descending", "paginated-table"].map((name) => ({
    name: `tables-${name}`,
    source: readFileSync(new URL(`../../examples/tables/2-complex-tables/${name}.wireframe`, import.meta.url), "utf8"),
    intro: "Tables show sort state and pagination using inert header arrows, text and buttons.",
  })),
  {
    name: "tables-reference-sorts-and-row-text",
    source: readFileSync(new URL("../../examples/reference/vocabulary/table-sorts-and-row-text.wireframe", import.meta.url), "utf8"),
    intro: "Each table has one sorted column; long row text wraps beside its action.",
  },
  {
    name: "card-block",
    source: cardBlock,
    intro: "A delivery review lists a recommendation with a label, title, body and footer.",
  },
  {
    name: "card-wrapping-title-and-footer",
    source: readFileSync(new URL("../../examples/blocks/2-cards/wrapping-title-and-footer.wireframe", import.meta.url), "utf8"),
    intro: "Long card titles and footers wrap inside the paper box.",
  },
  {
    name: "card-comment-header",
    source: readFileSync(new URL("../../examples/blocks/2-cards/comment-header.wireframe", import.meta.url), "utf8"),
    intro: "The author group stays together beside Resolve, with wrapping text in the narrow card.",
  },
  {
    name: "several-cards",
    source: readFileSync(new URL("../../examples/blocks/2-cards/several-cards.wireframe", import.meta.url), "utf8"),
    intro: "Cards stack at full width with a small gap, including a title-only card.",
  },
  {
    name: "figma-block-reading",
    source: figmaReading,
    intro: "A Figma frame shows its caption actions, live-view placeholder and optional caption.",
  },
  {
    name: "figma-block-private",
    source: figmaPrivate,
    intro: "A private Figma file shows the access message and a separate Load action in the body.",
  },
  {
    name: "delete-confirmation",
    source: deleteConfirmation,
    intro: "Delete… opens a modal like the archive confirmation. Cancel has the focus.",
  },
  {
    name: "archived-banner",
    source: archivedBanner,
    intro: "A calm banner, noticeable without reading as an alert.",
  },
  {
    name: "web-ui-document-list",
    source: documentList,
    intro: "The All documents page: its controls stay quieter than the list they filter.",
  },
  ...["success-banner", "banner-with-actions", "wrapping-text", "stacked-above-page"].map((name) => ({
    name: `banners-${name}`,
    source: readFileSync(new URL(`../../examples/badges-and-banners/2-banners/${name}.wireframe`, import.meta.url), "utf8"),
    intro: "Page banners show an outcome, offer actions or explain a state above the content.",
  })),
  {
    name: "labelled-two-column-form",
    source: readFileSync(new URL("../../examples/forms/3-complex-forms/two-column-form.wireframe", import.meta.url), "utf8"),
    intro: "Field names sit above hints and chosen values, in aligned columns.",
  },
  {
    name: "long-field-label",
    source: readFileSync(new URL("../../examples/forms/1-basic-inputs/long-field-label.wireframe", import.meta.url), "utf8"),
    intro: "A wrapped field label keeps the controls aligned without widening its column.",
  },
  {
    name: "long-labelled-select",
    source: 'page\n  select label=Team "Engineering, Product and Design leadership group for all regional offices and programme directors"\npage\n  row\n    select label=Team "Engineering, Product and Design leadership group"\n    input label=Name Hint',
    intro: "Long select values stay within their fields and frames, scrolling inside the wireframe when needed.",
  },
];

for (const { name, source, intro } of samples) {
  for (const scheme of ["light", "dark"] satisfies Scheme[]) {
    for (const host of ["standalone", "column"] satisfies Host[]) {
      test(`${name}, ${scheme}, ${host}`, async ({ page }) => {
        await open(page);
        const shot = await show(page, source, { scheme, host, intro });
        await expect(shot).toHaveScreenshot(`${name}-${scheme}-${host}.png`);
      });
    }
  }
}
