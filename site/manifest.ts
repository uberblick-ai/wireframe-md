/** Curated example ids, in display order. Several families can share a section. */
export interface Section {
  id: string;
  title: string;
  description: string;
  examples: readonly string[];
}

export const manifest: readonly Section[] = [
  {
    id: "dialogs",
    title: "Dialogs and confirmations",
    description: "A title, a short explanation and the actions that follow.",
    examples: [
      "badges-and-banners/3-confirmations/delete-confirmation",
      "forms/2-simple-forms/input-in-a-dialog",
    ],
  },
  {
    id: "banners",
    title: "Banners",
    description: "Status and next steps, from a quiet notice to a positive outcome.",
    examples: [
      "badges-and-banners/2-banners/archived-banner",
      "badges-and-banners/2-banners/success-banner",
      "badges-and-banners/2-banners/banner-with-actions",
    ],
  },
  {
    id: "forms",
    title: "Forms",
    description: "Fields and choices, on their own or arranged into a settings page.",
    examples: [
      "forms/1-basic-inputs/labelled-input",
      "forms/1-basic-inputs/labelled-select",
      "forms/3-complex-forms/two-column-form",
    ],
  },
  {
    id: "tables",
    title: "Tables",
    description: "Rows, sort indicators and pagination drawn as static states.",
    examples: [
      "tables/2-complex-tables/sorted-ascending",
      "tables/2-complex-tables/paginated-table",
    ],
  },
  {
    id: "blocks",
    title: "Blocks",
    description: "Cards, shared frames and dividers that give content a home.",
    examples: [
      "blocks/2-cards/card",
      "blocks/1-frames/frame",
      "blocks/3-dividers/stacked-content",
    ],
  },
  {
    id: "pages",
    title: "Full pages",
    description: "Complete designs from Uberblick: its document list and workspace sidebar.",
    examples: [
      "pages/uberblick/document-list",
      "pages/uberblick/sidebar",
    ],
  },
];
