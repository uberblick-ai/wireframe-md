import { expect, test } from "@playwright/test";
import { archivedBanner, deleteConfirmation, documentList } from "../samples.js";
import { type Host, open, type Scheme, show } from "./page.js";

// The goldens: both samples from "Samples", and the document list page from the
// product corpus, which draws every kind and variant that page needs. Each in
// light and dark, on a bare page and inside a 710 px document column. Each must
// show its "Must read at a glance" points.

const samples = [
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
import { readFileSync } from "node:fs";
