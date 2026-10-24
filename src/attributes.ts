/** Only a whole CSS-pixel count in the format's range may reach the DOM. */
export function widthPixels(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
  const width = Number(value);
  return width >= 1 && width <= 9999 ? width : undefined;
}

/** A fraction is validated independently of where the node stands. */
export function widthFraction(value: string | undefined): { numerator: number; denominator: number } | undefined {
  const match = value === undefined ? null : /^([0-9]+)\/([0-9]+)$/.exec(value);
  if (match === null) return undefined;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return numerator >= 1 && numerator <= denominator && denominator <= 9999 ? { numerator, denominator } : undefined;
}

/** Card insets are fixed CSS pixels, including zero. */
export function paddingPixels(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
  const padding = Number(value);
  return padding >= 0 && padding <= 64 ? padding : undefined;
}

/** A ruler mark's position is a whole percentage, including both endpoints. */
export function markPosition(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
  const position = Number(value);
  return position >= 0 && position <= 100 ? position : undefined;
}
