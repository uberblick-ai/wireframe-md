import { widthFraction } from "./attributes.js";
import type { WireframeNode } from "./model.js";
import { ROW_VARIANT_CONFLICTS } from "./vocabulary.js";

/** Match the renderer's source-order conflict resolution, including ignored variants. */
export function fullWidthRow(row: WireframeNode | undefined, parent: WireframeNode | undefined): boolean {
  return row?.kind === "row" && ["dialog", "page", "frame", "phone", "dock", "card"].includes(parent?.kind ?? "") &&
    !ROW_VARIANT_CONFLICTS.every((group) => row.variants.find((variant) => group.includes(variant)) === "scroll");
}

export function cardFraction(card: WireframeNode): ReturnType<typeof widthFraction> {
  return card.kind === "card" ? widthFraction(card.attributes.find((attribute) => attribute.key === "width")?.value) : undefined;
}

/** Compare the exact sum: floating-point addition can warn even for a row that sums to 1. */
export function rowFractions(row: WireframeNode): { total: number; overfull: boolean } {
  let numerator = 0n;
  let denominator = 1n;
  let total = 0;
  for (const child of row.children) {
    const fraction = cardFraction(child);
    if (fraction === undefined) continue;
    numerator = numerator * BigInt(fraction.denominator) + BigInt(fraction.numerator) * denominator;
    denominator *= BigInt(fraction.denominator);
    total += fraction.numerator / fraction.denominator;
  }
  return { total: numerator === denominator ? 1 : total, overfull: numerator > denominator };
}
