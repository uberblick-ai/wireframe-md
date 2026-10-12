/** Only a whole CSS-pixel count in the format's range may reach the DOM. */
export function widthPixels(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
  const width = Number(value);
  return width >= 1 && width <= 9999 ? width : undefined;
}

/** Card insets are fixed CSS pixels, including zero. */
export function paddingPixels(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
  const padding = Number(value);
  return padding >= 0 && padding <= 64 ? padding : undefined;
}
