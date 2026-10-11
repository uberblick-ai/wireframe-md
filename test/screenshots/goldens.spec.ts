import { expect, test } from "@playwright/test";
import { archivedBanner, deleteConfirmation } from "../samples.js";
import { type Host, open, type Scheme, show } from "./page.js";

// The goldens: both samples from "Samples", in light and dark, on a bare page
// and inside a 710 px document column. Each must show its "Must read at a
// glance" points.

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
