// @ts-check

/**
 * @param {Record<string, string | number | null | undefined>} styles
 */
export function styleAttr(styles) {
  return Object.entries(styles)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(";");
}

/**
 * @param {string} value
 */
export function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * @param {number | null | undefined} value
 */
export function px(value) {
  if (value == null) return null;
  return `${round(value)}px`;
}

/**
 * @param {number} value
 */
export function round(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * @param {unknown} value
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

