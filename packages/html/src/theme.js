// @ts-check

/**
 * @param {string | undefined | null} [rawTheme]
 * @returns {"auto" | "light" | "dark"}
 */
export function normalizeThemeOption(rawTheme = "auto") {
  const theme = String(rawTheme || "auto").toLowerCase();

  if (theme === "auto" || theme === "light" || theme === "dark") {
    return theme;
  }

  throw new Error(`Unsupported theme "${rawTheme}". Expected "auto", "light", or "dark".`);
}

/**
 * @param {"auto" | "light" | "dark"} theme
 */
export function resolveThemeClassName(theme) {
  if (theme === "light") return "wf-theme-light";
  if (theme === "dark") return "wf-theme-dark";
  return "";
}

