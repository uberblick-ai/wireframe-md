import { ICON_DATA } from "./generated/icons.js";

export type IconStyle = "outline" | "filled";
// Paths are geometry only. Flags select fixed CSS rules for Tabler's few
// per-path paint overrides: fill=currentColor, stroke=none and opacity=.5.
export type IconPath = readonly [d: string, paint: number];
export type IconDrawing = Partial<Record<IconStyle, readonly IconPath[]>>;

export const ICONS: readonly string[] = [...ICON_DATA.keys()];

/** A name matches only the pinned catalog, never a prototype member or alias. */
export function resolveIcon(name: string, requested: IconStyle): { style: IconStyle; paths: readonly IconPath[] } | undefined {
  const drawing = ICON_DATA.get(name);
  if (drawing === undefined) return undefined;
  const style = drawing[requested] === undefined ? (requested === "filled" ? "outline" : "filled") : requested;
  const paths = drawing[style];
  return paths === undefined ? undefined : { style, paths };
}
