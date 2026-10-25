// Light, dark, or whatever the system says. The palettes already follow the
// system; a choice overrides it through `data-theme` on the root element,
// which the theme's stylesheet reads. Remembered in this browser; nothing is
// sent anywhere.
export type Theme = "light" | "dark" | "system";

const KEY = "unified-ui:theme";

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Storage refused (a private window): the system decides.
    return "system";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

// Called once before the app renders, so a page forced to dark does not
// flash light while the switch mounts.
export function applyStoredTheme() {
  apply(storedTheme());
}

// Applies a choice and remembers it for the next visit.
export function chooseTheme(theme: Theme) {
  apply(theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered, but applied for this visit.
  }
}
